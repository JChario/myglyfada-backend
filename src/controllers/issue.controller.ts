import { Response } from 'express';
import { prisma } from '../config/database';
import { generateReferenceNumber } from '../utils/auth';
import { AuthenticatedRequest, CreateIssueRequest, UpdateIssueRequest, FilterOptions, ApiResponse } from '../types';

export const createIssue = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      } as ApiResponse);
    }

    const {
      title,
      description,
      address,
      latitude,
      longitude,
      categoryId,
      subcategoryId,
      priority = 'MEDIUM',
      isEmergency = false
    }: CreateIssueRequest = req.body;

    // Verify category exists
    const category = await prisma.category.findUnique({
      where: { id: categoryId, isActive: true }
    });

    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category'
      } as ApiResponse);
    }

    // Verify subcategory if provided
    if (subcategoryId) {
      const subcategory = await prisma.subcategory.findFirst({
        where: { 
          id: subcategoryId,
          categoryId,
          isActive: true
        }
      });

      if (!subcategory) {
        return res.status(400).json({
          success: false,
          message: 'Invalid subcategory'
        } as ApiResponse);
      }
    }

    // Generate reference number
    const referenceNumber = generateReferenceNumber();

    // Create issue
    const issue = await prisma.issue.create({
      data: {
        title,
        description,
        address,
        latitude,
        longitude,
        categoryId,
        subcategoryId,
        priority: isEmergency ? 'EMERGENCY' : priority,
        isEmergency,
        referenceNumber,
        createdById: userId
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            nameEn: true,
            color: true,
            icon: true
          }
        },
        subcategory: {
          select: {
            id: true,
            name: true,
            nameEn: true,
            color: true,
            icon: true,
            estimatedDays: true
          }
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Issue created successfully',
      data: { issue }
    } as ApiResponse);

  } catch (error) {
    console.error('Create issue error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as ApiResponse);
  }
};

export const getIssues = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      } as ApiResponse);
    }

    const {
      status,
      priority,
      categoryId,
      subcategoryId,
      assignedToId,
      createdById,
      dateFrom,
      dateTo,
      isEmergency,
      search,
      page = 1,
      limit = 20
    }: FilterOptions = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    // Build where clause based on user role
    let where: any = {};

    // Role-based filtering
    if (userRole === 'USER') {
      // Users can only see their own issues
      where.createdById = userId;
    } else if (userRole === 'SUPERVISOR') {
      // Supervisors can see issues assigned to them or unassigned
      where.OR = [
        { assignedToId: userId },
        { assignedToId: null },
        { createdById: userId }
      ];
    } else if (userRole === 'OFFICE') {
      // Office users can see all issues
      // No additional restrictions
    } else if (userRole === 'ADMIN') {
      // Admins can see everything
      // No additional restrictions
    }

    // Apply filters
    if (status && status.length > 0) {
      where.status = { in: status };
    }

    if (priority && priority.length > 0) {
      where.priority = { in: priority };
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (subcategoryId) {
      where.subcategoryId = subcategoryId;
    }

    if (assignedToId && (userRole === 'ADMIN' || userRole === 'SUPERVISOR' || userRole === 'OFFICE')) {
      where.assignedToId = assignedToId;
    }

    if (createdById && (userRole === 'ADMIN' || userRole === 'SUPERVISOR' || userRole === 'OFFICE')) {
      where.createdById = createdById;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo);
      }
    }

    if (isEmergency !== undefined) {
      where.isEmergency = String(isEmergency) === 'true';
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { referenceNumber: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Get total count
    const total = await prisma.issue.count({ where });

    // Get issues
    const issues = await prisma.issue.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: [
        { isEmergency: 'desc' },
        { createdAt: 'desc' }
      ],
      include: {
        category: {
          select: {
            id: true,
            name: true,
            nameEn: true,
            color: true,
            icon: true
          }
        },
        subcategory: {
          select: {
            id: true,
            name: true,
            nameEn: true,
            color: true,
            icon: true,
            estimatedDays: true
          }
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        photos: {
          select: {
            id: true,
            filename: true,
            originalName: true,
            description: true
          }
        },
        _count: {
          select: {
            comments: true
          }
        }
      }
    });

    const pagination = {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit))
    };

    res.json({
      success: true,
      message: 'Issues retrieved successfully',
      data: { issues },
      pagination
    } as ApiResponse);

  } catch (error) {
    console.error('Get issues error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as ApiResponse);
  }
};

export const getIssueById = async (req: AuthenticatedRequest, res: Response) => {
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

    const issue = await prisma.issue.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            nameEn: true,
            color: true,
            icon: true
          }
        },
        subcategory: {
          select: {
            id: true,
            name: true,
            nameEn: true,
            color: true,
            icon: true,
            estimatedDays: true
          }
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        photos: {
          select: {
            id: true,
            filename: true,
            originalName: true,
            description: true,
            createdAt: true,
            uploadedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        comments: {
          where: userRole === 'USER' ? { isInternal: false } : {},
          orderBy: { createdAt: 'desc' },
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true
              }
            }
          }
        }
      }
    });

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: 'Issue not found'
      } as ApiResponse);
    }

    // Check permissions
    if (userRole === 'USER' && issue.createdById !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      } as ApiResponse);
    }

    res.json({
      success: true,
      message: 'Issue retrieved successfully',
      data: { issue }
    } as ApiResponse);

  } catch (error) {
    console.error('Get issue by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as ApiResponse);
  }
};

export const updateIssue = async (req: AuthenticatedRequest, res: Response) => {
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

    const updateData: UpdateIssueRequest = req.body;

    // Get current issue to check permissions
    const currentIssue = await prisma.issue.findUnique({
      where: { id }
    });

    if (!currentIssue) {
      return res.status(404).json({
        success: false,
        message: 'Issue not found'
      } as ApiResponse);
    }

    // Check permissions
    let canUpdate = false;
    let allowedFields: string[] = [];

    if (userRole === 'USER' && currentIssue.createdById === userId) {
      // Users can only update their own issues and only certain fields
      canUpdate = true;
      allowedFields = ['title', 'description', 'address', 'latitude', 'longitude'];
    } else if (userRole === 'SUPERVISOR' || userRole === 'OFFICE' || userRole === 'ADMIN') {
      // Staff can update any issue
      canUpdate = true;
      allowedFields = ['title', 'description', 'address', 'latitude', 'longitude', 'status', 'priority', 'assignedToId', 'categoryId', 'subcategoryId', 'isEmergency'];
    }

    if (!canUpdate) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      } as ApiResponse);
    }

    // Filter update data based on allowed fields
    const filteredUpdateData: any = {};
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredUpdateData[key] = updateData[key as keyof UpdateIssueRequest];
      }
    });

    // Update completed date if status changes to COMPLETED
    if (filteredUpdateData.status === 'COMPLETED' && currentIssue.status !== 'COMPLETED') {
      filteredUpdateData.completedAt = new Date();
    }

    // Update issue
    const updatedIssue = await prisma.issue.update({
      where: { id },
      data: filteredUpdateData,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            nameEn: true,
            color: true,
            icon: true
          }
        },
        subcategory: {
          select: {
            id: true,
            name: true,
            nameEn: true,
            color: true,
            icon: true,
            estimatedDays: true
          }
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Issue updated successfully',
      data: { issue: updatedIssue }
    } as ApiResponse);

  } catch (error) {
    console.error('Update issue error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as ApiResponse);
  }
};

export const deleteIssue = async (req: AuthenticatedRequest, res: Response) => {
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

    // Get issue to check permissions
    const issue = await prisma.issue.findUnique({
      where: { id }
    });

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: 'Issue not found'
      } as ApiResponse);
    }

    // Check permissions - only admins and issue creators can delete
    const canDelete = userRole === 'ADMIN' || (userRole === 'USER' && issue.createdById === userId);

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      } as ApiResponse);
    }

    // Delete issue (cascade will handle photos and comments)
    await prisma.issue.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Issue deleted successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('Delete issue error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as ApiResponse);
  }
};