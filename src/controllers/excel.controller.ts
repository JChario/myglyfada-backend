import { Response } from 'express';
import { prisma } from '../config/database';
import { AuthenticatedRequest, ApiResponse } from '../types';
import ExcelJS from 'exceljs';

export const exportIssues = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      } as ApiResponse);
    }

    // Only allow staff to export
    if (userRole === 'USER') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Staff only feature.'
      } as ApiResponse);
    }

    const {
      status,
      priority,
      categoryId,
      subcategoryId,
      dateFrom,
      dateTo,
      isEmergency
    } = req.query;

    // Build where clause
    let where: any = {};

    if (status) {
      where.status = { in: Array.isArray(status) ? status : [status] };
    }

    if (priority) {
      where.priority = { in: Array.isArray(priority) ? priority : [priority] };
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (subcategoryId) {
      where.subcategoryId = subcategoryId;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo as string);
      }
    }

    if (isEmergency !== undefined) {
      where.isEmergency = isEmergency === 'true';
    }

    // Get issues
    const issues = await prisma.issue.findMany({
      where,
      include: {
        category: {
          select: {
            name: true,
            nameEn: true
          }
        },
        subcategory: {
          select: {
            name: true,
            nameEn: true
          }
        },
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true
          }
        },
        assignedTo: {
          select: {
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
      },
      orderBy: { createdAt: 'desc' }
    });

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Αναφορές Βλαβών');

    // Set column headers
    worksheet.columns = [
      { header: 'Αρ. Αναφοράς', key: 'referenceNumber', width: 15 },
      { header: 'Τίτλος', key: 'title', width: 30 },
      { header: 'Περιγραφή', key: 'description', width: 40 },
      { header: 'Διεύθυνση', key: 'address', width: 30 },
      { header: 'Κατηγορία', key: 'category', width: 20 },
      { header: 'Υποκατηγορία', key: 'subcategory', width: 20 },
      { header: 'Κατάσταση', key: 'status', width: 15 },
      { header: 'Προτεραιότητα', key: 'priority', width: 15 },
      { header: 'Επείγον', key: 'isEmergency', width: 10 },
      { header: 'Δημιουργός', key: 'createdBy', width: 25 },
      { header: 'Email Δημιουργού', key: 'createdByEmail', width: 25 },
      { header: 'Τηλέφωνο Δημιουργού', key: 'createdByPhone', width: 20 },
      { header: 'Ανατέθηκε σε', key: 'assignedTo', width: 25 },
      { header: 'Ημερομηνία Δημιουργίας', key: 'createdAt', width: 20 },
      { header: 'Ημερομηνία Ολοκλήρωσης', key: 'completedAt', width: 20 },
      { header: 'Φωτογραφίες', key: 'photoCount', width: 15 },
      { header: 'Σχόλια', key: 'commentCount', width: 15 },
      { header: 'Γεωγραφικό Πλάτος', key: 'latitude', width: 18 },
      { header: 'Γεωγραφικό Μήκος', key: 'longitude', width: 18 }
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add data rows
    issues.forEach((issue, index) => {
      const row = worksheet.addRow({
        referenceNumber: issue.referenceNumber,
        title: issue.title,
        description: issue.description,
        address: issue.address,
        category: issue.category.name,
        subcategory: issue.subcategory?.name || '',
        status: translateStatus(issue.status),
        priority: translatePriority(issue.priority),
        isEmergency: issue.isEmergency ? 'Ναι' : 'Όχι',
        createdBy: `${issue.createdBy.firstName} ${issue.createdBy.lastName}`,
        createdByEmail: issue.createdBy.email,
        createdByPhone: issue.createdBy.phone || '',
        assignedTo: issue.assignedTo 
          ? `${issue.assignedTo.firstName} ${issue.assignedTo.lastName}` 
          : '',
        createdAt: issue.createdAt.toLocaleDateString('el-GR'),
        completedAt: issue.completedAt?.toLocaleDateString('el-GR') || '',
        photoCount: issue._count.photos,
        commentCount: issue._count.comments,
        latitude: issue.latitude || '',
        longitude: issue.longitude || ''
      });

      // Color code emergency issues
      if (issue.isEmergency) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFEBEE' }
        };
      }

      // Color code by status
      if (issue.status === 'COMPLETED') {
        row.getCell('status').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE8F5E8' }
        };
      } else if (issue.status === 'IN_PROGRESS') {
        row.getCell('status').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFF3E0' }
        };
      }
    });

    // Add summary at the bottom
    const summaryStartRow = worksheet.rowCount + 3;
    
    worksheet.mergeCells(`A${summaryStartRow}:C${summaryStartRow}`);
    const summaryHeaderCell = worksheet.getCell(`A${summaryStartRow}`);
    summaryHeaderCell.value = 'ΣΥΝΟΨΗ ΑΝΑΦΟΡΑΦ';
    summaryHeaderCell.font = { bold: true, size: 14 };
    summaryHeaderCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD0D0D0' }
    };

    // Status summary
    const statusCounts = issues.reduce((acc, issue) => {
      acc[issue.status] = (acc[issue.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    let currentRow = summaryStartRow + 1;
    worksheet.getCell(`A${currentRow}`).value = 'Σύνολο Αναφορών:';
    worksheet.getCell(`B${currentRow}`).value = issues.length;
    
    currentRow++;
    Object.entries(statusCounts).forEach(([status, count]) => {
      worksheet.getCell(`A${currentRow}`).value = `${translateStatus(status)}:`;
      worksheet.getCell(`B${currentRow}`).value = count;
      currentRow++;
    });

    // Emergency count
    const emergencyCount = issues.filter(i => i.isEmergency).length;
    worksheet.getCell(`A${currentRow}`).value = 'Επείγοντα:';
    worksheet.getCell(`B${currentRow}`).value = emergencyCount;

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `myGlyfada_Issues_Export_${timestamp}.xlsx`;

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Export issues error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as ApiResponse);
  }
};

export const importIssues = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      } as ApiResponse);
    }

    // Only admins can import
    if (userRole !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only feature.'
      } as ApiResponse);
    }

    // Check if file was uploaded
    const file = req.file;
    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No Excel file uploaded'
      } as ApiResponse);
    }

    // Read Excel file
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(file.path);
    const worksheet = workbook.getWorksheet(1);

    if (!worksheet) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Excel file format'
      } as ApiResponse);
    }

    const importResults = {
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Process each row (skip header)
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      
      try {
        const title = row.getCell(1).text;
        const description = row.getCell(2).text;
        const address = row.getCell(3).text;
        const categoryName = row.getCell(4).text;
        
        if (!title || !description || !address || !categoryName) {
          importResults.errors.push(`Row ${rowNumber}: Missing required fields`);
          importResults.failed++;
          continue;
        }

        // Find category
        const category = await prisma.category.findFirst({
          where: { name: categoryName, isActive: true }
        });

        if (!category) {
          importResults.errors.push(`Row ${rowNumber}: Category '${categoryName}' not found`);
          importResults.failed++;
          continue;
        }

        // Create issue
        await prisma.issue.create({
          data: {
            title,
            description,
            address,
            categoryId: category.id,
            createdById: userId,
            referenceNumber: `GLY-IMP-${Date.now()}-${rowNumber}`
          }
        });

        importResults.successful++;

      } catch (error) {
        importResults.errors.push(`Row ${rowNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        importResults.failed++;
      }
    }

    res.json({
      success: true,
      message: 'Import completed',
      data: importResults
    } as ApiResponse);

  } catch (error) {
    console.error('Import issues error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as ApiResponse);
  }
};

function translateStatus(status: string): string {
  const translations = {
    'PENDING': 'Εκκρεμή',
    'IN_PROGRESS': 'Σε εξέλιξη',
    'COMPLETED': 'Ολοκληρωμένα',
    'REJECTED': 'Απορριφθέντα',
    'CANCELLED': 'Ακυρωμένα'
  };
  return translations[status as keyof typeof translations] || status;
}

function translatePriority(priority: string): string {
  const translations = {
    'LOW': 'Χαμηλή',
    'MEDIUM': 'Μεσαία',
    'HIGH': 'Υψηλή',
    'EMERGENCY': 'Επείγον'
  };
  return translations[priority as keyof typeof translations] || priority;
}