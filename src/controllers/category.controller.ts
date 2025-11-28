import { Response } from 'express';
import { prisma } from '../config/database';
import { AuthenticatedRequest, ApiResponse } from '../types';

export const getCategories = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      include: {
        subcategories: {
          where: { isActive: true },
          orderBy: { name: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json({
      success: true,
      message: 'Categories retrieved successfully',
      data: { categories }
    } as ApiResponse);

  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as ApiResponse);
  }
};

export const getCategoryById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const category = await prisma.category.findUnique({
      where: { id, isActive: true },
      include: {
        subcategories: {
          where: { isActive: true },
          orderBy: { name: 'asc' }
        }
      }
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      } as ApiResponse);
    }

    res.json({
      success: true,
      message: 'Category retrieved successfully',
      data: { category }
    } as ApiResponse);

  } catch (error) {
    console.error('Get category by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as ApiResponse);
  }
};

export const createCategory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, nameEn, description, color, icon } = req.body;

    // Check if category with same name exists
    const existingCategory = await prisma.category.findFirst({
      where: { name, isActive: true }
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category with this name already exists'
      } as ApiResponse);
    }

    const category = await prisma.category.create({
      data: {
        name,
        nameEn,
        description,
        color,
        icon
      }
    });

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: { category }
    } as ApiResponse);

  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as ApiResponse);
  }
};

export const updateCategory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, nameEn, description, color, icon } = req.body;

    // Check if category exists
    const existingCategory = await prisma.category.findUnique({
      where: { id, isActive: true }
    });

    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      } as ApiResponse);
    }

    // Check if another category with same name exists
    if (name && name !== existingCategory.name) {
      const duplicateCategory = await prisma.category.findFirst({
        where: { 
          name,
          isActive: true,
          id: { not: id }
        }
      });

      if (duplicateCategory) {
        return res.status(400).json({
          success: false,
          message: 'Category with this name already exists'
        } as ApiResponse);
      }
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(nameEn !== undefined && { nameEn }),
        ...(description !== undefined && { description }),
        ...(color && { color }),
        ...(icon !== undefined && { icon })
      }
    });

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: { category }
    } as ApiResponse);

  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as ApiResponse);
  }
};

export const deleteCategory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if category exists
    const existingCategory = await prisma.category.findUnique({
      where: { id, isActive: true }
    });

    if (!existingCategory) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      } as ApiResponse);
    }

    // Check if category has active issues
    const issuesCount = await prisma.issue.count({
      where: { categoryId: id }
    });

    if (issuesCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category with existing issues'
      } as ApiResponse);
    }

    // Soft delete by setting isActive to false
    await prisma.category.update({
      where: { id },
      data: { isActive: false }
    });

    // Also soft delete subcategories
    await prisma.subcategory.updateMany({
      where: { categoryId: id },
      data: { isActive: false }
    });

    res.json({
      success: true,
      message: 'Category deleted successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as ApiResponse);
  }
};

export const createSubcategory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, nameEn, description, color, icon, estimatedDays, categoryId } = req.body;

    // Check if category exists
    const category = await prisma.category.findUnique({
      where: { id: categoryId, isActive: true }
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      } as ApiResponse);
    }

    // Check if subcategory with same name exists in this category
    const existingSubcategory = await prisma.subcategory.findFirst({
      where: { 
        name,
        categoryId,
        isActive: true
      }
    });

    if (existingSubcategory) {
      return res.status(400).json({
        success: false,
        message: 'Subcategory with this name already exists in this category'
      } as ApiResponse);
    }

    const subcategory = await prisma.subcategory.create({
      data: {
        name,
        nameEn,
        description,
        color,
        icon,
        estimatedDays,
        categoryId
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            nameEn: true,
            color: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Subcategory created successfully',
      data: { subcategory }
    } as ApiResponse);

  } catch (error) {
    console.error('Create subcategory error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as ApiResponse);
  }
};

export const updateSubcategory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, nameEn, description, color, icon, estimatedDays } = req.body;

    // Check if subcategory exists
    const existingSubcategory = await prisma.subcategory.findUnique({
      where: { id, isActive: true }
    });

    if (!existingSubcategory) {
      return res.status(404).json({
        success: false,
        message: 'Subcategory not found'
      } as ApiResponse);
    }

    // Check if another subcategory with same name exists in this category
    if (name && name !== existingSubcategory.name) {
      const duplicateSubcategory = await prisma.subcategory.findFirst({
        where: { 
          name,
          categoryId: existingSubcategory.categoryId,
          isActive: true,
          id: { not: id }
        }
      });

      if (duplicateSubcategory) {
        return res.status(400).json({
          success: false,
          message: 'Subcategory with this name already exists in this category'
        } as ApiResponse);
      }
    }

    const subcategory = await prisma.subcategory.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(nameEn !== undefined && { nameEn }),
        ...(description !== undefined && { description }),
        ...(color && { color }),
        ...(icon !== undefined && { icon }),
        ...(estimatedDays !== undefined && { estimatedDays })
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            nameEn: true,
            color: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Subcategory updated successfully',
      data: { subcategory }
    } as ApiResponse);

  } catch (error) {
    console.error('Update subcategory error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as ApiResponse);
  }
};

export const deleteSubcategory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if subcategory exists
    const existingSubcategory = await prisma.subcategory.findUnique({
      where: { id, isActive: true }
    });

    if (!existingSubcategory) {
      return res.status(404).json({
        success: false,
        message: 'Subcategory not found'
      } as ApiResponse);
    }

    // Check if subcategory has active issues
    const issuesCount = await prisma.issue.count({
      where: { subcategoryId: id }
    });

    if (issuesCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete subcategory with existing issues'
      } as ApiResponse);
    }

    // Soft delete by setting isActive to false
    await prisma.subcategory.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({
      success: true,
      message: 'Subcategory deleted successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('Delete subcategory error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as ApiResponse);
  }
};