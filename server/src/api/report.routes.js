const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { protect, authorize, authorizeReportAccess, authorizeByAnyPermissionOrRole } = require('../middleware/auth.middleware');
const { authorizeReportExport, enforceReportScope } = require('../middleware/report.middleware');

// Bảo vệ tất cả routes bằng authentication
router.use(protect);

// GET /api/report/data - Lấy dữ liệu báo cáo (scope employee to own cases)
router.get('/data', enforceReportScope, reportController.getReportData);

// GET /api/report/export - Xuất báo cáo Excel (restricted + scoped)
router.get('/export', authorizeReportAccess, authorizeByAnyPermissionOrRole(['export_reports'], 'manager', 'director', 'administrator'), authorizeReportExport, reportController.exportReport);

// GET /api/report/export-latest-updates - Xuất báo cáo chi tiết (restricted)
router.get('/export-latest-updates', authorizeByAnyPermissionOrRole(['export_reports'], 'manager', 'director', 'administrator'), authorizeReportExport, reportController.exportLatestDateUpdatesReport);

// GET /api/report/filters - Lấy danh sách options cho filter (scope employee)
router.get('/filters', enforceReportScope, reportController.getFilterOptions);

// GET /api/report/employees-by-branch - Lấy danh sách nhân viên theo chi nhánh (scope employee)
router.get('/employees-by-branch', enforceReportScope, reportController.getEmployeesByBranch);

// GET /api/report/can-export - Kiểm tra quyền xuất báo cáo (cho client ẩn/hiện menu)
router.get('/can-export', (req, res) => reportController.getExportPermission(req, res));

// Admin-only endpoints to manage export whitelist
router.get('/export-whitelist', authorize('administrator'), reportController.getExportWhitelist);
router.post('/export-whitelist', authorize('administrator'), reportController.allowEmployeeExport);
router.delete(
  '/export-whitelist/:employeeCode',
  authorize('administrator'),
  reportController.disallowEmployeeExport,
);

module.exports = router;
