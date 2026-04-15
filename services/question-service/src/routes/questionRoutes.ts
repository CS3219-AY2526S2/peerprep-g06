import { Router } from 'express';
import {
  getAllQuestions,
  getQuestionById,
  getRandomQuestionByFilter,
  addQuestion,
  updateQuestion,
  deleteQuestion,
} from '../controllers/questionController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

// Public read routes
router.get('/', getAllQuestions);
router.get('/:id', getQuestionById);
router.get('/random/:difficulty/:topic', getRandomQuestionByFilter);

// Admin-only write routes
router.post('/', authenticate, addQuestion);
router.put('/:id', authenticate, updateQuestion);
router.delete('/:id', authenticate, deleteQuestion);

export default router;
