import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import routes from './routes/route';

const app = express();
const cors = require('cors');

const port = process.env.PORT || 8000;

const allowedOrigins = [process.env.ORIGIN];

app.use(
  cors({
    origin: allowedOrigins,
  })
);

// API 키 확인 미들웨어 추가
app.use((req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(403).send('Forbidden: Invalid Authorization Header');
    return;
  }

  const token = authHeader.split(' ')[1];
  if (token !== process.env.API_KEY) {
    res.status(403).send('Forbidden: Invalid API Key');
    return;
  }
  next();
});

app.use('/', routes);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
