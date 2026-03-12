import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { RequestController } from '../controllers/requestController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.get('/health', UserController.healthCheck);
router.post('/:id/admin-request', RequestController.requestAdmin);
router.get('/admin-requests', authenticate('developer'), RequestController.getAdminRequests);

export default router;
