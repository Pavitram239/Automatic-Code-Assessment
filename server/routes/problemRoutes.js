import express from 'express';
import {
  createProblem,
  getProblems,
  getProblemById,
  updateProblem,
  deleteProblem
} from '../controllers/problemController.js';
import { isAdmin, isAuthorized } from '../middlewares/auth.js';

const router = express.Router();
router.use(isAuthorized);

// Admin routes
router.post('/',  isAdmin, createProblem);
router.put('/:id',  isAdmin, updateProblem);
router.delete('/:id',  isAdmin, deleteProblem);

// Public routes
router.get('/', getProblems);
router.get('/:id', getProblemById);

export default router;
