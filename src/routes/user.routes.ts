import { Router } from 'express';
import { authenticate, adminOnly, staffOnly } from '../middleware/auth';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getSupervisors
} from '../controllers/user.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// User management routes
router.get('/', staffOnly, getAllUsers);
router.get('/supervisors', authenticate, getSupervisors);
router.get('/:id', getUserById);
router.post('/', adminOnly, createUser);
router.put('/:id', adminOnly, updateUser);
router.delete('/:id', adminOnly, deleteUser);

export default router;