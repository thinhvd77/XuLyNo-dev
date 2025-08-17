const AppDataSource = require('../config/dataSource');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { normalizeStatus, normalizeCaseType } = require('../constants/caseConstants');
const reportService = require('../services/report.service');
const { isReportExportAllowed } = require('../middleware/report.middleware');
const reportPermissionService = require('../services/reportPermission.service');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const permissionService = require('../services/permission.service');

/**
 * Get report data
 * GET /api/report/data
 */
exports.getReportData = asyncHandler(async (req, res) => {
  const reportData = await reportService.getReportData(req.query, req.user);
  res.json({
    success: true,
    data: reportData,
  });
});

/**
 * Get available filter options
 * GET /api/report/filters
 */
exports.getFilterOptions = asyncHandler(async (req, res) => {
  // Filter options depend on user's role and permissions
  const { role, dept, employee_code } = req.user;

  // Get options from report service
  const options = await reportService.getFilterOptions(req.user);

  res.json({
    success: true,
    data: options,
  });
});

/**
 * Get employees by branch for report filters
 * GET /api/report/employees-by-branch
 */
exports.getEmployeesByBranch = asyncHandler(async (req, res) => {
  const { branch } = req.query;
  
  if (!branch) {
    throw new ValidationError('Branch code is required');
  }

  const employees = await reportService.getEmployeesByBranch(branch, req.user);
  
  res.json({
    success: true,
    data: employees,
  });
});

/**
 * Export report as Excel file
 * GET /api/report/export
 */
exports.exportReport = asyncHandler(async (req, res) => {
  // Check permission using new system
  const userPermissions = await permissionService.getUserPermissions(req.user);
    
  const hasExportPermission = 
    userPermissions.export_case_data || 
    userPermissions.export_department_data || 
    userPermissions.export_all_data ||
    reportPermissionService.hasExportReportPermission(req.user);

  if (!hasExportPermission) {
    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền xuất báo cáo'
    });
  }
  
  const { filePath, fileName, rowCount } = await reportService.generateSummaryReportFile(
    req.query,
    req.user
  );

  // Send file to client
  res.download(filePath, fileName, (err) => {
    if (err) {
      console.error('Error sending report file:', err);
    }

    // Delete the temporary file after download
    fs.unlink(filePath, (unlinkErr) => {
      if (unlinkErr) {
        console.error('Error deleting temporary report file:', unlinkErr);
      }
    });
  });
});

/**
 * Export latest date updates report
 * GET /api/report/export-latest-updates
 */
exports.exportLatestDateUpdatesReport = asyncHandler(async (req, res) => {
  // Generate the report
  const { filePath, fileName } = await reportService.generateLatestDateReport(req.query, req.user);

  // Send file to client
  res.download(filePath, fileName, (err) => {
    if (err) {
      console.error('Error sending latest date report file:', err);
    }

    // Delete the temporary file after download
    fs.unlink(filePath, (unlinkErr) => {
      if (unlinkErr) {
        console.error('Error deleting temporary report file:', unlinkErr);
      }
    });
  });
});

/**
 * Check if user can export reports
 * GET /api/report/can-export
 */
exports.getExportPermission = asyncHandler(async (req, res) => {
  const canExport = reportPermissionService.hasExportReportPermission(req.user);
  res.json({ canExport });
});

/**
 * Get report export allowlist
 * GET /api/report/export-whitelist
 * Admin only
 */
exports.getExportWhitelist = asyncHandler(async (req, res) => {
  const allowlist = reportPermissionService.getAllowedEmployees();
  res.json({
    success: true,
    data: allowlist,
  });
});

/**
 * Add employee to report export allowlist
 * POST /api/report/export-whitelist
 * Admin only
 */
exports.allowEmployeeExport = asyncHandler(async (req, res) => {
  const { employeeCode } = req.body;
  
  if (!employeeCode) {
    throw new ValidationError('Employee code is required');
  }

  const success = reportPermissionService.allowEmployee(employeeCode);
  
  if (success) {
    res.json({
      success: true,
      message: `Employee ${employeeCode} has been added to the export allowlist`,
    });
  } else {
    throw new Error('Failed to add employee to allowlist');
  }
});

/**
 * Remove employee from report export allowlist
 * DELETE /api/report/export-whitelist/:employeeCode
 * Admin only
 */
exports.disallowEmployeeExport = asyncHandler(async (req, res) => {
  const { employeeCode } = req.params;
  
  if (!employeeCode) {
    throw new ValidationError('Employee code is required');
  }

  const success = reportPermissionService.disallowEmployee(employeeCode);
  
  if (success) {
    res.json({
      success: true,
      message: `Employee ${employeeCode} has been removed from the export allowlist`,
    });
  } else {
    throw new Error('Failed to remove employee from allowlist');
  }
});
