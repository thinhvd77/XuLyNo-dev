const dataSource = require('../config/dataSource');
const logger = require('../config/logger');
const { User } = require('../entities/User.entity');

/**
 * Get user permissions from database
 * @param {Object} user - User object with employee_code
 * @returns {Promise<Object>} Object with permission names as keys and true as values
 * @example
 * // Returns: { view_own_cases: true, edit_own_cases: true }
 */
async function getUserPermissions(user) {
  try {
    if (!user || !user.employee_code) {
      logger.warn('getUserPermissions called with invalid user object', { user });
      return {};
    }

    logger.debug('Fetching permissions for user', { 
      employee_code: user.employee_code 
    });

    const userRepository = dataSource.getRepository(User);
    
    // Fetch user with their permissions
    const userWithPermissions = await userRepository.findOne({
      where: { employee_code: user.employee_code },
      relations: ['permissions'],
    });

    if (!userWithPermissions) {
      logger.warn('User not found when fetching permissions', { 
        employee_code: user.employee_code 
      });
      return {};
    }

    // Convert permissions array to object with permission name as key
    const permissionsObject = {};
    
    if (userWithPermissions.permissions && userWithPermissions.permissions.length > 0) {
      userWithPermissions.permissions.forEach(permission => {
        if (permission.name) {
          permissionsObject[permission.name] = true;
        }
      });
    }

    logger.debug('Successfully retrieved user permissions', {
      employee_code: user.employee_code,
      permissionCount: Object.keys(permissionsObject).length,
      permissions: Object.keys(permissionsObject),
    });

    return permissionsObject;
  } catch (error) {
    logger.error('Error fetching user permissions:', {
      error: error.message,
      stack: error.stack,
      employee_code: user?.employee_code,
    });
    
    // Return empty permissions object on error to prevent breaking the application
    return {};
  }
}

/**
 * Check if user has a specific permission
 * @param {Object} user - User object with employee_code
 * @param {string} permissionName - Name of the permission to check
 * @returns {Promise<boolean>} True if user has the permission
 */
async function hasPermission(user, permissionName) {
  try {
    const permissions = await getUserPermissions(user);
    return permissions[permissionName] === true;
  } catch (error) {
    logger.error('Error checking user permission:', {
      error: error.message,
      employee_code: user?.employee_code,
      permissionName,
    });
    return false;
  }
}

/**
 * Check if user has any of the specified permissions
 * @param {Object} user - User object with employee_code
 * @param {string[]} permissionNames - Array of permission names to check
 * @returns {Promise<boolean>} True if user has at least one of the permissions
 */
async function hasAnyPermission(user, permissionNames) {
  try {
    if (!Array.isArray(permissionNames) || permissionNames.length === 0) {
      return false;
    }

    const permissions = await getUserPermissions(user);
    return permissionNames.some(permissionName => permissions[permissionName] === true);
  } catch (error) {
    logger.error('Error checking user permissions:', {
      error: error.message,
      employee_code: user?.employee_code,
      permissionNames,
    });
    return false;
  }
}

/**
 * Check if user has all of the specified permissions
 * @param {Object} user - User object with employee_code
 * @param {string[]} permissionNames - Array of permission names to check
 * @returns {Promise<boolean>} True if user has all of the permissions
 */
async function hasAllPermissions(user, permissionNames) {
  try {
    if (!Array.isArray(permissionNames) || permissionNames.length === 0) {
      return true; // Empty array means no permissions required
    }

    const permissions = await getUserPermissions(user);
    return permissionNames.every(permissionName => permissions[permissionName] === true);
  } catch (error) {
    logger.error('Error checking user permissions:', {
      error: error.message,
      employee_code: user?.employee_code,
      permissionNames,
    });
    return false;
  }
}

module.exports = {
  getUserPermissions,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
};


