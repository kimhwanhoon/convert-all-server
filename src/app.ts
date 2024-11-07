import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import routes from './routes/route';

const app = express();
const port = process.env.PORT || 8000;

const allowedOrigins = process.env.ORIGIN ? [process.env.ORIGIN] : [];

// 타입 안전성을 위한 cors 옵션 타입 정의
const corsOptions = {
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // 허용할 HTTP 메서드 명시
  credentials: true, // 필요한 경우 credentials 설정
};

app.use(cors(corsOptions));

// API 키 확인 미들웨어를 별도 함수로 분리
const validateApiKey = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(403).send('Forbidden: Invalid Authorization Header');
    return;
  }

  const token = authHeader.split(' ')[1];
  if (token !== process.env.API_KEY) {
    res.status(403).send('Forbidden: Invalid API Key');
    return;
  }
  next();
};

app.use(validateApiKey);
app.use('/', routes);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
