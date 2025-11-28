import { Response } from 'express';
import { prisma } from '../config/database';
import { AuthenticatedRequest, ApiResponse } from '../types';
import fs from 'fs';
import path from 'path';

export const uploadPhotos = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { issueId } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      } as ApiResponse);
    }

    // Check if issue exists
    const issue = await prisma.issue.findUnique({
      where: { id: issueId }
    });

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: 'Issue not found'
      } as ApiResponse);
    }

    // Check permissions - users can only upload to their own issues
    if (userRole === 'USER' && issue.createdById !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      } as ApiResponse);
    }

    // Check if files were uploaded
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      } as ApiResponse);
    }

    // Get current photo count for this issue
    const currentPhotoCount = await prisma.photo.count({
      where: { issueId }
    });

    const maxPhotos = parseInt(process.env.MAX_PHOTOS_PER_ISSUE || '5');
    
    if (currentPhotoCount + files.length > maxPhotos) {
      // Delete uploaded files if limit exceeded
      files.forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (err) {
          console.error('Error deleting file:', err);
        }
      });

      return res.status(400).json({
        success: false,
        message: `Maximum ${maxPhotos} photos allowed per issue. Current: ${currentPhotoCount}`
      } as ApiResponse);
    }

    // Create photo records in database
    const photoData = files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      path: file.path,
      description: req.body.description || null,
      issueId,
      uploadedById: userId
    }));

    const photos = await prisma.photo.createMany({
      data: photoData
    });

    // Get the created photos with details
    const createdPhotos = await prisma.photo.findMany({
      where: { issueId, uploadedById: userId },
      orderBy: { createdAt: 'desc' },
      take: files.length,
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: `${files.length} photo(s) uploaded successfully`,
      data: { photos: createdPhotos }
    } as ApiResponse);

  } catch (error) {
    console.error('Upload photos error:', error);
    
    // Clean up uploaded files on error
    const files = req.files as Express.Multer.File[];
    if (files) {
      files.forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (err) {
          console.error('Error deleting file on error:', err);
        }
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as ApiResponse);
  }
};

export const getPhoto = async (req: AuthenticatedRequest, res: Response) => {
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

    // Get photo with issue information
    const photo = await prisma.photo.findUnique({
      where: { id },
      include: {
        issue: {
          select: {
            id: true,
            createdById: true
          }
        }
      }
    });

    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found'
      } as ApiResponse);
    }

    // Check permissions - users can only view photos of their own issues
    if (userRole === 'USER' && photo.issue.createdById !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      } as ApiResponse);
    }

    // Check if file exists
    if (!fs.existsSync(photo.path)) {
      return res.status(404).json({
        success: false,
        message: 'Photo file not found'
      } as ApiResponse);
    }

    // Set headers
    res.setHeader('Content-Type', photo.mimeType);
    res.setHeader('Content-Length', photo.size);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours

    // Send file
    res.sendFile(path.resolve(photo.path));

  } catch (error) {
    console.error('Get photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as ApiResponse);
  }
};

export const deletePhoto = async (req: AuthenticatedRequest, res: Response) => {
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

    // Get photo with issue information
    const photo = await prisma.photo.findUnique({
      where: { id },
      include: {
        issue: {
          select: {
            id: true,
            createdById: true
          }
        }
      }
    });

    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found'
      } as ApiResponse);
    }

    // Check permissions
    const canDelete = 
      userRole === 'ADMIN' || 
      photo.uploadedById === userId ||
      (userRole === 'USER' && photo.issue.createdById === userId);

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      } as ApiResponse);
    }

    // Delete photo from database
    await prisma.photo.delete({
      where: { id }
    });

    // Delete file from filesystem
    try {
      if (fs.existsSync(photo.path)) {
        fs.unlinkSync(photo.path);
      }
    } catch (err) {
      console.error('Error deleting photo file:', err);
      // Continue even if file deletion fails
    }

    res.json({
      success: true,
      message: 'Photo deleted successfully'
    } as ApiResponse);

  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as ApiResponse);
  }
};

export const updatePhotoDescription = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { description } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      } as ApiResponse);
    }

    // Get photo with issue information
    const photo = await prisma.photo.findUnique({
      where: { id },
      include: {
        issue: {
          select: {
            id: true,
            createdById: true
          }
        }
      }
    });

    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found'
      } as ApiResponse);
    }

    // Check permissions
    const canUpdate = 
      userRole === 'ADMIN' || 
      userRole === 'SUPERVISOR' ||
      userRole === 'OFFICE' ||
      photo.uploadedById === userId ||
      (userRole === 'USER' && photo.issue.createdById === userId);

    if (!canUpdate) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      } as ApiResponse);
    }

    // Update description
    const updatedPhoto = await prisma.photo.update({
      where: { id },
      data: { description },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Photo description updated successfully',
      data: { photo: updatedPhoto }
    } as ApiResponse);

  } catch (error) {
    console.error('Update photo description error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as ApiResponse);
  }
};