import 'dotenv/config';
import express, { Request, RequestHandler, Response } from 'express';
import cors from 'cors';
import { routes } from './routes/route';
import { validateApiKey } from './lib/validateApiKey';
import resourceLogger from './lib/log/resourceLogger';

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

app.use(validateApiKey as RequestHandler);
app.use('/', routes);

app.get('/', (req: Request, res: Response) => {
  res.send('Hello World');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// 메모리 사용량 모니터링 추가
// setInterval(resourceLogger, 1000);
