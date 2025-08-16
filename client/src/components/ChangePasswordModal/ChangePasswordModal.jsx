import { useState } from 'react';
import toast from 'react-hot-toast';
import styles from './ChangePasswordModal.module.css';

const EyeIcon = () => (
  <svg
    className={styles['eye-icon']}
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    fill="currentColor"
    viewBox="0 0 16 16"
  >
    <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0" />
    <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8m8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7" />
  </svg>
);
const EyeSlashIcon = () => (
  <svg
    className={styles['eye-slash-icon']}
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    fill="currentColor"
    viewBox="0 0 16 16"
  >
    <path d="m10.79 12.912-1.614-1.615a3.5 3.5 0 0 1-4.474-4.474l-2.06-2.06C.938 6.278 0 8 0 8s3 5.5 8 5.5a7.029 7.029 0 0 0 2.79-.588M5.21 3.088A7.028 7.028 0 0 1 8 2.5c5 0 8 5.5 8 5.5s-.939 1.721-2.641 3.238l-2.062-2.062a3.5 3.5 0 0 0-4.474-4.474L5.21 3.089z" />
    <path d="M5.525 7.646a2.5 2.5 0 0 0 2.829 2.829l-2.83-2.829zm4.95.708-2.829-2.83a2.5 2.5 0 0 1 2.829 2.829zm3.171 6-12-12 .708-.708 12 12z" />
  </svg>
);

const ChangePasswordModal = ({ isOpen, onClose, onSubmit, user, isAdmin }) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const resetForm = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowOldPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setIsLoading(false);
    setErrors({});
  };

  const handleOldPasswordChange = (e) => {
    setOldPassword(e.target.value);
    if (errors.oldPassword) {
      setErrors((prev) => ({ ...prev, oldPassword: '' }));
    }
  };

  const handleNewPasswordChange = (e) => {
    setNewPassword(e.target.value);
    if (errors.newPassword) {
      setErrors((prev) => ({ ...prev, newPassword: '' }));
    }
  };

  const handleConfirmPasswordChange = (e) => {
    setConfirmPassword(e.target.value);
    if (errors.confirmPassword) {
      setErrors((prev) => ({ ...prev, confirmPassword: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Validate old password for non-admin users
    if (!isAdmin && !oldPassword) {
      newErrors.oldPassword = 'Vui lòng nhập mật khẩu hiện tại';
    }

    // Validate new password
    if (!newPassword) {
      newErrors.newPassword = 'Vui lòng nhập mật khẩu mới';
    } else if (newPassword.length < 6) {
      newErrors.newPassword = 'Mật khẩu mới phải có ít nhất 6 ký tự';
    } else if (newPassword === oldPassword && !isAdmin) {
      newErrors.newPassword = 'Mật khẩu mới phải khác mật khẩu hiện tại';
    }

    // Validate confirm password
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Vui lòng xác nhận mật khẩu mới';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Mật khẩu xác nhận không khớp với mật khẩu mới';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Clear previous errors
    setErrors({});

    // Validate form
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const passwordData = {
        newPassword,
        ...(isAdmin ? {} : { oldPassword }),
      };

      await onSubmit(user.employee_code, passwordData);
      resetForm();
    } catch (error) {
      // Handle different types of errors
      if (error.message) {
        if (
          error.message.includes('không đúng') ||
          error.message.includes('sai') ||
          error.message.includes('current password') ||
          error.message.includes('incorrect')
        ) {
          setErrors({ oldPassword: 'Mật khẩu hiện tại không đúng' });
        } else if (error.message.includes('network') || error.message.includes('kết nối')) {
          toast.error('Lỗi kết nối mạng. Vui lòng thử lại!');
        } else if (error.message.includes('unauthorized') || error.message.includes('token')) {
          toast.error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!');
        } else {
          toast.error(error.message || 'Có lỗi xảy ra khi đổi mật khẩu');
        }
      } else {
        toast.error('Có lỗi không xác định xảy ra. Vui lòng thử lại!');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>Đổi mật khẩu</h2>
          <button onClick={handleClose} className={styles.closeButton}>
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            {isAdmin && (
              <div className={styles.userInfo}>
                <p>
                  <strong>Người dùng:</strong> {user?.fullname} ({user?.username})
                </p>
                <p>
                  <strong>Mã nhân viên:</strong> {user?.employee_code}
                </p>
                {isAdmin && (
                  <p className={styles.adminNote}>
                    <em>Bạn là quản trị viên, không cần nhập mật khẩu cũ</em>
                  </p>
                )}
              </div>
            )}

            {!isAdmin && (
              <div className={styles.formGroup}>
                <label htmlFor="oldPassword">Mật khẩu hiện tại *</label>
                <div className={styles.passwordField}>
                  <input
                    id="oldPassword"
                    type={showOldPassword ? 'text' : 'password'}
                    value={oldPassword}
                    onChange={handleOldPasswordChange}
                    placeholder="Nhập mật khẩu hiện tại"
                    required
                    className={errors.oldPassword ? styles.errorInput : ''}
                  />
                  <button
                    type="button"
                    className={styles.togglePassword}
                    onClick={() => setShowOldPassword(!showOldPassword)}
                  >
                    {showOldPassword ? <EyeSlashIcon /> : <EyeIcon />}
                  </button>
                </div>
                {errors.oldPassword && (
                  <div className={styles.errorMessage}>{errors.oldPassword}</div>
                )}
              </div>
            )}

            <div className={styles.formGroup}>
              <label htmlFor="newPassword">Mật khẩu mới *</label>
              <div className={styles.passwordField}>
                <input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={handleNewPasswordChange}
                  placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                  required
                  className={errors.newPassword ? styles.errorInput : ''}
                />
                <button
                  type="button"
                  className={styles.togglePassword}
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeSlashIcon /> : <EyeIcon />}
                </button>
              </div>
              {errors.newPassword && (
                <div className={styles.errorMessage}>{errors.newPassword}</div>
              )}
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="confirmPassword">Xác nhận mật khẩu mới *</label>
              <div className={styles.passwordField}>
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={handleConfirmPasswordChange}
                  placeholder="Nhập lại mật khẩu mới"
                  required
                  className={errors.confirmPassword ? styles.errorInput : ''}
                />
                <button
                  type="button"
                  className={styles.togglePassword}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeSlashIcon /> : <EyeIcon />}
                </button>
              </div>
              {errors.confirmPassword && (
                <div className={styles.errorMessage}>{errors.confirmPassword}</div>
              )}
            </div>
          </div>
          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={handleClose}
              disabled={isLoading}
            >
              Hủy
            </button>
            <button type="submit" className={styles.saveButton} disabled={isLoading}>
              {isLoading ? 'Đang xử lý...' : 'Đổi mật khẩu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
