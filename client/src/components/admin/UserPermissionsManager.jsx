import { useState, useEffect } from 'react';
import permissionService from '../../services/permissionService';
import styles from './UserPermissionsManager.module.css';

const UserPermissionsManager = ({ userId, onSuccess, onError }) => {
  const [allPermissions, setAllPermissions] = useState([]);
  const [userPermissions, setUserPermissions] = useState([]);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);

  // Load permissions data on component mount or userId change
  useEffect(() => {
    if (userId) {
      loadPermissionsData();
    }
  }, [userId]);

  const loadPermissionsData = async () => {
    try {
      setLoading(true);

      // Load all permissions and user permissions in parallel
      const [allPermsResponse, userPermsResponse] = await Promise.all([
        permissionService.getAllPermissions(),
        permissionService.getUserPermissions(userId),
      ]);

      setAllPermissions(allPermsResponse);
      setUserPermissions(userPermsResponse.permissions || []);
      setUser(userPermsResponse);

      // Set initially selected permissions
      const selectedIds = permissionService.getSelectedPermissionIds(
        allPermsResponse,
        userPermsResponse.permissions || []
      );
      setSelectedPermissionIds(selectedIds);
    } catch (error) {
      console.error('Error loading permissions data:', error);
      if (onError) {
        onError(error.message || 'Không thể tải dữ liệu quyền hạn');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionChange = (permissionId, isChecked) => {
    setSelectedPermissionIds(prev => {
      if (isChecked) {
        // Add permission if checked
        return [...prev, permissionId];
      } else {
        // Remove permission if unchecked
        return prev.filter(id => id !== permissionId);
      }
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const updatedUser = await permissionService.updateUserPermissions(
        userId,
        selectedPermissionIds
      );

      setUserPermissions(updatedUser.permissions || []);
      
      if (onSuccess) {
        onSuccess('Cập nhật quyền hạn thành công!', updatedUser);
      }
    } catch (error) {
      console.error('Error updating permissions:', error);
      if (onError) {
        onError(error.message || 'Không thể cập nhật quyền hạn');
      }
    } finally {
      setSaving(false);
    }
  };

  const isPermissionSelected = (permissionId) => {
    return selectedPermissionIds.includes(permissionId);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Đang tải dữ liệu quyền hạn...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Quản lý quyền hạn</h3>
        {user && (
          <div className={styles.userInfo}>
            <p><strong>Người dùng:</strong> {user.fullname} ({user.userId})</p>
          </div>
        )}
      </div>

      <div className={styles.content}>
        {allPermissions.length === 0 ? (
          <div className={styles.noData}>
            <p>Không có quyền hạn nào trong hệ thống.</p>
          </div>
        ) : (
          <div className={styles.permissionsList}>
            <h4>Chọn quyền hạn:</h4>
            <div className={styles.permissionsGrid}>
              {allPermissions.map(permission => (
                <div key={permission.id} className={styles.permissionItem}>
                  <label className={styles.permissionLabel}>
                    <input
                      type="checkbox"
                      checked={isPermissionSelected(permission.id)}
                      onChange={(e) => handlePermissionChange(permission.id, e.target.checked)}
                      className={styles.permissionCheckbox}
                    />
                    <div className={styles.permissionContent}>
                      <span className={styles.permissionName}>{permission.name}</span>
                      {permission.description && (
                        <span className={styles.permissionDescription}>
                          {permission.description}
                        </span>
                      )}
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <div className={styles.selectedCount}>
          <p>Đã chọn: {selectedPermissionIds.length} quyền</p>
        </div>
        
        <div className={styles.actions}>
          <button
            onClick={loadPermissionsData}
            className={styles.refreshButton}
            disabled={loading || saving}
            type="button"
          >
            Làm mới
          </button>
          
          <button
            onClick={handleSave}
            className={styles.saveButton}
            disabled={saving || loading}
            type="button"
          >
            {saving ? (
              <>
                <div className={styles.smallSpinner}></div>
                Đang lưu...
              </>
            ) : (
              'Lưu thay đổi'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserPermissionsManager;
