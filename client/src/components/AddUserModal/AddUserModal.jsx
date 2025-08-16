import { useState } from 'react';
import toast from 'react-hot-toast';
import styles from './AddUserModal.module.css';

const AddUserModal = ({ isOpen, onClose, onSave }) => {
  const [fullname, setFullname] = useState('');
  const [employee_code, setEmployeeCode] = useState('');
  const [dept, setDept] = useState('');
  const [branch_code, setBranchCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');

  const resetForm = () => {
    setFullname('');
    setEmployeeCode('');
    setDept('');
    setBranchCode('');
    setUsername('');
    setPassword('');
    setRole('');
  };

  if (!isOpen) {
    return null;
  }

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate all required fields
    if (!employee_code || !fullname || !branch_code || !dept || !role || !username || !password) {
      toast.error('Vui lòng điền đầy đủ tất cả các thông tin bắt buộc!');
      return;
    }

    // Additional validation
    if (username.length < 4) {
      toast.error('Tên đăng nhập phải có ít nhất 4 ký tự!');
      return;
    }

    if (password.length < 6) {
      toast.error('Mật khẩu phải có ít nhất 6 ký tự!');
      return;
    }

    onSave({
      fullname,
      employee_code,
      dept,
      branch_code,
      username,
      password,
      role,
    });
    resetForm(); // Reset form after successful submission
  };

  const handleClose = () => {
    resetForm(); // Reset form when closing modal
    onClose();
  };

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>Thêm Người dùng mới</h2>
          <button onClick={handleClose} className={styles.closeButton}>
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            <div className={styles.formGroup}>
              <label htmlFor="fullname">Mã cán bộ</label>
              <input
                id="employee_code"
                type="text"
                value={employee_code}
                onChange={(e) => setEmployeeCode(e.target.value)}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="fullname">Họ và Tên</label>
              <input
                id="fullname"
                type="text"
                value={fullname}
                onChange={(e) => setFullname(e.target.value)}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="fullname">Mã chi nhánh</label>
              <select
                id="branch_code"
                value={branch_code}
                onChange={(e) => {
                  setBranchCode(e.target.value);
                  // Reset các field phía dưới khi thay đổi chi nhánh
                  setDept('');
                  setRole('');
                  setUsername('');
                  setPassword('');
                }}
              >
                <option value="">Chọn mã chi nhánh</option>
                <option value="6421">Hội sở - 6421</option>
                <option value="6221">Chi nhánh Nam Hoa - 6221</option>
                <option value="1605">Chi nhánh 6 - 1605</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="fullname">Phòng ban</label>
              <select
                id="dept"
                value={dept}
                onChange={(e) => {
                  const newDept = e.target.value;
                  setDept(newDept);

                  // Reset các field phía dưới khi thay đổi phòng ban
                  setRole('');
                  setUsername('');
                  setPassword('');
                }}
                disabled={!branch_code} // Chỉ enable khi đã chọn chi nhánh
              >
                <option value="">Chọn phòng ban</option>
                {branch_code === '6421' ? (
                  // Hội sở - 6421: có đầy đủ các phòng ban
                  <>
                    <option value="KHCN">Khách hàng cá nhân</option>
                    <option value="KHDN">Khách hàng doanh nghiệp</option>
                    <option value="KH&QLRR">Kế hoạch & quản lý rủi ro</option>
                    <option value="KTGSNB">Kiểm tra giám sát nội bộ</option>
                    <option value="PGD">PGD Bình Tây</option>
                    <option value="BGĐ">Ban Giám đốc</option>
                    <option value="IT">IT</option>
                  </>
                ) : (
                  // Các chi nhánh khác: chỉ có phòng Khách hàng và BGĐ
                  <>
                    <option value="KH">Khách hàng</option>
                    <option value="BGĐ">Ban Giám đốc</option>
                  </>
                )}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="role">Chức vụ</label>
              <select
                id="role"
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  // Reset các field phía dưới khi thay đổi chức vụ
                  setUsername('');
                  setPassword('');
                }}
                disabled={!dept} // Chỉ enable khi đã chọn phòng ban
              >
                <option value="">Chọn chức vụ</option>
                {dept === 'BGĐ' ? (
                  // Ban Giám đốc: chỉ có Giám đốc và Phó giám đốc
                  <>
                    <option value="director">Giám đốc</option>
                    <option value="deputy_director">Phó giám đốc</option>
                  </>
                ) : dept === 'IT' ? (
                  // IT: chỉ có Administrator
                  <>
                    <option value="administrator">Administrator</option>
                  </>
                ) : dept === 'KH&QLRR' ? (
                  // Kế hoạch & quản lý rủi ro: chỉ có Chuyên viên
                  <>
                    <option value="employee">Cán bộ</option>
                    <option value="deputy_manager">Phó phòng</option>
                    <option value="manager">Trưởng phòng</option>
                  </>
                ) : (
                  // Các phòng khác: CBTD, Phó phòng, Trưởng phòng
                  <>
                    <option value="employee">Cán bộ tín dụng</option>
                    <option value="deputy_manager">Phó phòng</option>
                    <option value="manager">Trưởng phòng</option>
                  </>
                )}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="username">Tên đăng nhập</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={!role} // Chỉ enable khi đã chọn chức vụ
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="password">Mật khẩu</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={!role} // Chỉ enable khi đã chọn chức vụ
                required
              />
            </div>
          </div>
          <div className={styles.modalFooter}>
            <button type="button" className={styles.cancelButton} onClick={handleClose}>
              Hủy
            </button>
            <button type="submit" className={styles.saveButton}>
              Lưu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddUserModal;
