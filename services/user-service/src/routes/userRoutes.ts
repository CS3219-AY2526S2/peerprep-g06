import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { RequestController } from '../controllers/requestController';

const router = Router();

router.get('/health', UserController.healthCheck);
router.post('/request-admin', RequestController.requestAdmin);
router.get('/admin-requests', RequestController.getAdminRequests);

export default router;
