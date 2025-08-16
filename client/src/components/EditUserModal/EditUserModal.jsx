import { useState, useEffect } from 'react';
import styles from './EditUserModal.module.css';

const EditUserModal = ({ isOpen, onClose, onSubmit, user }) => {
  const [fullname, setFullname] = useState('');
  const [role, setRole] = useState('employee');
  const [dept, setDept] = useState('');
  const [branch_code, setBranchCode] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [username, setUsername] = useState('');

  useEffect(() => {
    if (user) {
      setFullname(user.fullname);
      setBranchCode(user.branch_code);
      setEmployeeCode(user.employee_code);
      setUsername(user.username);

      // Xử lý dept: nếu dept hiện tại không phù hợp với branch_code, reset về giá trị mặc định
      let finalDept;
      if (user.branch_code === '6421') {
        // Hội sở: có thể giữ dept hiện tại
        finalDept = user.dept;
      } else {
        // Chi nhánh khác: chỉ có "KH" và "BGĐ"
        if (user.dept === 'BGĐ') {
          finalDept = 'BGĐ';
        } else {
          // Nếu dept hiện tại không phải BGĐ, chuyển thành "KH" (phòng khách hàng)
          finalDept = 'KH';
        }
      }
      setDept(finalDept);

      // Xử lý role: điều chỉnh role cho phù hợp với dept mới
      let finalRole;
      if (finalDept === 'BGĐ') {
        // Ban Giám đốc: chỉ có director hoặc deputy_director
        if (['director', 'deputy_director'].includes(user.role)) {
          finalRole = user.role;
        } else {
          finalRole = 'director'; // mặc định
        }
      } else if (finalDept === 'IT') {
        finalRole = 'administrator';
      } else if (finalDept === 'KH&QLRR') {
        // Kế hoạch & quản lý rủi ro: có thể giữ role hiện tại nếu phù hợp
        if (['employee', 'deputy_manager', 'manager'].includes(user.role)) {
          finalRole = user.role;
        } else {
          finalRole = 'employee';
        }
      } else {
        // Các phòng khác (KH, KHCN, KHDN, PGD): CBTD, Phó phòng, Trưởng phòng
        if (['employee', 'deputy_manager', 'manager'].includes(user.role)) {
          finalRole = user.role;
        } else {
          finalRole = 'employee';
        }
      }
      setRole(finalRole);
    }
  }, [user]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(user.employee_code, { username, fullname, role, dept, branch_code });
  };

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>Chỉnh sửa Người dùng</h2>
          <button onClick={onClose} className={styles.closeButton}>
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            <div className={styles.formGroup}>
              <label>Mã Nhân viên</label>
              <input type="text" value={user.employee_code} />
            </div>
            <div className={styles.formGroup}>
              <label>Tên đăng nhập</label>
              <input
                type="text"
                value={username}
                id="edit-username"
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="edit-fullname">Họ và Tên</label>
              <input
                id="edit-fullname"
                type="text"
                value={fullname}
                onChange={(e) => setFullname(e.target.value)}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="edit-branch">Chi nhánh</label>
              <select
                id="edit-branch"
                value={branch_code}
                onChange={(e) => {
                  const newBranchCode = e.target.value;
                  setBranchCode(newBranchCode);
                  // Tự động điều chỉnh dept và role khi thay đổi chi nhánh
                  if (newBranchCode === '6421') {
                    // Hội sở: giữ dept hiện tại nếu hợp lệ, không thì set mặc định
                    if (!['KHCN', 'KHDN', 'KH&QLRR', 'PGD', 'BGĐ', 'IT'].includes(dept)) {
                      setDept('KHCN');
                      setRole('employee');
                    }
                  } else {
                    // Chi nhánh khác: chỉ có KH và BGĐ
                    if (dept === 'BGĐ') {
                      setDept('BGĐ');
                      if (!['director', 'deputy_director'].includes(role)) {
                        setRole('director');
                      }
                    } else {
                      setDept('KH');
                      if (!['employee', 'deputy_manager', 'manager'].includes(role)) {
                        setRole('employee');
                      }
                    }
                  }
                }}
              >
                <option value="6421">Hội sở</option>
                <option value="6221">Chi nhánh Nam Hoa</option>
                <option value="1605">Chi nhánh 6</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="edit-dept">Phòng ban</label>
              <select
                id="edit-dept"
                value={dept}
                onChange={(e) => {
                  const newDept = e.target.value;
                  setDept(newDept);
                  // Tự động set role phù hợp với dept mới
                  if (newDept === 'BGĐ') {
                    if (!['director', 'deputy_director'].includes(role)) {
                      setRole('director');
                    }
                  } else if (newDept === 'IT') {
                    setRole('administrator');
                  } else if (newDept === 'KH&QLRR') {
                    if (!['employee', 'deputy_manager', 'manager'].includes(role)) {
                      setRole('employee');
                    }
                  } else {
                    // Các phòng khác
                    if (!['employee', 'deputy_manager', 'manager'].includes(role)) {
                      setRole('employee');
                    }
                  }
                }}
              >
                {branch_code === '6421' ? (
                  // Hội sở - 6421: có đầy đủ các phòng ban
                  <>
                    <option value="KHCN">Khách hàng cá nhân</option>
                    <option value="KHDN">Khách hàng doanh nghiệp</option>
                    <option value="KH&QLRR">Kế hoạch & quản lý rủi ro</option>
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
              <label htmlFor="edit-role">Chức vụ</label>
              <select id="edit-role" value={role} onChange={(e) => setRole(e.target.value)}>
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
          </div>
          <div className={styles.modalFooter}>
            <button type="button" className={styles.cancelButton} onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className={styles.saveButton}>
              Lưu thay đổi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUserModal;
