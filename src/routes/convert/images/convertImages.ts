import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';

const router = Router();

// 메모리에 파일을 저장하도록 multer 설정
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB 제한

router.get('/', (req: Request, res: Response) => {
  res.send('get request received');
});

router.post('/', upload.any(), async (req: Request, res: Response) => {
  // body에서 output format 받기
  const format = req.body.format;
  const quality = Number(req.body.quality);
  const width = Number(req.body.width);
  const height = Number(req.body.height);

  // format이 없는 경우 에러 반환
  if (!format) {
    res.status(400).send('Format is required');
    return;
  }

  try {
    // req.files는 배열 형태이며 각 파일 객체에 buffer가 포함되어 있습니다.
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).send('No files uploaded');
      return;
    }

    // 각 파일의 buffer 데이터를 처리
    const convertedImages = await Promise.all(
      files.map(async (file, index) => {
        // Sharp로 이미지 변환
        let image = sharp(file.buffer);

        // width와 height가 null이거나 0이 아닐 때만 리사이징
        if (width && height) {
          image = image.resize(width, height);
        }

        return await image.toFormat(format, { quality }).toBuffer();
      })
    );

    // 변환된 파일의 개수가 1이면 바로 보내고, 그렇지 않으면 압축해서 압축파일로 내보낸다.
    if (convertedImages.length === 1) {
      res.set('Content-Type', `image/${format}`);
      res.status(200).send(convertedImages[0]);
      return;
    } else {
      res.set('Content-Type', 'application/zip');
      res.set(
        'Content-Disposition',
        'attachment; filename=converted_images.zip'
      );

      const archiver = require('archiver');
      const archive = archiver('zip', {
        zlib: { level: 9 }, // 최대 압축
      });

      archive.on('error', (err: any) => {
        throw err;
      });

      archive.pipe(res);

      convertedImages.forEach((image, index) => {
        archive.append(image, { name: `image_${index + 1}.${format}` });
      });

      await archive.finalize();

      return;
    }
  } catch (error) {
    console.error('Image conversion error:', error);
    res.status(500).send('Image conversion failed');
    return;
  }
});

export default router;
