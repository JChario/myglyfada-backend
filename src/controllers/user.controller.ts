import { Response } from 'express';
import { prisma } from '../config/database';
import { hashPassword } from '../utils/auth';
import { AuthenticatedRequest, ApiResponse } from '../types';

export const getAllUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      } as ApiResponse);
    }

    // Only staff can view all users
    if (userRole === 'USER') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      } as ApiResponse);
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            createdIssues: true,
            assignedIssues: true
          }
        }
      },
      orderBy: [
        { role: 'asc' },
        { lastName: 'asc' }
      ]
    });

    res.json({
      success: true,
      message: 'Users retrieved successfully',
      data: { users }
    } as ApiResponse);

  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as ApiResponse);
  }
};

export const getUserById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      } as ApiResponse);
    }

    // Users can only view their own profile unless they're staff
    if (userRole === 'USER' && id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      } as ApiResponse);
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            createdIssues: true,
            assignedIssues: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      } as ApiResponse);
    }

    res.json({
      success: true,
      message: 'User retrieved successfully',
      data: { user }
    } as ApiResponse);

  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as ApiResponse);
  }
};

export const createUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, username, password, firstName, lastName, phone, role } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email ? 'Email already registered' : 'Username already taken'
      } as ApiResponse);
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        role: role || 'USER'
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: { user }
    } as ApiResponse);

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as ApiResponse);
  }
};

export const updateUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phone, role, isActive } = req.body;
    const currentUserRole = req.user?.role;

    // Only admin can update other users
    if (currentUserRole !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only feature.'
      } as ApiResponse);
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      } as ApiResponse);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(phone !== undefined && { phone }),
        ...(role && { role }),
        ...(isActive !== undefined && { isActive })
      },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json({
      success: true,
      message: 'User updated successfully',
      data: { user: updatedUser }
    } as ApiResponse);

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as ApiResponse);
  }
};

export const deleteUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const currentUserRole = req.user?.role;
    const currentUserId = req.user?.id;

    // Only admin can delete users
    if (currentUserRole !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only feature.'
      } as ApiResponse);
    }

    // Don't allow admin to delete themselves
    if (id === currentUserId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      } as ApiResponse);
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      } as ApiResponse);
    }

    // Check if user has created issues
    const issuesCount = await prisma.issue.count({
      where: { createdById: id }
    });

    if (issuesCount > 0) {
      // Soft delete by deactivating instead of hard delete
      await prisma.user.update({
        where: { id },
        data: { isActive: false }
      });

      res.json({
        success: true,
        message: 'User account deactivated successfully (user has created issues)'
      } as ApiResponse);
    } else {
      // Hard delete if no issues
      await prisma.user.delete({
        where: { id }
      });

      res.json({
        success: true,
        message: 'User deleted successfully'
      } as ApiResponse);
    }

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as ApiResponse);
  }
};

export const getSupervisors = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supervisors = await prisma.user.findMany({
      where: {
        role: {
          in: ['SUPERVISOR', 'OFFICE', 'ADMIN']
        },
        isActive: true
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        _count: {
          select: {
            assignedIssues: {
              where: {
                status: {
                  in: ['PENDING', 'IN_PROGRESS']
                }
              }
            }
          }
        }
      },
      orderBy: [
        { role: 'asc' },
        { lastName: 'asc' }
      ]
    });

    res.json({
      success: true,
      message: 'Supervisors retrieved successfully',
      data: { supervisors }
    } as ApiResponse);

  } catch (error) {
    console.error('Get supervisors error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as ApiResponse);
  }
};