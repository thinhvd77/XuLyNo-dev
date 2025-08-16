import { useState, useEffect, useRef } from 'react';
import { NavLink, replace, useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import styles from './Layout.module.css';
import toast from 'react-hot-toast';
import btpLogo from '../../assets/BTP.svg';
import ChangePasswordModal from '../ChangePasswordModal/ChangePasswordModal';
import { API_ENDPOINTS } from '../../config/api';
import useSecurityHeaders from '../../hooks/useSecurityHeaders';

// Component SVG Icon để tái sử dụng
const SvgIcon = ({ path }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={styles.icon}
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d={path} />
  </svg>
);

function Layout({ children }) {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [isChangePasswordModalOpen, setChangePasswordModalOpen] = useState(false);

  const [user, setUser] = useState(null);
  const [decodedUser, setDecodedUser] = useState(null);
  const navigate = useNavigate();
  const menuRef = useRef(null);

  // Apply security headers
  useSecurityHeaders();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    // Thêm event listener khi menu mở
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    // Dọn dẹp event listener khi component unmount hoặc menu đóng
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Lỗi: Không tìm thấy token xác thực. Vui lòng đăng nhập lại.');
      window.location.replace('/login');
      navigate('/login');
    }
    const decoded = jwtDecode(token);
    setDecodedUser(decoded);

    if (decoded) {
      setUser({
        name: decoded.fullname || 'Cán bộ',
        role:
          decoded.role === 'employee'
            ? 'Cán bộ Tín dụng'
            : decoded.role === 'administrator'
              ? 'Quản trị viên'
              : decoded.role === 'manager'
                ? 'Trưởng phòng'
                : 'Người dùng',
      });
    }
  }, []);

  const handleLogout = (event) => {
    event.preventDefault();
    // Clear token
    localStorage.removeItem('token');

    // Clear browser cache và history để ngăn back button access
    if (window.history.replaceState) {
      window.history.replaceState(null, null, '/login');
    }

    // Clear tất cả cached pages
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => {
          caches.delete(name);
        });
      });
    }

    // Force reload và redirect
    toast.success('Bạn đã đăng xuất thành công!');
    window.location.replace('/login');
  };

  const handleChangePassword = (event) => {
    event.preventDefault();
    setMenuOpen(false); // Close dropdown
    setChangePasswordModalOpen(true);
  };

  const handlePasswordSubmit = async (employeeCode, passwordData) => {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Không tìm thấy token xác thực');
    }

    const isAdmin = decodedUser?.role === 'administrator';
    const endpoint = isAdmin
      ? API_ENDPOINTS.USERS.CHANGE_PASSWORD(decodedUser.employee_code) // admin route (no oldPassword)
      : API_ENDPOINTS.USERS.CHANGE_MY_PASSWORD; // self route (requires oldPassword)
    const body = isAdmin
      ? { newPassword: passwordData.newPassword }
      : { oldPassword: passwordData.oldPassword, newPassword: passwordData.newPassword };

    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (response.ok) {
      toast.success('Đổi mật khẩu thành công!');
      setChangePasswordModalOpen(false);
    } else {
      // Throw error with specific message for ChangePasswordModal to handle
      throw new Error(result.message || 'Đổi mật khẩu thất bại!');
    }
  };

  return (
    <div className={styles.appContainer}>
      <div className={styles.mainWrapper}>
        <header className={styles.appHeader}>
          <div className={styles.logo}>
            <img src={btpLogo} alt="BTP Logo" />
          </div>
          <nav>
            <ul className={styles.navList}>
              <li>
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) => (isActive ? styles.active : '')}
                  replace={true}
                >
                  <SvgIcon path="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
                  <span>Dashboard</span>
                </NavLink>
              </li>
              {/* Director Dashboard - hiển thị cho BGĐ hoặc người được cấp quyền */}
              {(user?.role === 'director' || user?.role === 'deputy_director' || permissions?.canAccessDirectorDashboard || permissions?._db?.access_director_dashboard) && (
                <li>
                  <NavLink
                    to="/director-dashboard"
                    className={({ isActive }) => (isActive ? styles.active : '')}
                  >
                    <SvgIcon path="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    <span>Dashboard GĐ</span>
                  </NavLink>
                </li>
              )}
              <li>
                <NavLink to="/import" className={({ isActive }) => (isActive ? styles.active : '')}>
                  {/* svg icon for Import files */}
                  <SvgIcon path="M13.5858,2 C14.0572667,2 14.5115877,2.16648691 14.870172,2.46691468 L15,2.58579 L19.4142,7 C19.7476222,7.33339556 19.9511481,7.77238321 19.9922598,8.23835797 L20,8.41421 L20,20 C20,21.0543909 19.18415,21.9181678 18.1492661,21.9945144 L18,22 L12,22 L12,20 L18,20 L18,10 L13.5,10 C12.7203294,10 12.0795543,9.40511446 12.0068668,8.64446046 L12,8.5 L12,4 L6,4 L6,12 L4,12 L4,4 C4,2.94563773 4.81587733,2.08183483 5.85073759,2.00548573 L6,2 L13.5858,2 Z M7.70705,14.4645 L10.5355,17.2929 C10.926,17.6834 10.926,18.3166 10.5355,18.7071 L7.70705,21.5355 C7.31652,21.9261 6.68336,21.9261 6.29284,21.5355 C5.90231,21.145 5.90231,20.5118 6.29284,20.1213 L7.41416,19 L3,19 C2.44772,19 2,18.5523 2,18 C2,17.4477 2.44772,17 3,17 L7.41416,17 L6.29284,15.8787 C5.90231,15.4882 5.90231,14.855 6.29284,14.4645 C6.68336,14.0739 7.31652,14.0739 7.70705,14.4645 Z M14,4.41421 L14,8 L17.5858,8 L14,4.41421 Z" />
                  <span>Import</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/report" className={({ isActive }) => (isActive ? styles.active : '')}>
                  <SvgIcon path="M3 3h18v18H3V3zm2 2v14h14V5H5zm4 2h6v2H9V7zm0 4h6v2H9v-2zm0 4h6v2H9v-2z" />
                  <span>Báo cáo</span>
                </NavLink>
              </li>
            </ul>
          </nav>
          <div className={styles.userMenu} ref={menuRef}>
            <span onClick={() => setMenuOpen((prev) => !prev)}>
              <strong>{user ? user.name : '...'}</strong> ▼
            </span>
            {isMenuOpen && (
              <div className={styles.dropdownContent}>
                <a onClick={handleChangePassword}>Đổi mật khẩu</a>
                <a onClick={handleLogout}>Đăng xuất</a>
              </div>
            )}
          </div>
        </header>
        <main className={styles.mainContent}>{children}</main>
      </div>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setChangePasswordModalOpen(false)}
        onSubmit={handlePasswordSubmit}
        user={decodedUser}
      />
    </div>
  );
}

export default Layout;
