import { Router } from 'express';
import { validate, createCategorySchema, createSubcategorySchema } from '../middleware/validation';
import { authenticate, adminOnly } from '../middleware/auth';
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory
} from '../controllers/category.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Category routes
router.get('/', getCategories);
router.get('/:id', getCategoryById);
router.post('/', adminOnly, validate(createCategorySchema), createCategory);
router.put('/:id', adminOnly, updateCategory);
router.delete('/:id', adminOnly, deleteCategory);

// Subcategory routes
router.post('/subcategories', adminOnly, validate(createSubcategorySchema), createSubcategory);
router.put('/subcategories/:id', adminOnly, updateSubcategory);
router.delete('/subcategories/:id', adminOnly, deleteSubcategory);

export default router;