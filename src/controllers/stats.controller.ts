import { Response } from 'express';
import { prisma } from '../config/database';
import { AuthenticatedRequest, ApiResponse } from '../types';

export const getDashboardStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      } as ApiResponse);
    }

    // Build where clause based on user role
    let whereClause: any = {};

    if (userRole === 'USER') {
      whereClause.createdById = userId;
    } else if (userRole === 'SUPERVISOR') {
      whereClause.OR = [
        { assignedToId: userId },
        { assignedToId: null },
        { createdById: userId }
      ];
    }
    // OFFICE and ADMIN can see all issues

    // Get basic stats
    const totalIssues = await prisma.issue.count({ where: whereClause });

    const statusStats = await prisma.issue.groupBy({
      by: ['status'],
      where: whereClause,
      _count: {
        status: true
      }
    });

    const priorityStats = await prisma.issue.groupBy({
      by: ['priority'],
      where: whereClause,
      _count: {
        priority: true
      }
    });

    const emergencyIssues = await prisma.issue.count({
      where: {
        ...whereClause,
        isEmergency: true
      }
    });

    // Get category stats
    const categoryStats = await prisma.issue.groupBy({
      by: ['categoryId'],
      where: whereClause,
      _count: {
        categoryId: true
      }
    });

    // Get category names
    const categoriesWithStats = await Promise.all(
      categoryStats.map(async (stat) => {
        const category = await prisma.category.findUnique({
          where: { id: stat.categoryId },
          select: { name: true, nameEn: true, color: true }
        });
        return {
          categoryId: stat.categoryId,
          categoryName: category?.name || 'Unknown',
          categoryNameEn: category?.nameEn,
          color: category?.color,
          count: stat._count.categoryId
        };
      })
    );

    // Recent issues (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentIssuesCount = await prisma.issue.count({
      where: {
        ...whereClause,
        createdAt: {
          gte: thirtyDaysAgo
        }
      }
    });

    // Completion stats (for staff only)
    let completionStats = null;
    if (userRole !== 'USER') {
      const completedThisMonth = await prisma.issue.count({
        where: {
          ...whereClause,
          status: 'COMPLETED',
          completedAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      });

      const totalPendingAndInProgress = await prisma.issue.count({
        where: {
          ...whereClause,
          status: {
            in: ['PENDING', 'IN_PROGRESS']
          }
        }
      });

      completionStats = {
        completedThisMonth,
        totalPendingAndInProgress
      };
    }

    // Monthly trend (last 6 months)
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const count = await prisma.issue.count({
        where: {
          ...whereClause,
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        }
      });

      monthlyTrend.push({
        month: date.toLocaleDateString('el-GR', { month: 'long', year: 'numeric' }),
        count
      });
    }

    const stats = {
      totalIssues,
      emergencyIssues,
      recentIssuesCount,
      statusStats: statusStats.map(stat => ({
        status: stat.status,
        count: stat._count.status
      })),
      priorityStats: priorityStats.map(stat => ({
        priority: stat.priority,
        count: stat._count.priority
      })),
      categoryStats: categoriesWithStats,
      completionStats,
      monthlyTrend
    };

    res.json({
      success: true,
      message: 'Dashboard statistics retrieved successfully',
      data: { stats }
    } as ApiResponse);

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as ApiResponse);
  }
};

export const getIssueStats = async (req: AuthenticatedRequest, res: Response) => {
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

    // Get issue with full details
    const issue = await prisma.issue.findUnique({
      where: { id },
      include: {
        category: true,
        subcategory: true,
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
        _count: {
          select: {
            photos: true,
            comments: true
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

    // Calculate time metrics
    const now = new Date();
    const daysSinceCreated = Math.floor((now.getTime() - issue.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    
    let daysToComplete = null;
    if (issue.completedAt) {
      daysToComplete = Math.floor((issue.completedAt.getTime() - issue.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Get estimated completion days from subcategory
    const estimatedDays = issue.subcategory?.estimatedDays || null;
    
    // Calculate if overdue (only for pending/in-progress issues)
    let isOverdue = false;
    if (estimatedDays && ['PENDING', 'IN_PROGRESS'].includes(issue.status)) {
      isOverdue = daysSinceCreated > estimatedDays;
    }

    const issueStats = {
      issue,
      metrics: {
        daysSinceCreated,
        daysToComplete,
        estimatedDays,
        isOverdue,
        photoCount: issue._count.photos,
        commentCount: issue._count.comments
      }
    };

    res.json({
      success: true,
      message: 'Issue statistics retrieved successfully',
      data: issueStats
    } as ApiResponse);

  } catch (error) {
    console.error('Get issue stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as ApiResponse);
  }
};