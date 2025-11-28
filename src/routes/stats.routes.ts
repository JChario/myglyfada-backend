import { Router } from 'express';
import { authenticate, staffOnly } from '../middleware/auth';
import {
  getDashboardStats,
  getIssueStats
} from '../controllers/stats.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Statistics routes
router.get('/dashboard', getDashboardStats);
router.get('/issues/:id', getIssueStats);

export default router;