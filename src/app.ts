import 'dotenv/config';
import express, { Request, RequestHandler, Response } from 'express';
import cors from 'cors';
import { routes } from './routes/route';
import { validateApiKey } from './lib/validateApiKey';
// import resourceLogger from './lib/log/resourceLogger';

const app = express();
const port = process.env.PORT || 8000;

const allowedOrigins = process.env.ORIGIN
  ? process.env.ORIGIN.split(',').map((origin) => origin.trim())
  : ['https://convert-all.hwanhoon.kim', 'http://localhost:3000'];

const corsOptions = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  optionsSuccessStatus: 200,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
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
