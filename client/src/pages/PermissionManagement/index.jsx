import React from 'react';
import { PermissionManagement } from '../../components/PermissionManagement';
import permissionService from '../../services/permissionService';

/**
 * Permission Management Page
 * Admin interface for managing user permissions with granular scope control
 */
function PermissionManagementPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Quản lý phân quyền</h1>
        <p>Cấp phát và quản lý quyền truy cập cho người dùng trong hệ thống</p>
      </div>
      
      <div className="page-content">
        <PermissionManagement 
          apiClient={permissionService}
        />
      </div>
    </div>
  );
}

export default PermissionManagementPage;
