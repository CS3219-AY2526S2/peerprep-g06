import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { RequestController } from '../controllers/requestController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.get('/health', UserController.healthCheck);
router.get('/profile', UserController.getProfile);
router.get('/profile/:userId', UserController.getNameById);
router.post('/:id/admin-request', RequestController.requestAdmin);
router.get('/admin-requests', authenticate('developer'), RequestController.getAdminRequests);
router.patch(
  '/admin-requests/:id/approve',
  authenticate('developer'),
  RequestController.approveAdmin,
);
router.patch(
  '/admin-requests/:id/reject',
  authenticate('developer'),
  RequestController.rejectAdmin,
);
router.post('/:id/demote-request', authenticate('admin'), RequestController.requestDemote);
router.get('/demote-requests', authenticate('developer'), RequestController.getDemoteRequests);
router.patch(
  '/demote-requests/:id/approve',
  authenticate('developer'),
  RequestController.approveDemote,
);
router.patch(
  '/demote-requests/:id/reject',
  authenticate('developer'),
  RequestController.rejectDemote,
);

export default router;
