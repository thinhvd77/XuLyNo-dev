const passport = require('passport');
const logger = require('../config/logger');
const { AuthenticationError, AuthorizationError } = require('./errorHandler');
const reportPermissionService = require('../services/reportPermission.service');
const { getUserPermissions } = require('../services/permission.service');

// Middleware để xác thực token JWT với error handling
exports.protect = (req, res, next) => {
  const clientIP =
    req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
    'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';

  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    try {
      if (err) {
        logger.error('Passport authentication error:', {
          error: err.message,
          ip: clientIP,
          userAgent,
          url: req.originalUrl,
          method: req.method,
        });
        return next(new AuthenticationError('Authentication failed'));
      }

      if (!user) {
        logger.warn('Authentication failed - no user found:', {
          url: req.originalUrl,
          method: req.method,
          ip: clientIP,
          userAgent,
          info: info?.message,
          timestamp: new Date().toISOString(),
        });
        return next(new AuthenticationError('Invalid or expired token'));
      }

      // Additional user validation
      if (!user.employee_code || !user.role) {
        logger.error('Invalid user object from JWT:', {
          user,
          ip: clientIP,
          userAgent,
          url: req.originalUrl,
        });
        return next(new AuthenticationError('Invalid user credentials'));
      }

      // ADD SECURITY CHECK: Verify user account status
      if (user.status !== 'active') {
        logger.warn(`Login attempt from disabled account: ${user.employee_code}`, {
          url: req.originalUrl,
          method: req.method,
          ip: clientIP,
          userAgent,
          status: user.status,
          timestamp: new Date().toISOString(),
        });
        return next(new AuthorizationError('Your account has been disabled.'));
      }

      req.user = user;
      logger.debug(`User authenticated: ${user.employee_code}`, {
        ip: clientIP,
        userAgent,
        url: req.originalUrl,
        method: req.method,
      });
      next();
    } catch (error) {
      logger.error('Error in protect middleware:', error);
      next(new AuthenticationError('Authentication processing failed'));
    }
  })(req, res, next);
};

// Middleware để kiểm tra vai trò người dùng với enhanced error handling
exports.authorize = (...roles) => {
  return (req, res, next) => {
    const clientIP =
      req.ip ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
      'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    try {
      if (!req.user) {
        logger.error('Authorization check failed - no user in request', {
          ip: clientIP,
          userAgent,
          url: req.originalUrl,
          method: req.method,
        });
        return next(new AuthenticationError('User authentication required'));
      }

      if (!req.user.role) {
        logger.error('Authorization check failed - no role in user object:', {
          user: req.user,
          ip: clientIP,
          userAgent,
          url: req.originalUrl,
        });
        return next(new AuthenticationError('User role not found'));
      }

      if (!Array.isArray(roles) || roles.length === 0) {
        logger.error('Authorization middleware misconfigured - no roles specified', {
          ip: clientIP,
          userAgent,
          url: req.originalUrl,
        });
        return next(new Error('Authorization configuration error'));
      }

      if (!roles.includes(req.user.role)) {
        logger.warn('Authorization denied:', {
          user: req.user.employee_code,
          userRole: req.user.role,
          requiredRoles: roles,
          url: req.originalUrl,
          method: req.method,
          ip: clientIP,
          userAgent,
          timestamp: new Date().toISOString(),
        });
        return next(new AuthorizationError('Bạn không có quyền truy cập chức năng này.'));
      }

      logger.debug(
        `Authorization granted for ${req.user.employee_code} with role ${req.user.role}`,
        {
          ip: clientIP,
          userAgent,
          url: req.originalUrl,
          method: req.method,
        },
      );
      next();
    } catch (error) {
      logger.error('Error in authorize middleware:', error);
      next(new AuthorizationError('Authorization processing failed'));
    }
  };
};

// Middleware: authorize by either DB permission or role(s)
// Usage: authorizeByPermissionOrRole('access_director_dashboard', 'director', 'deputy_director')
exports.authorizeByPermissionOrRole = (permissionName, ...roles) => {
  return async (req, res, next) => {
    const clientIP =
      req.ip ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
      'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    try {
      if (!req.user) {
        return next(new AuthenticationError('User authentication required'));
      }

      // Role check first
      if (Array.isArray(roles) && roles.length > 0 && roles.includes(req.user.role)) {
        return next();
      }

      // Permission check from DB
      const dbPerms = await getUserPermissions(req.user);
      if (dbPerms && dbPerms[permissionName]) {
        logger.debug('Permission-based authorization granted', {
          user: req.user.employee_code,
          permission: permissionName,
          url: req.originalUrl,
          method: req.method,
        });
        return next();
      }

      logger.warn('Authorization denied (permission/role)', {
        user: req.user.employee_code,
        role: req.user.role,
        requiredPermission: permissionName,
        allowedRoles: roles,
        url: req.originalUrl,
        method: req.method,
        ip: clientIP,
        userAgent,
      });
      return next(new AuthorizationError('Bạn không có quyền truy cập chức năng này.'));
    } catch (error) {
      logger.error('Error in authorizeByPermissionOrRole middleware:', error);
      return next(new AuthorizationError('Authorization processing failed'));
    }
  };
};

// Middleware: authorize if user has ANY of the given DB permissions OR is in allowed roles
// Usage: authorizeByAnyPermissionOrRole(['view_all_cases', 'view_department_cases'], 'manager', 'director')
exports.authorizeByAnyPermissionOrRole = (permissionNames = [], ...roles) => {
  return async (req, res, next) => {
    const clientIP =
      req.ip ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
      'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    try {
      if (!req.user) {
        return next(new AuthenticationError('User authentication required'));
      }

      if (Array.isArray(roles) && roles.length > 0 && roles.includes(req.user.role)) {
        return next();
      }

      const dbPerms = await getUserPermissions(req.user);
      const hasAny = Array.isArray(permissionNames)
        ? permissionNames.some((p) => dbPerms && dbPerms[p])
        : false;
      if (hasAny) {
        logger.debug('Permission-based (ANY) authorization granted', {
          user: req.user.employee_code,
          permissionsChecked: permissionNames,
          url: req.originalUrl,
          method: req.method,
        });
        return next();
      }

      logger.warn('Authorization denied (any-permission/role)', {
        user: req.user.employee_code,
        role: req.user.role,
        requiredPermissionsAny: permissionNames,
        allowedRoles: roles,
        url: req.originalUrl,
        method: req.method,
        ip: clientIP,
        userAgent,
      });
      return next(new AuthorizationError('Bạn không có quyền truy cập chức năng này.'));
    } catch (error) {
      logger.error('Error in authorizeByAnyPermissionOrRole middleware:', error);
      return next(new AuthorizationError('Authorization processing failed'));
    }
  };
};

// Authorization for report export per business rules
// Default access: administrator OR dept in KH&XLRR/KH&QLRR → allow
// Otherwise: employee_code must exist in allowlist JSON → allow, else 403
exports.authorizeReportAccess = (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return next(new AuthenticationError('User authentication required'));
    }

    const deptDefault = ['KH&XLRR', 'KH&QLRR'];
    const hasDefaultAccess = user.role === 'administrator' || deptDefault.includes(user.dept);
    if (hasDefaultAccess) {
      return next();
    }

    const allowlist = reportPermissionService.getAllowedEmployees();
    const isWhitelisted = Array.isArray(allowlist)
      ? allowlist.includes(user.employee_code)
      : false;
    if (!isWhitelisted) {
      return next(new AuthorizationError('Bạn không có quyền xuất báo cáo.'));
    }
    return next();
  } catch (error) {
    logger.error('Error in authorizeReportAccess middleware:', error);
    return next(new AuthorizationError('Authorization processing failed'));
  }
};
