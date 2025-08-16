/**
 * Permission Service - API calls for permission management
 */
import { authenticatedFetch } from '../utils/apiClient';
import { API_ENDPOINTS } from '../config/api';

// Add permission endpoints to API_ENDPOINTS if not already defined
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ||
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : `http://${window.location.hostname}:3000`);

const PERMISSION_ENDPOINTS = {
  PERMISSIONS: {
    LIST: `${API_BASE_URL}/api/permissions`,
    USER_PERMISSIONS: (userId) => `${API_BASE_URL}/api/users/${userId}/permissions`,
  },
};

class PermissionService {
  /**
   * Get all permissions from the system
   * @returns {Promise<Array>} Array of permission objects
   */
  async getAllPermissions() {
    try {
      const response = await authenticatedFetch(
        PERMISSION_ENDPOINTS.PERMISSIONS.LIST,
        {
          method: 'GET',
        },
        'permission_management'
      );

      return response.data || [];
    } catch (error) {
      console.error('Error fetching all permissions:', error);
      throw new Error(error.message || 'Không thể lấy danh sách quyền hạn');
    }
  }

  /**
   * Get permissions for a specific user
   * @param {string} userId - Employee code of the user
   * @returns {Promise<Object>} User permissions data
   */
  async getUserPermissions(userId) {
    try {
      if (!userId) {
        throw new Error('userId is required');
      }

      const response = await authenticatedFetch(
        PERMISSION_ENDPOINTS.PERMISSIONS.USER_PERMISSIONS(userId),
        {
          method: 'GET',
        },
        'permission_management'
      );

      return response.data || {};
    } catch (error) {
      console.error(`Error fetching permissions for user ${userId}:`, error);
      throw new Error(error.message || 'Không thể lấy quyền hạn của người dùng');
    }
  }

  /**
   * Update permissions for a specific user
   * @param {string} userId - Employee code of the user
   * @param {Array<number>} permissionIds - Array of permission IDs to assign
   * @returns {Promise<Object>} Updated user permissions data
   */
  async updateUserPermissions(userId, permissionIds) {
    try {
      if (!userId) {
        throw new Error('userId is required');
      }

      if (!Array.isArray(permissionIds)) {
        throw new Error('permissionIds must be an array');
      }

      const response = await authenticatedFetch(
        PERMISSION_ENDPOINTS.PERMISSIONS.USER_PERMISSIONS(userId),
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ permissionIds }),
        },
        'permission_management'
      );

      return response.data || {};
    } catch (error) {
      console.error(`Error updating permissions for user ${userId}:`, error);
      throw new Error(error.message || 'Không thể cập nhật quyền hạn cho người dùng');
    }
  }

  /**
   * Helper method to check if a user has a specific permission
   * @param {string} userId - Employee code of the user
   * @param {string} permissionName - Name of the permission to check
   * @returns {Promise<boolean>} True if user has the permission
   */
  async hasPermission(userId, permissionName) {
    try {
      const userPermissions = await this.getUserPermissions(userId);
      const permissions = userPermissions.permissions || [];
      
      return permissions.some(permission => permission.name === permissionName);
    } catch (error) {
      console.error(`Error checking permission ${permissionName} for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Helper method to get permission names array for a user
   * @param {string} userId - Employee code of the user
   * @returns {Promise<Array<string>>} Array of permission names
   */
  async getUserPermissionNames(userId) {
    try {
      const userPermissions = await this.getUserPermissions(userId);
      const permissions = userPermissions.permissions || [];
      
      return permissions.map(permission => permission.name);
    } catch (error) {
      console.error(`Error getting permission names for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Helper method to transform permissions for UI components
   * @param {Array} permissions - Array of permission objects
   * @returns {Array} Transformed permissions for UI
   */
  transformPermissionsForUI(permissions) {
    return permissions.map(permission => ({
      id: permission.id,
      name: permission.name,
      description: permission.description,
      label: permission.description || permission.name,
      value: permission.id,
    }));
  }

  /**
   * Helper method to get current user's selected permission IDs
   * @param {Array} allPermissions - All available permissions
   * @param {Array} userPermissions - User's current permissions
   * @returns {Array<number>} Array of selected permission IDs
   */
  getSelectedPermissionIds(allPermissions, userPermissions) {
    const userPermissionNames = userPermissions.map(p => p.name);
    return allPermissions
      .filter(permission => userPermissionNames.includes(permission.name))
      .map(permission => permission.id);
  }
}

// Create and export a singleton instance
const permissionService = new PermissionService();
export default permissionService;
