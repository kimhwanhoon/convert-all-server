import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import sharp, { FormatEnum } from 'sharp';

const router = Router();

// 파일 업로드 설정
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 5MB로 파일 크기 제한
});

// 이미지 변환 API 엔드포인트
router.post('/', upload.any(), async (req: Request, res: Response) => {
  // 요청 파라미터 추출
  const {
    format,
    quality: qualityStr,
    width: widthStr,
    height: heightStr,
  } = req.body;
  const quality = Number(qualityStr);
  const width = Number(widthStr);
  const height = Number(heightStr);

  // 필수 파라미터 검증
  if (!format) {
    return res.status(400).send('Format is required');
  }

  try {
    const files = req.files as Express.Multer.File[];

    // 파일 업로드 검증
    if (!files?.length) {
      return res.status(400).send('No files uploaded');
    }

    // 최대 파일 개수 검증
    const MAX_FILES = 5;
    if (files.length > MAX_FILES) {
      return res.status(400).send(`Maximum ${MAX_FILES} files allowed at once`);
    }

    // 이미지 변환 처리
    const convertedImages = await Promise.all(
      files.map(async (file) => {
        const convertedImage = await convertImage({
          buffer: file.buffer,
          format,
          quality,
          width,
          height,
        });

        // 메모리 해제
        file.buffer = Buffer.from([]);

        return {
          buffer: convertedImage,
          originalName: file.originalname,
        };
      })
    );

    // 결과 반환
    if (convertedImages.length === 1) {
      return sendSingleImage(res, convertedImages[0].buffer, format);
    } else {
      return sendZippedImages(res, convertedImages, format);
    }
  } catch (error) {
    console.error('Image conversion error:', error);
    return res.status(500).send('Image conversion failed');
  }
});

// 단일 이미지 변환 함수
async function convertImage({
  buffer,
  format,
  quality,
  width,
  height,
}: {
  buffer: Buffer;
  format: string;
  quality: number;
  width?: number;
  height?: number;
}) {
  let image = sharp(buffer);
  const metadata = await image.metadata();

  // 이미지 크기 최적화
  const MAX_PIXELS = 4000 * 4000;
  if (
    metadata.width &&
    metadata.height &&
    metadata.width * metadata.height > MAX_PIXELS
  ) {
    const ratio = Math.sqrt(MAX_PIXELS / (metadata.width * metadata.height));
    image = image.resize({
      width: Math.round(metadata.width * ratio),
      height: Math.round(metadata.height * ratio),
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  // 사용자 지정 크기로 리사이즈
  if (width && height) {
    image = image.resize(width, height, {
      withoutEnlargement: true,
    });
  }

  // 이미지 포맷 변환
  return image
    .toFormat(format as keyof FormatEnum, {
      quality,
      compression: format === 'heic' ? 'av1' : 'lz4',
    })
    .toBuffer();
}

// 단일 이미지 응답 함수
function sendSingleImage(res: Response, buffer: Buffer, format: string) {
  res.set('Content-Type', `image/${format}`);
  return res.status(200).send(buffer);
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

  // ZIP 파일에 이미지 추가
  for (const image of images) {
    const fileName = image.originalName.replace(/\.[^/.]+$/, '');
    archive.append(image.buffer, {
      name: `${fileName}.${format}`,
    });
    image.buffer = Buffer.from([]); // 메모리 해제
  }

  return archive.finalize();
}

export default router;
