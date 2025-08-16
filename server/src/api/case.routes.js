const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const passport = require('passport');
const caseController = require('../controllers/case.controller');
const { protect, authorize, authorizeByAnyPermissionOrRole, authorizeByPermissionOrRole } = require('../middleware/auth.middleware');
const { upload: uploadFileToDisk, uploadExcelInMemory } = require('../config/multer.config');

// Middleware để log request body cho debugging
const logRequestBody = (req, res, next) => {
  // Debug logging removed for production
  next();
};

// MỚI: Route để lấy danh sách hồ sơ của CBTD
// GET /api/cases/my-cases
router.get(
  '/my-cases',
  protect,
  authorizeByAnyPermissionOrRole(['view_own_cases', 'view_department_cases', 'view_all_cases'], 'employee', 'deputy_manager', 'manager', 'administrator', 'deputy_director', 'director'),
  caseController.getMyCases,
);

// MỚI: Route để lấy danh sách hồ sơ của một nhân viên cụ thể (cho delegation)
// GET /api/cases/by-employee/:employeeCode
router.get(
  '/by-employee/:employeeCode',
  protect,
  authorizeByAnyPermissionOrRole(['view_own_cases', 'view_department_cases', 'view_all_cases'], 'employee', 'deputy_manager', 'manager', 'administrator', 'deputy_director', 'director'),
  caseController.getCasesByEmployee,
);

// MỚI: Route để lấy tất cả danh sách hồ sơ (dành cho Ban Giám Đốc)
// GET /api/cases/all-cases
router.get(
  '/all-cases',
  protect,
  authorizeByAnyPermissionOrRole(['view_all_cases'], 'director', 'deputy_director', 'administrator', 'manager'), // Allow via permission or role
  caseController.getAllCases,
);

// MỚI: Route để lấy danh sách hồ sơ theo phòng ban (dành cho Manager/Deputy Manager)
// GET /api/cases/department-cases
router.get(
  '/department-cases',
  protect,
  authorizeByAnyPermissionOrRole(['view_department_cases', 'view_all_cases'], 'manager', 'deputy_manager', 'director', 'deputy_director', 'administrator'),
  caseController.getDepartmentCases,
);

router.post(
  '/import-internal',
  protect,
  authorizeByAnyPermissionOrRole(['import_internal_cases'], 'administrator', 'manager'),
  uploadExcelInMemory.single('casesFile'), // Middleware của multer, 'casesFile' là tên field trong form-data
  caseController.importCases,
);

router.post(
  '/import-external',
  protect,
  authorizeByAnyPermissionOrRole(['import_external_cases'], 'administrator', 'manager'),
  uploadExcelInMemory.single('casesFile'), // Middleware của multer, 'externalCasesFile' là tên field trong form-data
  caseController.importExternalCases,
);

router.get(
  '/contents/:caseId',
  protect,
  authorizeByAnyPermissionOrRole(
    ['view_own_cases', 'view_department_cases', 'view_all_cases'],
    'employee',
    'deputy_manager',
    'manager',
    'administrator',
    'deputy_director',
    'director',
  ),
  caseController.getCaseUpdateContent,
);

// Route để lấy danh sách updates của case
router.get(
  '/:caseId/updates',
  protect,
  authorizeByAnyPermissionOrRole(['view_own_cases', 'view_department_cases', 'view_all_cases'], 'employee', 'deputy_manager', 'manager', 'administrator', 'deputy_director', 'director'),
  caseController.getCaseUpdates,
);

router.post(
  '/:caseId/updates',
  protect, // Yêu cầu đăng nhập
  authorizeByAnyPermissionOrRole(
    ['edit_own_cases', 'edit_department_cases', 'edit_all_cases'],
    'employee',
    'deputy_manager',
    'manager',
    'administrator',
  ),
  body('content').notEmpty().withMessage('Nội dung cập nhật không được để trống.'), // Validation
  caseController.createCaseUpdate,
);

// Route để cập nhật trạng thái case
router.patch(
  '/:caseId/status',
  protect, // Yêu cầu đăng nhập
  authorizeByAnyPermissionOrRole(['update_own_case_status', 'edit_department_cases', 'edit_all_cases'], 'employee', 'deputy_manager', 'manager', 'administrator'),
  body('status')
    .isIn([
      'beingFollowedUp',
      'beingSued',
      'awaitingJudgmentEffect',
      'beingExecuted',
      'proactivelySettled',
      'debtSold',
      'amcHired',
    ])
    .withMessage('Trạng thái không hợp lệ.'),
  caseController.updateCaseStatus,
);

router.post(
  '/:caseId/documents',
  protect, // Yêu cầu đăng nhập
  authorizeByAnyPermissionOrRole(['upload_case_documents'], 'employee', 'deputy_manager', 'manager', 'administrator'),
  logRequestBody, // Debug middleware
  uploadFileToDisk.single('documentFile'), // Middleware của multer, 'documentFile' là tên field trong form-data
  caseController.uploadDocument,
);

// Route để lấy danh sách tài liệu của một case
router.get(
  '/:caseId/documents',
  protect, // Yêu cầu đăng nhập
  authorizeByAnyPermissionOrRole(['view_own_cases', 'view_department_cases', 'view_all_cases', 'preview_documents'], 'employee', 'deputy_manager', 'manager', 'administrator', 'deputy_director', 'director'),
  caseController.getCaseDocuments,
);

// Route để download tài liệu
router.get(
  '/documents/:documentId/download',
  protect, // Yêu cầu đăng nhập
  authorizeByAnyPermissionOrRole(['download_documents', 'view_own_cases', 'view_department_cases', 'view_all_cases'], 'employee', 'manager', 'administrator', 'deputy_manager', 'deputy_director', 'director'),
  caseController.downloadDocument,
);

// Route để xem trước tài liệu
router.get(
  '/documents/:documentId/preview',
  protect, // Yêu cầu đăng nhập
  authorizeByAnyPermissionOrRole(['preview_documents', 'view_own_cases', 'view_department_cases', 'view_all_cases'], 'employee', 'manager', 'administrator', 'deputy_manager', 'deputy_director', 'director'),
  caseController.previewDocument,
);

// Route để xóa tài liệu
router.delete(
  '/documents/:documentId',
  protect, // Yêu cầu đăng nhập
  authorizeByAnyPermissionOrRole(['delete_case_documents', 'edit_department_cases', 'edit_all_cases'], 'employee', 'deputy_manager', 'manager', 'administrator'),
  caseController.deleteDocument,
);

// Route để lấy cấu trúc thư mục của CBTD hiện tại
router.get(
  '/my-file-structure',
  protect,
  authorizeByAnyPermissionOrRole(['access_file_structure'], 'employee', 'deputy_manager', 'manager', 'administrator'),
  caseController.getMyFileStructure,
);

// Route để lấy thống kê storage (dành cho admin/manager)
router.get(
  '/storage-stats',
  protect,
  authorizeByAnyPermissionOrRole(['view_storage_stats'], 'manager', 'deputy_director', 'director', 'administrator'),
  caseController.getStorageStats,
);

// MỚI: Route để lấy thông tin tổng hợp của hồ sơ (details + updates + documents)
// GET /api/cases/:caseId/overview
router.get(
  '/:caseId/overview',
  protect,
  authorizeByAnyPermissionOrRole(['view_own_cases', 'view_department_cases', 'view_all_cases'], 'employee', 'deputy_manager', 'manager', 'administrator', 'deputy_director', 'director'),
  caseController.getCaseOverview,
);

// MỚI: Route để lấy danh sách hồ sơ của CBTD
// GET /api/cases/:caseId
router.get(
  '/:caseId',
  protect,
  authorizeByAnyPermissionOrRole(['view_own_cases', 'view_department_cases', 'view_all_cases'], 'employee', 'deputy_manager', 'manager', 'administrator', 'deputy_director', 'director'), // Các vai trò được phép truy cập
  caseController.getCaseDetails,
);

module.exports = router;
