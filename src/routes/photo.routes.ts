import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import upload from '../middleware/upload';
import {
  uploadPhotos,
  getPhoto,
  deletePhoto,
  updatePhotoDescription
} from '../controllers/photo.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Photo routes
router.post('/issues/:issueId', upload.array('photos', 5), uploadPhotos);
router.get('/:id', getPhoto);
router.put('/:id/description', updatePhotoDescription);
router.delete('/:id', deletePhoto);

export default router;