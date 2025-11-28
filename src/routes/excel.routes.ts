import { Router } from 'express';
import { authenticate, staffOnly, adminOnly } from '../middleware/auth';
import upload from '../middleware/upload';
import {
  exportIssues,
  importIssues
} from '../controllers/excel.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Excel export/import routes
router.get('/export', staffOnly, exportIssues);
router.post('/import', adminOnly, upload.single('file'), importIssues);

export default router;