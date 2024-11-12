import { type Request, type Response } from 'express';
import { saveLogsToFile } from '../../../lib/log/resourceLogger';

const Router = require('express'),
  router = Router();

router.get('/', (req: Request, res: Response) => {
  const fileName = saveLogsToFile();

  return res.status(200).json({
    message: `Logs saved to ${fileName}`,
    error: null,
  });
});

export { router as healthLogRouter };
