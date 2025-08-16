const dataSource = require('../config/dataSource');
const logger = require('../config/logger');
const { asyncHandler, NotFoundError, ValidationError } = require('../middleware/errorHandler');
const { Permission } = require('../entities/Permission.entity');

/**
 * @desc    Get all permissions
 * @route   GET /api/permissions
 * @access  Private (Admin only)
 */
exports.getAllPermissions = asyncHandler(async (req, res) => {
  try {
    logger.info('Fetching all permissions', {
      requestedBy: req.user?.employee_code,
      userRole: req.user?.role,
    });

    const permissionRepository = dataSource.getRepository(Permission);
    const permissions = await permissionRepository.find({
      order: {
        name: 'ASC',
      },
    });

    logger.info(`Successfully retrieved ${permissions.length} permissions`, {
      requestedBy: req.user?.employee_code,
      count: permissions.length,
    });

    res.status(200).json({
      success: true,
      message: 'Lấy danh sách quyền hạn thành công',
      data: permissions,
      total: permissions.length,
    });
  } catch (error) {
    logger.error('Error fetching permissions:', {
      error: error.message,
      stack: error.stack,
      requestedBy: req.user?.employee_code,
    });
    throw error;
  }
});
