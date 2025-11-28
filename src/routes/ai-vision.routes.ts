import { Router, Request, Response } from 'express';
import { authenticate, adminOnly } from '../middleware/auth';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../types';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_PATH || './uploads';
    const aiDir = path.join(uploadDir, 'ai-detections');
    if (!fs.existsSync(aiDir)) {
      fs.mkdirSync(aiDir, { recursive: true });
    }
    cb(null, aiDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'ai-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
});

/**
 * GET /api/ai-vision/detections
 * Get list of saved AI detections
 */
router.get('/detections', authenticate, adminOnly, async (req: Request, res: Response) => {
  try {
    // For now, we'll fetch from the AI Vision database directly
    // In production, you might want to sync or proxy to the AI Vision service

    const aiVisionUrl = process.env.AI_VISION_URL || 'http://localhost:8000';

    try {
      const response = await fetch(`${aiVisionUrl}/api/detections/recent?limit=50`);
      if (response.ok) {
        const data = await response.json();
        return res.json({
          success: true,
          data: {
            detections: data || []
          }
        });
      }
    } catch (fetchError) {
      console.log('Could not fetch from AI Vision service, returning empty list');
    }

    // Return empty list if AI Vision service is not available
    res.json({
      success: true,
      data: {
        detections: []
      }
    });

  } catch (error) {
    console.error('Error fetching AI detections:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch AI detections'
    });
  }
});

/**
 * POST /api/ai-vision/detections
 * Save an AI detection to the database
 */
router.post('/detections', authenticate, adminOnly, upload.single('image'), async (req: Request, res: Response) => {
  try {
    const { analysis_result } = req.body;
    const file = req.file;

    if (!analysis_result) {
      return res.status(400).json({
        success: false,
        message: 'Analysis result is required'
      });
    }

    const result = JSON.parse(analysis_result);

    // Build image URL
    const imageUrl = file
      ? `/uploads/ai-detections/${file.filename}`
      : result.image_path;

    // Get detection info
    const detection = result.detections?.[0];

    // Save to AI Vision service
    const aiVisionUrl = process.env.AI_VISION_URL || 'http://localhost:8000';

    try {
      // Forward to AI Vision for permanent storage
      const saveResponse = await fetch(`${aiVisionUrl}/api/detections/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          detection_id: result.id,
          image_path: imageUrl,
          sign_type: detection?.class_name || 'unknown',
          damage_type: detection?.damage_type || 'ok',
          severity: detection?.severity || 'LOW',
          confidence: detection?.confidence || 0,
          timestamp: result.timestamp
        })
      });

      if (saveResponse.ok) {
        const savedData = await saveResponse.json();
        return res.json({
          success: true,
          message: 'Detection saved successfully',
          data: savedData
        });
      }
    } catch (saveError) {
      console.log('Could not save to AI Vision service:', saveError);
    }

    // If AI Vision service save fails, still return success
    // (the detection was already stored during analysis)
    res.json({
      success: true,
      message: 'Detection recorded',
      data: {
        id: result.id,
        image_url: imageUrl,
        sign_type: detection?.class_name,
        damage_type: detection?.damage_type,
        severity: detection?.severity,
        timestamp: result.timestamp
      }
    });

  } catch (error) {
    console.error('Error saving AI detection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save AI detection'
    });
  }
});

/**
 * GET /api/ai-vision/stats
 * Get AI detection statistics
 */
router.get('/stats', authenticate, adminOnly, async (req: Request, res: Response) => {
  try {
    const aiVisionUrl = process.env.AI_VISION_URL || 'http://localhost:8000';

    try {
      const response = await fetch(`${aiVisionUrl}/api/detections/stats`);
      if (response.ok) {
        const stats = await response.json();
        return res.json({
          success: true,
          data: stats
        });
      }
    } catch (fetchError) {
      console.log('Could not fetch stats from AI Vision service');
    }

    // Return default stats
    res.json({
      success: true,
      data: {
        total_detections: 0,
        today_detections: 0,
        auto_reported_issues: 0,
        by_damage_type: {},
        by_severity: {},
        by_camera: {}
      }
    });

  } catch (error) {
    console.error('Error fetching AI stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch AI statistics'
    });
  }
});

export default router;
