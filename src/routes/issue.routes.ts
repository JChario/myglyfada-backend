import { Router } from 'express';
import { validate, createIssueSchema, updateIssueSchema } from '../middleware/validation';
import { authenticate, staffOnly } from '../middleware/auth';
import {
  createIssue,
  getIssues,
  getIssueById,
  updateIssue,
  deleteIssue
} from '../controllers/issue.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Issue CRUD operations
router.post('/', validate(createIssueSchema), createIssue);
router.get('/', getIssues);
router.get('/:id', getIssueById);
router.put('/:id', validate(updateIssueSchema), updateIssue);
router.delete('/:id', deleteIssue);

export default router;