import { Router } from 'express';
import { UserController } from '../controllers/userController';

const router = Router();

router.get('/health', UserController.healthCheck);

export default router;
