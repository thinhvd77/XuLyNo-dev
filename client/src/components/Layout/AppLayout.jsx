import { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import styles from './AppLayout.module.css';
import toast from 'react-hot-toast';
import logo from '../../assets/logo_2.png';
import ChangePasswordModal from '../ChangePasswordModal/ChangePasswordModal';
import { useAuth } from '../../hooks/useAuth';
import { API_ENDPOINTS } from '../../config/api';

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

const NAV_CONFIG = {
  // Cấu hình menu cho từng vai trò
  administrator: [
    {
      path: '/admin',
      label: 'Quản lý người dùng',
      icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    },
    {
      path: '/delegation-management',
      label: 'Quản lý ủy quyền',
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
    },
    // { path: "/import", label: "Import", icon: "M13.5858,2 C14.0572667,2 14.5115877,2.16648691 14.870172,2.46691468 L15,2.58579 L19.4142,7 C19.7476222,7.33339556 19.9511481,7.77238321 19.9922598,8.23835797 L20,8.41421 L20,20 C20,21.0543909 19.18415,21.9181678 18.1492661,21.9945144 L18,22 L12,22 L12,20 L18,20 L18,10 L13.5,10 C12.7203294,10 12.0795543,9.40511446 12.0068668,8.64446046 L12,8.5 L12,4 L6,4 L6,12 L4,12 L4,4 C4,2.94563773 4.81587733,2.08183483 5.85073759,2.00548573 L6,2 L13.5858,2 Z M7.70705,14.4645 L10.5355,17.2929 C10.926,17.6834 10.926,18.3166 10.5355,18.7071 L7.70705,21.5355 C7.31652,21.9261 6.68336,21.9261 6.29284,21.5355 C5.90231,21.145 5.90231,20.5118 6.29284,20.1213 L7.41416,19 L3,19 C2.44772,19 2,18.5523 2,18 C2,17.4477 2.44772,17 3,17 L7.41416,17 L6.29284,15.8787 C5.90231,15.4882 5.90231,14.855 6.29284,14.4645 C6.68336,14.0739 7.31652,14.0739 7.70705,14.4645 Z M14,4.41421 L14,8 L17.5858,8 L14,4.41421 Z" },
    // { path: "/report", label: "Báo cáo", icon: "M3 3h18v18H3V3zm2 2v14h14V5H5zm4 2h6v2H9V7zm0 4h6v2H9v-2zm0 4h6v2H9v-2z" },
  ],
  director: [
    {
      path: '/director-dashboard',
      label: 'Dashboard',
      icon: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
    },
  ],
  deputy_director: [
    {
      path: '/director-dashboard',
      label: 'Dashboard',
      icon: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
    },
  ],
  manager: [
    {
      path: '/manager-dashboard',
      label: 'Hồ sơ của phòng',
      icon: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z',
    },
    {
      path: '/my-cases',
      label: 'Hồ sơ của tôi',
      icon: 'M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V6h5.17l2 2H20v10z',
    },
  ],
  deputy_manager: [
    {
      path: '/manager-dashboard',
      label: 'Hồ sơ của phòng',
      icon: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z',
    },
    {
      path: '/my-cases',
      label: 'Hồ sơ của tôi',
      icon: 'M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V6h5.17l2 2H20v10z',
    },
  ],
  employee: [], // Employee không có menu
};

function AppLayout({ children }) {
  const { user, permissions, logout } = useAuth();
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [isChangePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
  const menuRef = useRef(null);

  const [canExportReport, setCanExportReport] = useState(false);
  let navItems = [];
  if (permissions) {
    if (permissions.canAccessAdminPages) {
      navItems.push({
        path: '/admin',
        label: 'Quản lý người dùng',
        icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
      });
      navItems.push({
        path: '/delegation-management',
        label: 'Quản lý ủy quyền',
        icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      });
    }
    if (permissions.canAccessDirectorDashboard) {
      navItems.push({
        path: '/director-dashboard',
        label: 'Dashboard',
        icon: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
      });
    }
    if (permissions.canAccessManagerDashboard) {
      navItems.push({
        path: '/manager-dashboard',
        label: 'Hồ sơ của phòng',
        icon: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z',
      });
    }
    if (permissions.canAccessMyCases) {
      navItems.push({
        path: '/my-cases',
        label: 'Hồ sơ của tôi',
        icon: 'M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V6h5.17l2 2H20v10z',
      });
    }
    if (permissions.canImport) {
      navItems.push({
        path: '/import',
        label: 'Import',
        icon: 'M13.5858,2 C14.0572667,2 14.5115877,2.16648691 14.870172,2.46691468 L15,2.58579 L19.4142,7 C19.7476222,7.33339556 19.9511481,7.77238321 19.9922598,8.23835797 L20,8.41421 L20,20 C20,21.0543909 19.18415,21.9181678 18.1492661,21.9945144 L18,22 L12,22 L12,20 L18,20 L18,10 L13.5,10 C12.7203294,10 12.0795543,9.40511446 12.0068668,8.64446046 L12,8.5 L12,4 L6,4 L6,12 L4,12 L4,4 C4,2.94563773 4.81587733,2.08183483 5.85073759,2.00548573 L6,2 L13.5858,2 Z M7.70705,14.4645 L10.5355,17.2929 C10.926,17.6834 10.926,18.3166 10.5355,18.7071 L7.70705,21.5355 C7.31652,21.9261 6.68336,21.9261 6.29284,21.5355 C5.90231,21.145 5.90231,20.5118 6.29284,20.1213 L7.41416,19 L3,19 C2.44772,19 2,18.5523 2,18 C2,17.4477 2.44772,17 3,17 L7.41416,17 L6.29284,15.8787 C5.90231,15.4882 5.90231,14.855 6.29284,14.4645 C6.68336,14.0739 7.31652,14.0739 7.70705,14.4645 Z',
      });
    }
    if (permissions.canExportReport) {
      navItems.push({
        path: '/report',
        label: 'Báo cáo',
        icon: 'M3 3h18v18H3V3zm2 2v14h14V5H5zm4 2h6v2H9V7zm0 4h6v2H9v-2zm0 4h6v2H9v-2z',
      });
    }
  }
  useEffect(() => {
    const fetchExportPermission = async () => {
      try {
        if (!user) return;
        const token = localStorage.getItem('token');
        const res = await fetch(API_ENDPOINTS.REPORT.CAN_EXPORT, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setCanExportReport(!!data.canExport);
        } else {
          setCanExportReport(false);
        }
      } catch (_) {
        setCanExportReport(false);
      }
    };
    fetchExportPermission();
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePasswordSubmit = async (employeeCode, passwordData) => {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Không tìm thấy token xác thực');

    const endpoint =
      user.role === 'administrator'
        ? API_ENDPOINTS.USERS.CHANGE_PASSWORD(user.sub)
        : API_ENDPOINTS.USERS.CHANGE_MY_PASSWORD;

    const body = { newPassword: passwordData.newPassword };
    if (user.role !== 'administrator') {
      body.oldPassword = passwordData.oldPassword;
    }

    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Đổi mật khẩu thất bại');

    toast.success('Đổi mật khẩu thành công!');
    setChangePasswordModalOpen(false);
  };

  return (
    <div className={styles.appContainer}>
      <header className={styles.appHeader}>
        <div className={styles.logo}>
          <img src={logo} alt="BTP Logo" />
        </div>
        <nav className={styles.nav}>
          <ul className={styles.navList}>
            {navItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) => (isActive ? styles.active : '')}
                >
                  {item.icon && <SvgIcon path={item.icon} />}
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.userMenu} ref={menuRef}>
          <span onClick={() => setMenuOpen((prev) => !prev)}>
            <strong>{user?.fullname || '...'}</strong> ▼
          </span>
          {isMenuOpen && (
            <div className={styles.dropdownContent}>
              <a
                onClick={() => {
                  setMenuOpen(false);
                  setChangePasswordModalOpen(true);
                }}
              >
                Đổi mật khẩu
              </a>
              <a onClick={() => logout()}>Đăng xuất</a>
            </div>
          )}
        </div>
      </header>
      <main className={styles.mainContent}>{children}</main>

      <ChangePasswordModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setChangePasswordModalOpen(false)}
        onSubmit={handlePasswordSubmit}
        user={{
          fullname: user?.fullname,
          username: user?.username,
          employee_code: user?.sub,
        }}
        isAdmin={user?.role === 'administrator'}
      />
    </div>
  );
}

export default AppLayout;
