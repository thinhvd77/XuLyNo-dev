const express = require('express');
const router = express.Router();
const { authorize, protect, authorizeByAnyPermissionOrRole, authorizeByPermissionOrRole } = require('../middleware/auth.middleware');
const userController = require('../controllers/user.controller');
const {
  validate,
  createUserValidationRules,
  changePasswordSelfValidationRules,
  changePasswordAdminValidationRules,
  updateUserValidationRules,
} = require('../middleware/validator.middleware');

// Định nghĩa route: POST /api/users/create
router.post(
  '/create',
  protect, // 1. Yêu cầu đăng nhập
  authorizeByAnyPermissionOrRole(['create_users', 'manage_users'], 'administrator'),
  createUserValidationRules, // 3. Kiểm tra dữ liệu đầu vào
  validate, // 4. Validate the input
  userController.createUser, // 5. Xử lý logic
);

// Định nghĩa route: GET /api/users
router.get(
  '/',
  protect, // 1. Yêu cầu đăng nhập
  authorizeByAnyPermissionOrRole(['view_users', 'manage_users'], 'administrator', 'director', 'deputy_director'),
  userController.getAllUsers, // 3. Xử lý logic
);

// MỚI: Định nghĩa route để Trưởng/Phó phòng lấy danh sách nhân viên
// GET /api/users/managed-officers
router.get(
  '/managed',
  protect, // Yêu cầu đăng nhập
  authorizeByAnyPermissionOrRole(['view_users'], 'manager', 'deputy_manager'),
  userController.getManagedOfficers,
);

// Định nghĩa route: GET /api/users/employees-for-filter - Lấy danh sách nhân viên để filter
router.get(
  '/employees-for-filter',
  protect, // 1. Yêu cầu đăng nhập
  authorizeByAnyPermissionOrRole(
    ['view_users', 'manage_users', 'access_director_dashboard'],
    'director',
    'deputy_director',
    'administrator',
    'manager',
    'deputy_manager',
  ),
  userController.getEmployeesForFilter, // 3. Xử lý logic
);

// Định nghĩa route: GET /api/users/branches-for-filter - Lấy danh sách chi nhánh để filter
router.get(
  '/branches-for-filter',
  protect, // 1. Yêu cầu đăng nhập
  authorizeByAnyPermissionOrRole(
    ['view_users', 'manage_users', 'access_director_dashboard'],
    'director',
    'deputy_director',
    'administrator',
    'manager',
  ),
  userController.getBranchesForFilter, // 3. Xử lý logic
);

// Định nghĩa route: GET /api/users/departments-for-filter - Lấy danh sách phòng ban theo chi nhánh để filter
router.get(
  '/departments-for-filter',
  protect, // 1. Yêu cầu đăng nhập
  authorizeByAnyPermissionOrRole(
    ['view_users', 'manage_users', 'access_director_dashboard'],
    'director',
    'deputy_director',
    'administrator',
    'manager',
  ),
  userController.getDepartmentsForFilter, // 3. Xử lý logic
);

// Định nghĩa route: GET /api/users/:id
router.get(
  '/:id',
  protect, // 1. Yêu cầu đăng nhập
  authorize('administrator', 'director', 'deputy_director'), // 2. Yêu cầu vai trò là Administrator, Giám đốc hoặc Phó giám đốc
  userController.getUserById, // 3. Xử lý logic
);

// Định nghĩa route: PUT /api/users/:id - Update user
router.put(
  '/:id',
  protect, // 1. Yêu cầu đăng nhập
  authorizeByAnyPermissionOrRole(['edit_users', 'manage_users'], 'administrator'),
  updateUserValidationRules, // 3. Validation rules cho update
  validate, // 4. Validate the input
  userController.updateUser, // 5. Xử lý logic
);

// Định nghĩa route: PATCH /api/users/:id/status - Toggle user status (enable/disable)
router.patch(
  '/:id/status',
  protect, // 1. Yêu cầu đăng nhập
  authorizeByAnyPermissionOrRole(['edit_users', 'manage_users'], 'administrator'),
  userController.toggleUserStatus, // 3. Xử lý logic
);

// Định nghĩa route: PATCH /api/users/:id/change-password - Change user password (Admin only)
router.patch(
  '/:id/change-password',
  protect, // 1. Yêu cầu đăng nhập
  authorizeByAnyPermissionOrRole(['edit_users', 'manage_users'], 'administrator'),
  changePasswordAdminValidationRules, // 3. Validation (admin không cần oldPassword)
  validate, // 4. Validate the input
  userController.changeUserPassword, // 5. Xử lý logic
);

// Định nghĩa route: PATCH /api/users/change-my-password - Change own password
router.patch(
  '/change-my-password',
  protect, // 1. Yêu cầu đăng nhập
  changePasswordSelfValidationRules, // 2. Validation rules cho tự đổi mật khẩu (cần oldPassword)
  validate, // 3. Validate the input
  userController.changeMyPassword, // 4. Xử lý logic cho đổi mật khẩu của chính mình
);

router.delete(
  '/:id',
  protect, // 1. Yêu cầu đăng nhập
  authorizeByAnyPermissionOrRole(['delete_users', 'manage_users'], 'administrator'),
  userController.deleteUserById, // 3. Xử lý logic
);

// Định nghĩa route: GET /api/users/:userId/permissions - Get user permissions
router.get(
  '/:userId/permissions',
  protect, // 1. Yêu cầu đăng nhập
  authorizeByAnyPermissionOrRole(['view_permissions', 'manage_permissions'], 'administrator'),
  userController.getUserPermissions, // 3. Xử lý logic
);

// Định nghĩa route: PUT /api/users/:userId/permissions - Update user permissions
router.put(
  '/:userId/permissions',
  protect, // 1. Yêu cầu đăng nhập
  authorizeByAnyPermissionOrRole(['assign_permissions', 'revoke_permissions', 'manage_permissions'], 'administrator'),
  userController.updateUserPermissions, // 3. Xử lý logic
);

module.exports = router;
