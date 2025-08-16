import React from 'react';
import styles from './PermissionModal.module.css';
import UserPermissionsManager from './UserPermissionsManager';

const PermissionModal = ({ isOpen, onClose, userId, onSuccess, onError }) => {
  if (!isOpen) return null;

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>Phân Quyền Người Dùng</h2>
          <button className={styles.closeButton} onClick={onClose} aria-label="Đóng">×</button>
        </div>
        <div className={styles.modalBody}>
          <UserPermissionsManager userId={userId} onSuccess={onSuccess} onError={onError} />
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.cancelButton} onClick={onClose} type="button">Đóng</button>
        </div>
      </div>
    </div>
  );
};

export default PermissionModal;
