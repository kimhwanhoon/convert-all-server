import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import sharp, { type FormatEnum } from 'sharp';
import pLimit from 'p-limit';

const router = Router();

// 메모리 사용량 제한 설정 (512MB)
const MAX_MEMORY = 512 * 1024 * 1024, // 512MB in bytes
  MAX_PIXELS = 4000 * 4000,
  MAX_FILES = isNaN(Number(process.env.MAX_FILES))
    ? 5
    : Number(process.env.MAX_FILES),
  MAX_FILE_SIZE = isNaN(Number(process.env.MAX_FILE_SIZE))
    ? 10 * 1024 * 1024
    : Number(process.env.MAX_FILE_SIZE) * 1024 * 1024;

// 병렬 처리 제한 설정
const limit = pLimit(1); // 동시에 5개의 작업만 실행

// 파일 업로드 설정
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB로 파일 크기 제한
    fieldSize: MAX_MEMORY / 10, // 필드당 최대 메모리 제한
  },
});

// 이미지 변환 API 엔드포인트
router.post('/', upload.any(), async (req: Request, res: Response) => {
  console.log('[POST] "/convert/images" request received.');

  // 현재 메모리 사용량 확인
  const memoryUsage = process.memoryUsage();
  if (memoryUsage.heapUsed > MAX_MEMORY) {
    return res.status(503).send('Server is busy. Please try again later.');
  }

  // 요청 파라미터 추출
  const {
    format,
    quality: qualityStr,
    width: widthStr,
    height: heightStr,
  } = req.body;
  // 필수 파라미터 검증
  if (!format) {
    return res.status(400).send('Format is required');
  }

  const quality = Number(qualityStr),
    width = Number(widthStr),
    height = Number(heightStr);

  let sharpInstances: sharp.Sharp[] = [];

  try {
    const files = req.files as Express.Multer.File[];

    // 파일 업로드 검증
    if (!files?.length) {
      return res.status(400).send('No files uploaded');
    }

    // 최대 파일 개수 검증
    if (files.length > MAX_FILES) {
      return res.status(400).send(`Maximum ${MAX_FILES} files allowed at once`);
    }

    // 파일 크기 검증, 파일 하나의 크기가 10MB 초과 시 400 에러 반환
    if (files.some((file) => file.size > MAX_FILE_SIZE)) {
      return res.status(400).send('File size exceeds 10MB');
    }

    // 이미지를 병렬로 변환
    const convertedImages = await Promise.all(
      files.map((file) =>
        limit(async () => {
          const result = await convertImage({
            buffer: file.buffer,
            format,
            quality,
            width,
            height,
            originalName: file.originalname,
            sharpInstances,
          });
          file.buffer = Buffer.from([]);
          return result;
        })
      )
    );

    // 결과 반환
    if (convertedImages.length === 1) {
      const fileName = convertedImages[0].originalName.split('.')[0];
      const result = sendSingleImage(
        res,
        convertedImages[0].buffer,
        format,
        fileName
      );
      convertedImages[0].buffer = Buffer.from([]);
      return result;
    } else {
      const result = await sendZippedImages(res, convertedImages, format);
      convertedImages.forEach((img) => {
        img.buffer = Buffer.from([]);
      });
      return result;
    }
  } catch (error) {
    console.error('Image conversion error:', error);
    return res.status(500).send('Image conversion failed');
  } finally {
    // sharp 인스턴스 정리
    sharpInstances.forEach((instance) => {
      try {
        instance.destroy();
      } catch (err) {
        console.error('Sharp instance destruction error:', err);
      }
    });
  }
});

// 단일 이미지 변환 함수
async function convertImage({
  buffer,
  format,
  quality,
  width,
  height,
  originalName,
  sharpInstances,
}: {
  buffer: Buffer;
  format: string;
  quality: number;
  width?: number;
  height?: number;
  originalName: string;
  sharpInstances: sharp.Sharp[];
}) {
  const pipeline = sharp(buffer);
  sharpInstances.push(pipeline);

  const metadata = await pipeline.metadata();

  if (
    metadata.width &&
    metadata.height &&
    metadata.width * metadata.height > MAX_PIXELS
  ) {
    const ratio = Math.sqrt(MAX_PIXELS / (metadata.width * metadata.height));
    pipeline.resize({
      width: Math.round(metadata.width * ratio),
      height: Math.round(metadata.height * ratio),
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  // 사용자 지정 크기로 리사이즈
  if (width && height) {
    pipeline.resize(width, height, {
      withoutEnlargement: true,
    });
  }

  // ico 포맷 처리
  if (format === 'ico') {
    try {
      const pngToIco = require('png-to-ico');
      let pngBuffer;

      if (metadata.format === 'png') {
        // 이미 PNG인 경우 resize만 적용
        pngBuffer = await pipeline.toBuffer();
      } else {
        // PNG가 아닌 경우 PNG로 변환
        pngBuffer = await pipeline.png().toBuffer();
      }

      const icoBuffer = await pngToIco(pngBuffer);
      return {
        buffer: icoBuffer,
        originalName,
      };
    } catch (error) {
      throw new Error(`ICO 변환 중 오류 발생: ${error}`);
    }
  }

  // 이미지 포맷 변환을 위한 변환 파이프라인 생성
  const formatPipeline = sharp();
  if (format === 'svg') {
    const svgBuffer = await convertToSvg(buffer);
    return {
      buffer: svgBuffer,
      originalName,
    };
  } else {
    formatPipeline.toFormat(format as keyof FormatEnum, {
      quality,
      compression: format === 'heic' ? 'av1' : 'lz4',
    });
  }
  sharpInstances.push(formatPipeline);

  // 파이프라인 연결 및 변환 실행
  const convertedBuffer = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    pipeline
      .pipe(formatPipeline)
      .on('data', (chunk) => chunks.push(chunk))
      .on('end', () => resolve(Buffer.concat(chunks)))
      .on('error', reject);
  });

  return {
    buffer: convertedBuffer,
    originalName,
  };
}

// 이미지 포맷을 SVG로 변환하는 함수
async function convertToSvg(buffer: Buffer): Promise<Buffer> {
  const sharp = require('sharp');
  const svg2img = require('svg2img');

  // 이미지를 SVG로 변환
  const metadata = await sharp(buffer).metadata();
  const svg = `
    <svg width="${metadata.width}" height="${metadata.height}" xmlns="http://www.w3.org/2000/svg">
      <image href="data:image/${metadata.format};base64,${buffer.toString('base64')}" width="100%" height="100%"/>
    </svg>
  `;

  // SVG를 이미지로 변환
  return new Promise((resolve, reject) => {
    svg2img(svg, (error: any, buffer: Buffer) => {
      if (error) {
        return reject(error);
      }
      resolve(buffer);
    });
  });
}

// 단일 이미지 응답 함수
function sendSingleImage(
  res: Response,
  buffer: Buffer,
  format: string,
  fileName: string
) {
  const contentType = format === 'jpg' ? 'jpeg' : format;
  res.set('Content-Type', `image/${contentType}`);
  res.set(
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(fileName)}.${format}"`
  );
  return res.send(buffer);
}

// 다중 이미지 ZIP 응답 함수
async function sendZippedImages(
  res: Response,
  images: { buffer: Buffer; originalName: string }[],
  format: string
) {
  res.set('Content-Type', 'application/zip');
  res.set('Content-Disposition', 'attachment; filename=converted_images.zip');

  const archiver = require('archiver');
  const archive = archiver('zip', {
    zlib: { level: 3 },
  });

  archive.on('error', (err: any) => {
    throw err;
  });

  archive.pipe(res);

  // ZIP 파일에 이미지 추가를 병렬로 처리
  await Promise.all(
    images.map(async (image) => {
      const fileName = image.originalName.replace(/\.[^/.]+$/, '');
      archive.append(image.buffer, {
        name: `${fileName}.${format}`,
      });
      image.buffer = Buffer.from([]); // 메모리 해제
    })
  );

  return archive.finalize();
}

export { router as convertImagesRouter };
