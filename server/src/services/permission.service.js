const AppDataSource = require('../config/dataSource');
const logger = require('../config/logger');

/**
 * Get user permissions from database
 * @param {Object} user - User object with employee_code
 * @returns {Promise<Object>} Object with permission names as keys and true as values
 */
async function getUserPermissions(user) {
  try {
    if (!user || !user.employee_code) {
      logger.warn('getUserPermissions called with invalid user');
      return {};
    }

    logger.debug(`Fetching permissions for user: ${user.employee_code}`);

    const userRepository = AppDataSource.getRepository('User');
    const userWithPermissions = await userRepository.findOne({
      where: { employee_code: user.employee_code },
      relations: ['permissions'],
    });

    if (!userWithPermissions || !userWithPermissions.permissions) {
      logger.debug(`No permissions found for user: ${user.employee_code}`);
      return {};
    }

    // Convert permissions array to object format
    const permissionsObject = {};
    userWithPermissions.permissions.forEach((permission) => {
      permissionsObject[permission.name] = true;
    });

    // Auto-grant implied permissions
    // Export permissions automatically grant corresponding view permissions
    if (permissionsObject.export_department_data) {
      permissionsObject.view_department_cases = true;
      logger.debug(`Auto-granted view_department_cases for user with export_department_data`);
    }

    if (permissionsObject.export_all_data) {
      permissionsObject.view_all_cases = true;
      logger.debug(`Auto-granted view_all_cases for user with export_all_data`);
    }

    if (permissionsObject.export_case_data) {
      permissionsObject.view_own_cases = true;
      logger.debug(`Auto-granted view_own_cases for user with export_case_data`);
    }

    // Reverse logic: View/export permissions should be bidirectional
    if (permissionsObject.export_department_cases) {
      permissionsObject.export_department_data = true;
      permissionsObject.view_department_cases = true;
      logger.debug(`Auto-granted export_department_data and view_department_cases for user with export_department_cases`);
    }

    if (permissionsObject.export_all_cases) {
      permissionsObject.export_all_data = true;
      permissionsObject.view_all_cases = true;
      logger.debug(`Auto-granted export_all_data and view_all_cases for user with export_all_cases`);
    }

    if (permissionsObject.export_own_cases) {
      permissionsObject.export_case_data = true;
      permissionsObject.view_own_cases = true;
      logger.debug(`Auto-granted export_case_data and view_own_cases for user with export_own_cases`);
    }

    // Management permissions automatically grant view permissions
    if (permissionsObject.manage_delegations) {
      permissionsObject.view_delegations = true;
      permissionsObject.create_delegation = true;
      logger.debug(`Auto-granted view_delegations and create_delegation for user with manage_delegations`);
    }

    if (permissionsObject.manage_users) {
      permissionsObject.view_users = true;
      permissionsObject.create_users = true;
      permissionsObject.edit_users = true;
      permissionsObject.delete_users = true;
      logger.debug(`Auto-granted user CRUD permissions for user with manage_users`);
    }

    if (permissionsObject.manage_permissions) {
      permissionsObject.view_permissions = true;
      permissionsObject.assign_permissions = true;
      permissionsObject.revoke_permissions = true;
      logger.debug(`Auto-granted permission management permissions for user with manage_permissions`);
    }

    // Edit permissions automatically grant view permissions
    if (permissionsObject.edit_all_cases) {
      permissionsObject.view_all_cases = true;
      logger.debug(`Auto-granted view_all_cases for user with edit_all_cases`);
    }

    if (permissionsObject.edit_department_cases) {
      permissionsObject.view_department_cases = true;
      logger.debug(`Auto-granted view_department_cases for user with edit_department_cases`);
    }

    if (permissionsObject.edit_own_cases) {
      permissionsObject.view_own_cases = true;
      logger.debug(`Auto-granted view_own_cases for user with edit_own_cases`);
    }

    logger.debug(`Permissions loaded for user ${user.employee_code}:`, Object.keys(permissionsObject));
    return permissionsObject;
  } catch (error) {
    logger.error('Error fetching user permissions:', error);
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
  const permissions = await getUserPermissions(user);
  return permissions[permissionName] === true;
}

/**
 * Check if user has any of the specified permissions
 * @param {Object} user - User object with employee_code
 * @param {string[]} permissionNames - Array of permission names to check
 * @returns {Promise<boolean>} True if user has at least one permission
 */
async function hasAnyPermission(user, permissionNames) {
  const permissions = await getUserPermissions(user);
  return permissionNames.some((permissionName) => permissions[permissionName] === true);
}

/**
 * Check if user has all of the specified permissions
 * @param {Object} user - User object with employee_code
 * @param {string[]} permissionNames - Array of permission names to check
 * @returns {Promise<boolean>} True if user has all permissions
 */
async function hasAllPermissions(user, permissionNames) {
  const permissions = await getUserPermissions(user);
  return permissionNames.every((permissionName) => permissions[permissionName] === true);
}

module.exports = {
  getUserPermissions,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
};