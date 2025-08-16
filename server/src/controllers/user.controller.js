const userService = require('../services/user.service');
const logger = require('../config/logger');
const { asyncHandler, ValidationError, NotFoundError } = require('../middleware/errorHandler');
const { validationResult } = require('express-validator');

exports.createUser = asyncHandler(async (req, res) => {
  try {
    // Input validation is now handled by validator middleware
    if (!req.body || Object.keys(req.body).length === 0) {
      throw new ValidationError('Dữ liệu yêu cầu không được để trống');
    }

    logger.info('Creating user with data:', {
      ...req.body,
      password: '[HIDDEN]',
      createdBy: req.user?.employee_code,
    });

    // Gọi service để tạo user
    const newUser = await userService.createUser(req.body);

    if (!newUser) {
      throw new Error('Failed to create user');
    }

    logger.info(
      `User created successfully by ${req.user?.employee_code}: ${newUser.employee_code}`,
    );

    res.status(201).json({
      success: true,
      message: 'Tạo người dùng thành công!',
      user: newUser,
    });
  } catch (error) {
    logger.error('Error in createUser:', {
      error: error.message,
      stack: error.stack,
      requestBy: req.user?.employee_code,
      requestData: req.body ? { ...req.body, password: '[HIDDEN]' } : null,
    });

    // Return specific error message to client
    res.status(error.message.includes('đã tồn tại') ? 409 : 500).json({
      success: false,
      message: error.message || 'Đã có lỗi xảy ra khi tạo người dùng',
    });
  }
});

exports.getAllUsers = asyncHandler(async (req, res) => {
  try {
    if (!req.user || !req.user.employee_code) {
      throw new ValidationError('User authentication required');
    }

    // Extract filter parameters from query string with validation
    const filters = {
      dept: req.query.dept && typeof req.query.dept === 'string' ? req.query.dept : undefined,
      branch_code:
        req.query.branch_code && typeof req.query.branch_code === 'string'
          ? req.query.branch_code
          : undefined,
    };

    // 1. Gọi service để lấy danh sách người dùng với filters
    const users = await userService.getAllUsers(req.user.employee_code, filters);

    if (!Array.isArray(users)) {
      throw new Error('Invalid response from user service');
    }

    logger.info(`Retrieved ${users.length} users for ${req.user.employee_code}`);

    res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    logger.error('Error in getAllUsers:', error);
    throw error;
  }
});

exports.getUserById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new ValidationError('User ID is required');
    }

    // 1. Gọi service để lấy người dùng theo ID
    const user = await userService.getUserById(id);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    logger.info(`User retrieved: ${id}`);

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    logger.error(`Error in getUserById for ${req.params.id}:`, error);
    throw error;
  }
});

/**
 * Update user by ID
 */
exports.updateUser = asyncHandler(async (req, res) => {
  try {
    // 1. Kiểm tra kết quả validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Dữ liệu không hợp lệ', errors.array());
    }

    const { id } = req.params;

    if (!id) {
      throw new ValidationError('User ID is required');
    }

    if (!req.body || Object.keys(req.body).length === 0) {
      throw new ValidationError('Update data is required');
    }

    // 2. Gọi service để cập nhật user
    const updatedUser = await userService.updateUser(id, req.body);

    if (!updatedUser) {
      throw new NotFoundError('User not found or update failed');
    }

    logger.info(`User updated successfully by ${req.user?.employee_code}: ${id}`);

    res.status(200).json({
      success: true,
      message: 'Cập nhật người dùng thành công!',
      user: updatedUser,
    });
  } catch (error) {
    logger.error(`Error in updateUser for ${req.params.id}:`, error);
    throw error;
  }
});

/**
 * Toggle user status (enable/disable)
 */
exports.toggleUserStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    // Gọi service để toggle user status
    const updatedUser = await userService.toggleUserStatus(id);
    res.status(200).json({
      success: true,
      message: `Đã ${updatedUser.status === 'active' ? 'kích hoạt' : 'vô hiệu hóa'} người dùng thành công!`,
      user: updatedUser,
    });
  } catch (error) {
    // Xử lý lỗi (ví dụ: user không tồn tại)
    if (error.message.includes('không tìm thấy')) {
      res.status(404).json({ success: false, message: error.message });
    } else {
      res.status(500).json({ success: false, message: error.message });
    }
  }
});

/**
 * Change user password
 */
exports.changeUserPassword = asyncHandler(async (req, res) => {
  // 1. Kiểm tra kết quả validation
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu không hợp lệ.',
      errors: errors.array(),
    });
  }

  const { id } = req.params;
  const { newPassword } = req.body; // Admin doesn't need oldPassword
  const currentUser = req.user; // From JWT middleware

  try {
    // Only admin can use this route
    const isAdmin = currentUser.role === 'administrator';

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ quản trị viên mới có quyền sử dụng chức năng này.',
      });
    }

    // 2. Gọi service để đổi mật khẩu (admin không cần oldPassword)
    const updatedUser = await userService.changeUserPassword(id, newPassword, null, true);

    logger.info(`Password changed for user ${id} by admin ${currentUser.employee_code}`);

    res.status(200).json({
      success: true,
      message: 'Đổi mật khẩu thành công!',
      user: updatedUser,
    });
  } catch (error) {
    logger.error(`Error changing password for user ${id}:`, error);

    // 3. Xử lý lỗi
    if (error.message.includes('không tìm thấy')) {
      res.status(404).json({ success: false, message: error.message });
    } else {
      res.status(500).json({ success: false, message: error.message });
    }
  }
});

// NEW: Route for users to change their own password
exports.changeMyPassword = asyncHandler(async (req, res) => {
  // 1. Kiểm tra kết quả validation
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dữ liệu không hợp lệ.',
      errors: errors.array(),
    });
  }

  const { newPassword, oldPassword } = req.body;
  const currentUser = req.user; // From JWT middleware
  const currentId = currentUser.employee_code || currentUser.sub; // ensure we have employee_code
  logger.info(`User ${currentId} is changing their own password`);

  try {
    // 2. Gọi service để đổi mật khẩu của chính mình
    const updatedUser = await userService.changeUserPassword(
      currentId,
      newPassword,
      oldPassword,
      false, // Not admin, so requires oldPassword verification
    );

    logger.info(`User ${currentId} changed their own password`);

    res.status(200).json({
      success: true,
      message: 'Đổi mật khẩu thành công!',
      user: updatedUser,
    });
  } catch (error) {
    logger.error(`Error changing own password for user ${currentId}:`, error);
    // Provide normalized error messages for frontend matching
    if (error.message.includes('không đúng') || error.message.includes('sai')) {
      return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không đúng.' });
    }
    if (error.message.includes('không tìm thấy')) {
      return res.status(404).json({ success: false, message: 'Người dùng không tìm thấy.' });
    }
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi đổi mật khẩu.' });
  }
});

/**
 * MỚI: Lấy danh sách nhân viên thuộc quyền quản lý
 */
exports.getManagedOfficers = asyncHandler(async (req, res) => {
  try {
    // req.user chứa thông tin của Trưởng/Phó phòng đang đăng nhập
    const manager = req.user;
    const officers = await userService.findOfficersByManager(manager);
    res.status(200).json(officers);
  } catch (error) {
    logger.error('Error in findOfficersByManager:', {
      error: error.message,
      manager: req.user?.employee_code,
    });
    res.status(500).json({ success: false, message: 'Đã có lỗi xảy ra trên server.' });
  }
});

/**
 * MỚI: Lấy danh sách tất cả nhân viên để sử dụng cho filter dropdown
 */
exports.getEmployeesForFilter = asyncHandler(async (req, res) => {
  try {
    if (!req.user || !req.user.branch_code) {
      throw new ValidationError('User branch information not available');
    }

    // Extract director's branch code from authenticated user
    const directorBranchCode = req.user.branch_code;

    // Extract query parameters for filtering
    const { branchCode, departmentCode } = req.query;

    logger.info('Fetching employees for filter with branch-based access control', {
      director: req.user.employee_code,
      directorBranch: directorBranchCode,
      selectedBranch: branchCode,
      selectedDepartment: departmentCode,
    });

    const employees = await userService.getEmployeesForFilter(
      directorBranchCode,
      branchCode,
      departmentCode,
    );

    if (!Array.isArray(employees)) {
      throw new Error('Invalid response from user service');
    }

    // Log the filtering result for audit purposes
    logger.info(`Employee filter applied successfully`, {
      director: req.user.employee_code,
      directorBranch: directorBranchCode,
      selectedBranch: branchCode,
      selectedDepartment: departmentCode,
      employeesReturned: employees.length,
      isUnrestricted: directorBranchCode === '6421',
    });

    res.status(200).json({
      success: true,
      employees,
      metadata: {
        totalEmployees: employees.length,
        branchFilter: branchCode || (directorBranchCode !== '6421' ? directorBranchCode : null),
        departmentFilter: departmentCode || null,
        isUnrestricted: directorBranchCode === '6421',
      },
    });
  } catch (error) {
    logger.error('Error in getEmployeesForFilter:', {
      error: error.message,
      user: req.user?.employee_code,
      branch: req.user?.branch_code,
      selectedBranch: req.query?.branchCode,
      selectedDepartment: req.query?.departmentCode,
    });
    throw error;
  }
});

/**
 * API để lấy danh sách chi nhánh (branch) để hiển thị trong dropdown filter
 */
exports.getBranchesForFilter = asyncHandler(async (req, res) => {
  try {
    const branches = await userService.getBranchesForFilter();
    res.status(200).json({
      success: true,
      branches,
    });
  } catch (error) {
    logger.error('Error in getBranchesForFilter:', {
      error: error.message,
      user: req.user?.employee_code,
    });
    res.status(500).json({ success: false, message: 'Đã có lỗi xảy ra trên server.' });
  }
});

/**
 * API để lấy danh sách phòng ban theo chi nhánh được chọn
 */
exports.getDepartmentsForFilter = asyncHandler(async (req, res) => {
  try {
    const { branchCode } = req.query;
    const departments = await userService.getDepartmentsForFilter(branchCode);
    res.status(200).json({
      success: true,
      departments,
    });
  } catch (error) {
    logger.error('Error in getDepartmentsForFilter:', {
      error: error.message,
      branchCode: req.query.branchCode,
      user: req.user?.employee_code,
    });
    res.status(500).json({ success: false, message: 'Đã có lỗi xảy ra trên server.' });
  }
});

exports.deleteUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Gọi service để xóa người dùng theo ID
    const result = await userService.deleteUserById(id);
    res.status(200).json(result);
  } catch (error) {
    // 2. Xử lý lỗi nếu người dùng không tồn tại hoặc không thể xóa
    res.status(404).json({ success: false, message: error.message });
  }
});

/**
 * @desc    Get user permissions
 * @route   GET /api/users/:userId/permissions
 * @access  Private (Admin only)
 */
exports.getUserPermissions = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const dataSource = require('../config/dataSource');
  const { User } = require('../entities/User.entity');

  try {
    logger.info('Fetching user permissions', {
      userId,
      requestedBy: req.user?.employee_code,
    });

    const userRepository = dataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { employee_code: userId },
      relations: ['permissions'],
    });

    if (!user) {
      throw new NotFoundError('Không tìm thấy người dùng');
    }

    logger.info(`Successfully retrieved permissions for user ${userId}`, {
      userId,
      permissionCount: user.permissions?.length || 0,
      requestedBy: req.user?.employee_code,
    });

    res.status(200).json({
      success: true,
      message: 'Lấy danh sách quyền của người dùng thành công',
      data: {
        userId: user.employee_code,
        fullname: user.fullname,
        permissions: user.permissions || [],
      },
    });
  } catch (error) {
    logger.error('Error fetching user permissions:', {
      error: error.message,
      stack: error.stack,
      userId,
      requestedBy: req.user?.employee_code,
    });
    throw error;
  }
});

/**
 * @desc    Update user permissions
 * @route   PUT /api/users/:userId/permissions
 * @access  Private (Admin only)
 */
exports.updateUserPermissions = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { permissionIds } = req.body;
  const dataSource = require('../config/dataSource');
  const { User } = require('../entities/User.entity');
  const { Permission } = require('../entities/Permission.entity');
  const { UserPermission } = require('../entities/UserPermission.entity');
  const { In } = require('typeorm');

  // Helper: normalize various incoming formats to an array of distinct integers
  const normalizePermissionIds = (raw) => {
    // Accept: number[], string[] (numeric strings), a single number, a single string
    // Additionally accept Postgres array-literal strings like '{1,2,3}' or '{"1","2"}'
    const toInt = (v) => {
      const n = typeof v === 'number' ? v : parseInt(String(v).trim(), 10);
      return Number.isFinite(n) ? n : null;
    };

    let arr = raw;
    if (arr == null) return [];

    if (typeof arr === 'string') {
      const s = arr.trim();
      if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
        // Convert Postgres array-literal to JSON array then parse
        const jsonish = s
          .replace(/^\{/,'[')
          .replace(/\}$/ ,']')
          // split quoted entries preserved by replacing '"' with '"'
          // Remove double quotes around items, we'll parse later item-wise
          ;
        try {
          // jsonish may still be like [1,2] or ["1","2"], JSON.parse will work for both
          arr = JSON.parse(jsonish);
        } catch (_) {
          // Fallback: manual split by comma removing braces/quotes
          const inner = s.slice(1, -1);
          arr = inner.length ? inner.split(',').map(x => x.replace(/^\s*"|"\s*$/g,'').trim()) : [];
        }
      } else if (s.length > 0) {
        arr = [s];
      } else {
        arr = [];
      }
    }

    if (!Array.isArray(arr)) arr = [arr];

    const ints = [];
    for (const item of arr) {
      if (Array.isArray(item)) {
        for (const sub of item) {
          const n = toInt(sub);
          if (n != null) ints.push(n);
        }
      } else {
        const n = toInt(item);
        if (n != null) ints.push(n);
      }
    }
    // de-duplicate
    return Array.from(new Set(ints));
  };

  try {
    // Validate input
    const normalizedIds = normalizePermissionIds(permissionIds);

    if (!Array.isArray(permissionIds)) {
      // Keep backward-compatible error, but we now accept strings too — explain in detail
      logger.warn('permissionIds was not an array; normalized input applied', { rawType: typeof permissionIds, permissionIds });
    }

    if (!normalizedIds.every(Number.isInteger)) {
      throw new ValidationError('permissionIds phải là danh sách số nguyên hợp lệ');
    }

    logger.info('Updating user permissions', {
      userId,
      permissionIds: normalizedIds,
      requestedBy: req.user?.employee_code,
    });

    const userRepository = dataSource.getRepository(User);
    const permissionRepository = dataSource.getRepository(Permission);
    const userPermissionRepository = dataSource.getRepository(UserPermission);

    // Check if user exists
    const user = await userRepository.findOne({
      where: { employee_code: userId },
    });

    if (!user) {
      throw new NotFoundError('Không tìm thấy người dùng');
    }

    // Validate all permission IDs exist
    if (normalizedIds.length > 0) {
      const permissions = await permissionRepository.find({ where: { id: In(normalizedIds) } });

      if (permissions.length !== normalizedIds.length) {
        const foundIds = permissions.map(p => p.id);
        const invalidIds = normalizedIds.filter(id => !foundIds.includes(id));
        throw new ValidationError(`Không tìm thấy quyền với ID: ${invalidIds.join(', ')}`);
      }
    }

    // Start transaction
    await dataSource.transaction(async manager => {
      // Remove all existing permissions for the user
      await manager.delete(UserPermission, { userId });

      // Add new permissions
      if (normalizedIds.length > 0) {
        const userPermissions = normalizedIds.map(permissionId => ({
          userId,
          permissionId,
        }));

        await manager.save(UserPermission, userPermissions);
      }
    });

    // Fetch updated user with permissions
    const updatedUser = await userRepository.findOne({
      where: { employee_code: userId },
      relations: ['permissions'],
    });

    logger.info(`Successfully updated permissions for user ${userId}`, {
      userId,
      oldPermissionCount: 'unknown',
      newPermissionCount: updatedUser.permissions?.length || 0,
      updatedBy: req.user?.employee_code,
    });

    res.status(200).json({
      success: true,
      message: 'Cập nhật quyền người dùng thành công',
      data: {
        userId: updatedUser.employee_code,
        fullname: updatedUser.fullname,
        permissions: updatedUser.permissions || [],
      },
    });
  } catch (error) {
    logger.error('Error updating user permissions:', {
      error: error.message,
      stack: error.stack,
      userId,
      permissionIds,
      normalizedPermissionIds: (() => {
        try { return normalizePermissionIds(permissionIds); } catch { return 'normalize_failed'; }
      })(),
      requestedBy: req.user?.employee_code,
    });
    throw error;
  }
});
