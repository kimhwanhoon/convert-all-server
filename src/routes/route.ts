import { Router } from 'express';
import { convertImagesRouter } from './convert/images/route';
import { healthLogRouter } from './health/log/route';

const router = Router();

router.use('/convert/images', convertImagesRouter);
router.use('/health/log', healthLogRouter);

export { router as routes };
