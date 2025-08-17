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
 * Only apply employee scoping if user doesn't have broader permissions
 */
exports.enforceReportScope = async (req, res, next) => {
  try {
    const user = req.user;
    if (user && user.role === 'employee') {
      // Check if user has broader permissions before enforcing scope
      const permissionService = require('../services/permission.service');
      const userPermissions = await permissionService.getUserPermissions(user);
      
      // Only enforce employee scope if user doesn't have department or all-case permissions
      if (!userPermissions.view_department_cases && 
          !userPermissions.view_all_cases && 
          !userPermissions.export_department_data && 
          !userPermissions.export_all_data &&
          !userPermissions.export_department_cases &&
          !userPermissions.export_all_cases) {
        // Force scoping to the logged-in employee
        req.query = {
          ...req.query,
          employeeCode: user.employee_code,
        };
      }
    }
    next();
  } catch (error) {
    // Fail-open to avoid breaking requests for non-employee roles
    next();
  }
};

/**
 * Compute whether the given user is allowed to export reports
 * Matches the same logic as authorizeReportExport
 */
exports.isReportExportAllowed = (user) => {
  // Default access for certain roles/departments
  if (
    user.role === 'administrator' ||
    user.dept === 'KH&QLRR'
  ) {
    return true;
  }
  
  // Check for new permissions from DB
  if (user.permissions && user.permissions._db) {
    if (
      user.permissions._db.export_all_data || 
      user.permissions._db.export_department_data ||
      user.permissions._db.export_report
    ) {
      return true;
    }
  }
  
  // Fallback to allowlist
  return reportPermissionService.isEmployeeAllowed(user.employee_code);
};


