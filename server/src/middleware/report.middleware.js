const logger = require('../config/logger');
const { AuthorizationError, AuthenticationError } = require('./errorHandler');
const reportPermissionService = require('../services/reportPermission.service');

/**
 * Authorization middleware for report export
 * Allow export if:
 *  - user.role is in REPORT_EXPORT_ALLOWED_ROLES (default: manager,director,administrator)
 *  - OR user.employee_code is in REPORT_EXPORT_ALLOWED_EMPLOYEES (comma-separated)
 */
exports.authorizeReportExport = (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return next(new AuthenticationError('User authentication required'));
    }

    const allowedRoles = (process.env.REPORT_EXPORT_ALLOWED_ROLES || 'manager,director,administrator')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const allowedEmployees = (process.env.REPORT_EXPORT_ALLOWED_EMPLOYEES || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const isRoleAllowed = allowedRoles.includes(user.role);
    const isEmployeeWhitelisted = allowedEmployees.includes(user.employee_code);
    const fileWhitelist = reportPermissionService.getAllowedEmployees();
    const isFileWhitelisted = Array.isArray(fileWhitelist)
      ? fileWhitelist.includes(user.employee_code)
      : false;

    if (isRoleAllowed || isEmployeeWhitelisted || isFileWhitelisted) {
      return next();
    }

    logger.warn('Report export authorization denied', {
      user: user.employee_code,
      role: user.role,
      url: req.originalUrl,
      method: req.method,
    });
    return next(new AuthorizationError('Bạn không có quyền xuất báo cáo.'));
  } catch (error) {
    return next(new AuthorizationError('Authorization processing failed'));
  }
};

/**
 * Scope enforcement for report queries:
 * If user is role 'employee', force employeeCode filter to their own code.
 */
exports.enforceReportScope = (req, res, next) => {
  try {
    const user = req.user;
    if (user && user.role === 'employee') {
      // Force scoping to the logged-in employee
      req.query = {
        ...req.query,
        employeeCode: user.employee_code,
      };
    }
    next();
  } catch (_) {
    // Fail-open to avoid breaking requests for non-employee roles
    next();
  }
};

/**
 * Compute whether the given user is allowed to export reports
 * Matches the same logic as authorizeReportExport
 */
exports.isReportExportAllowed = (user) => {
  if (!user) return false;
  const allowedRoles = (process.env.REPORT_EXPORT_ALLOWED_ROLES || 'manager,director,administrator')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowedEmployees = (process.env.REPORT_EXPORT_ALLOWED_EMPLOYEES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const fileWhitelist = reportPermissionService.getAllowedEmployees();
  const isFileWhitelisted = Array.isArray(fileWhitelist)
    ? fileWhitelist.includes(user.employee_code)
    : false;
  return (
    allowedRoles.includes(user.role) ||
    allowedEmployees.includes(user.employee_code) ||
    isFileWhitelisted
  );
};


