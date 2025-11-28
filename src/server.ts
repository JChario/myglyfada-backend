import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Import routes
import authRoutes from './routes/auth.routes';
import issueRoutes from './routes/issue.routes';
import categoryRoutes from './routes/category.routes';
import photoRoutes from './routes/photo.routes';
import statsRoutes from './routes/stats.routes';
import excelRoutes from './routes/excel.routes';
import userRoutes from './routes/user.routes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  }
});
app.use('/api/', limiter);

// Manual CORS middleware for demo - Allow all origins
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Create uploads directory if it doesn't exist
const uploadsDir = process.env.UPLOAD_PATH || './uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve static files for uploaded images
app.use('/uploads', express.static(uploadsDir));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'myGlyfada API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/excel', excelRoutes);
app.use('/api/users', userRoutes);

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'myGlyfada Municipal Issue Tracking System API',
    version: '1.0.0',
    endpoints: {
      auth: {
        'POST /api/auth/login': 'User login',
        'POST /api/auth/register': 'User registration',
        'GET /api/auth/profile': 'Get user profile',
        'PUT /api/auth/profile': 'Update user profile',
        'PUT /api/auth/change-password': 'Change password'
      },
      issues: {
        'POST /api/issues': 'Create new issue',
        'GET /api/issues': 'Get issues with filtering',
        'GET /api/issues/:id': 'Get issue by ID',
        'PUT /api/issues/:id': 'Update issue',
        'DELETE /api/issues/:id': 'Delete issue'
      },
      categories: {
        'GET /api/categories': 'Get all categories',
        'GET /api/categories/:id': 'Get category by ID',
        'POST /api/categories': 'Create category (Admin only)',
        'PUT /api/categories/:id': 'Update category (Admin only)',
        'DELETE /api/categories/:id': 'Delete category (Admin only)',
        'POST /api/categories/subcategories': 'Create subcategory (Admin only)',
        'PUT /api/categories/subcategories/:id': 'Update subcategory (Admin only)',
        'DELETE /api/categories/subcategories/:id': 'Delete subcategory (Admin only)'
      },
      photos: {
        'POST /api/photos/issues/:issueId': 'Upload photos for issue',
        'GET /api/photos/:id': 'Get photo by ID',
        'PUT /api/photos/:id/description': 'Update photo description',
        'DELETE /api/photos/:id': 'Delete photo'
      },
      stats: {
        'GET /api/stats/dashboard': 'Get dashboard statistics',
        'GET /api/stats/issues/:id': 'Get issue statistics'
      },
      excel: {
        'GET /api/excel/export': 'Export issues to Excel (Staff only)',
        'POST /api/excel/import': 'Import issues from Excel (Admin only)'
      },
      users: {
        'GET /api/users': 'Get all users (Staff only)',
        'GET /api/users/supervisors': 'Get supervisors list',
        'GET /api/users/:id': 'Get user by ID',
        'POST /api/users': 'Create user (Admin only)',
        'PUT /api/users/:id': 'Update user (Admin only)',
        'DELETE /api/users/:id': 'Delete user (Admin only)'
      }
    },
    userRoles: {
      'ADMIN': 'System administrator - full access',
      'SUPERVISOR': 'Issue supervisor - can manage assigned issues',
      'OFFICE': 'Office staff - can view and manage all issues',
      'USER': 'Regular citizen - can create and manage own issues'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error handler:', error);
  
  // Multer file upload errors
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File too large. Maximum size is 5MB.'
    });
  }

  if (error.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({
      success: false,
      message: 'Too many files. Maximum 5 files allowed.'
    });
  }

  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      message: 'Unexpected file field.'
    });
  }

  // Default error response
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message || 'Something went wrong'
  });
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 myGlyfada API Server started');
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📖 API docs: http://localhost:${PORT}/api`);
  console.log('==================================================');
});

export default app;