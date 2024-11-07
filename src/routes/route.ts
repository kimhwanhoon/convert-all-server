import { Router } from 'express';
import convertImages from './convert/images/convertImages';

const router = Router();

router.use('/convert/images', convertImages);

export default router;
