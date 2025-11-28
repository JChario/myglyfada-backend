import { Router } from 'express';
import { validate, loginSchema, registerSchema } from '../middleware/validation';
import { authenticate } from '../middleware/auth';
import {
  login,
  register,
  getProfile,
  updateProfile,
  changePassword
} from '../controllers/auth.controller';

const router = Router();

// Public routes
router.post('/login', validate(loginSchema), login);
router.post('/register', validate(registerSchema), register);

// Protected routes
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.put('/change-password', authenticate, changePassword);

export default router;