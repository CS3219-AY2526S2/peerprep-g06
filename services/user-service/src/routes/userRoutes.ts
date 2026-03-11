import { Router } from 'express';
import { UserController } from '../controllers/userController';

const router = Router();

router.get('/health', UserController.healthCheck);
router.post('/request-admin', UserController.requestAdmin);

export default router;
