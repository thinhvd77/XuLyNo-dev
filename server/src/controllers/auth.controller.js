const jwt = require('jsonwebtoken');
const logger = require('../config/logger');
const { asyncHandler, AuthenticationError, ValidationError } = require('../middleware/errorHandler');
const { getUserPermissions } = require('../services/permission.service');
const reportPermissionService = require('../services/reportPermission.service');

exports.login = asyncHandler(async (req, res) => {
  // Passport đã xác thực thành công và gắn `user` vào `req.user`
  const user = req.user;

  if (!user) {
    throw new AuthenticationError('User authentication failed');
  }

  if (!user.employee_code || !user.role) {
    logger.error('User object missing required fields:', user);
    throw new AuthenticationError('Invalid user data');
  }

  const payload = {
    sub: user.employee_code,
    dept: user.dept,
    fullname: user.fullname,
    role: user.role,
    branch_code: user.branch_code,
    username: user.username, // Thêm username vào payload
  };

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    logger.error('JWT_SECRET environment variable not set');
    throw new Error('Server configuration error');
  }

  // Ký token with error handling
  let token;
  try {
    token = jwt.sign(payload, jwtSecret, {
      expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    });
  } catch (jwtError) {
    logger.error('JWT signing error:', jwtError);
    throw new AuthenticationError('Failed to generate authentication token');
  }

  logger.info(`User logged in successfully: ${user.employee_code}`, {
    username: user.username,
    fullname: user.fullname,
    role: user.role,
    branch_code: user.branch_code,
    dept: user.dept,
    ip: req.clientInfo?.ip || 'unknown',
    userAgent: req.clientInfo?.userAgent || 'unknown',
    timestamp: new Date().toISOString(),
    tokenExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });

  res.status(200).json({
    success: true,
    access_token: token,
  });
});

exports.getSessionInfo = asyncHandler(async (req, res) => {
  const user = req.user;
  if (!user) {
    throw new AuthenticationError('User authentication required');
  }
  
  // New DB-driven granular permissions map
  const dbPermissions = await getUserPermissions(user);

  // Legacy route-access flags to keep frontend working until migrated
  const deptDefault = ['KH&XLRR', 'KH&QLRR'];
  const isAdmin = user.role === 'administrator';
  const isDirector = user.role === 'director' || user.role === 'deputy_director';
  const isManager = user.role === 'manager';
  const isDeputyManager = user.role === 'deputy_manager';
  const isEmployee = user.role === 'employee';
  const isKTGSNB = user.dept === 'KTGSNB';
  const isManagerKHDN = user.role === 'manager' && user.dept === 'KHDN';

  const has = (permName) => Boolean(dbPermissions && dbPermissions[permName]);
  const canAccessDirectorDashboard =
    isDirector || (isManager && user.dept === 'KHDN') || deptDefault.includes(user.dept) || isKTGSNB || has('access_director_dashboard');
  const canAccessManagerDashboard = ((isManager || isDeputyManager) && user.dept !== 'KTGSNB' && user.dept !== 'KH&QLRR' && !isManagerKHDN) || has('access_manager_dashboard');
  let canAccessMyCases = ((isEmployee || isManager || isDeputyManager) && user.dept !== 'KTGSNB' && user.dept !== 'KH&QLRR' && !isManagerKHDN) || has('view_own_cases') || has('view_department_cases') || has('view_all_cases');
  const canAccessAdminPages = isAdmin; // keep legacy for now; admin UI is broad
  const canImport = deptDefault.includes(user.dept) || has('import_internal_cases') || has('import_external_cases');

  // Report export per business rules: default or allowlist
  const hasDefaultExport = deptDefault.includes(user.dept);
  let canExportReport = hasDefaultExport || has('export_reports');
  
  if (!canExportReport) {
    const allowlist = reportPermissionService.getAllowedEmployees();
    canExportReport = Array.isArray(allowlist) ? allowlist.includes(user.employee_code) : false;
  }
  
  if (!canAccessMyCases && canExportReport && !isAdmin && !isKTGSNB && !deptDefault.includes(user.dept) && !isManagerKHDN) {
    canAccessMyCases = true;
  }

  const permissions = {
    canAccessDirectorDashboard,
    canAccessManagerDashboard,
    canAccessMyCases,
    canAccessAdminPages,
    canImport,
    canExportReport,
    // Optional: surface DB-based granular permissions for future UI usage
    _db: dbPermissions,
  };
  
  return res.status(200).json({
    success: true,
    user: {
      employee_code: user.employee_code,
      fullname: user.fullname,
      role: user.role,
      dept: user.dept,
      branch_code: user.branch_code,
      username: user.username,
    },
    permissions,
  });
});
