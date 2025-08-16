const { validationResult, body } = require('express-validator');
const { ValidationError } = require('./errorHandler');
const { ALL_ROLES } = require('../constants/roleConstants');
const { ALL_DEPARTMENTS } = require('../constants/departmentConstants');

/**
 * Middleware to check validation results
 */
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  throw new ValidationError('Invalid input data', errors.array());
};

/**
 * Validation rules for creating a user
 */
exports.createUserValidationRules = [
  body('employee_code').notEmpty().withMessage('Mã nhân viên là bắt buộc.'),
  body('username').isLength({ min: 4 }).withMessage('Tên đăng nhập phải có ít nhất 4 ký tự.'),
  body('password').isLength({ min: 6 }).withMessage('Mật khẩu phải có ít nhất 6 ký tự.'),
  body('fullname').notEmpty().withMessage('Họ và tên là bắt buộc.'),
  body('branch_code').notEmpty().withMessage('Mã chi nhánh là bắt buộc.'),
  body('dept').isIn(ALL_DEPARTMENTS).withMessage('Phòng ban không hợp lệ.'),
  body('role').isIn(ALL_ROLES).withMessage('Vai trò không hợp lệ.'),
];

/**
 * Validation rules for changing password
 */
// Self password change (user changing own password) requires oldPassword + newPassword
exports.changePasswordSelfValidationRules = [
  body('newPassword').isLength({ min: 6 }).withMessage('Mật khẩu mới phải có ít nhất 6 ký tự.'),
  body('oldPassword').notEmpty().withMessage('Mật khẩu hiện tại không được để trống.'),
];

// Admin changing another user's password requires only newPassword
exports.changePasswordAdminValidationRules = [
  body('newPassword').isLength({ min: 6 }).withMessage('Mật khẩu mới phải có ít nhất 6 ký tự.'),
];

/**
 * Validation rules for updating a user
 */
exports.updateUserValidationRules = [
  body('employee_code').optional().notEmpty().withMessage('Mã nhân viên không được để trống.'),
  body('username')
    .optional()
    .isLength({ min: 4 })
    .withMessage('Tên đăng nhập phải có ít nhất 4 ký tự.'),
  body('password').optional().isLength({ min: 6 }).withMessage('Mật khẩu phải có ít nhất 6 ký tự.'),
  body('fullname').optional().notEmpty().withMessage('Họ và tên không được để trống.'),
  body('dept').optional().isIn(ALL_DEPARTMENTS).withMessage('Phòng ban không hợp lệ.'),
  body('role').optional().isIn(ALL_ROLES).withMessage('Vai trò không hợp lệ.'),
];
