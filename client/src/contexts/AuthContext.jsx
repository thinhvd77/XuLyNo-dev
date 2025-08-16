import { createContext, useState, useEffect, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import API_BASE_URL, { API_ENDPOINTS } from '../config/api';
import { devLog, devWarn, devError } from '../utils/logger';
import { clearBrowserHistory, getUserDashboardRoute } from '../utils/index';

// 1. Tạo Context
export const AuthContext = createContext(null);

// 2. Tạo Provider Component (Nơi chứa logic)
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permissions, setPermissions] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const logout = useCallback(() => {
    const user = localStorage.getItem('token') ? jwtDecode(localStorage.getItem('token')) : null;

    // Log logout event (dev only)
    devLog('User logout:', {
      username: user?.username || 'unknown',
      employeeCode: user?.sub || 'unknown',
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    });

    toast.success('Bạn đã đăng xuất thành công!');
    localStorage.removeItem('token');
    setUser(null);
    setIsAuthenticated(false);

    // Clear browser history to prevent access to previous user's pages
    clearBrowserHistory('/login');
    navigate('/login', { replace: true });
  }, [navigate]);

  const initializeSession = useCallback((token) => {
    try {
      const decodedUser = jwtDecode(token);
      if (decodedUser.exp * 1000 < Date.now()) {
        devWarn('Session expired:', {
          username: decodedUser.username || 'unknown',
          employeeCode: decodedUser.sub || 'unknown',
          expiredAt: new Date(decodedUser.exp * 1000).toISOString(),
          timestamp: new Date().toISOString(),
        });
        throw new Error('Phiên đăng nhập đã hết hạn.');
      }

      // Log successful session initialization (dev only)
      devLog('Session initialized:', {
        username: decodedUser.username || 'unknown',
        employeeCode: decodedUser.sub || 'unknown',
        role: decodedUser.role || 'unknown',
        timestamp: new Date().toISOString(),
        expiresAt: new Date(decodedUser.exp * 1000).toISOString(),
      });

      setUser(decodedUser);
      setIsAuthenticated(true);
      return decodedUser;
    } catch (error) {
      devError('Session initialization failed:', {
        error: error.message,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
      });
      localStorage.removeItem('token');
      setUser(null);
      setIsAuthenticated(false);
      return null;
    }
  }, []);

  useEffect(() => {
    const checkExistingSession = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        const decoded = initializeSession(token);
        try {
          const res = await fetch(`${API_BASE_URL}/api/auth/session`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            setPermissions(data.permissions || null);
          } else {
            setPermissions(null);
          }
        } catch (_) {
          setPermissions(null);
        }
      }
      setIsLoading(false);
    };
    checkExistingSession();
  }, [initializeSession]);

  // Monitor location changes to prevent unauthorized access via browser history
  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return;

    const currentPath = location.pathname;
    const userDashboard = getUserDashboardRoute(user);

    // Define role-restricted paths that should trigger redirects
    const restrictedPaths = {
      '/admin': ['administrator'],
      '/delegation-management': ['administrator'],
      '/director-dashboard': ['director', 'deputy_director', 'manager'],
      '/manager-dashboard': ['manager', 'deputy_manager'],
      '/my-cases': ['employee', 'manager', 'deputy_manager'],
      '/import': ['employee', 'deputy_manager', 'manager'],
      '/report': ['employee', 'deputy_manager', 'manager'],
    };

    // Check if current path is restricted and user doesn't have access
    const restriction = restrictedPaths[currentPath];
    if (restriction && !restriction.includes(user.role)) {
      // Special cases for department-based access
      if (currentPath === '/director-dashboard') {
        const hasPermFlag = Boolean(permissions?.canAccessDirectorDashboard) || Boolean(permissions?._db?.access_director_dashboard);
        const hasDirectorAccess =
          hasPermFlag ||
          ['director', 'deputy_director'].includes(user.role) ||
          (user.role === 'manager' && user.dept === 'KHDN') ||
          ['KH&QLRR', 'KTGSNB'].includes(user.dept);
        if (!hasDirectorAccess) {
          devLog('Unauthorized access attempt detected:', {
            path: currentPath,
            user: user.username,
            role: user.role,
            dept: user.dept,
            redirecting: userDashboard,
          });
          // toast.error(`Truy cập không được phép. Đang chuyển về trang chủ.`);
          navigate(userDashboard, { replace: true });
          return;
        }
      } else if (['/import', '/report'].includes(currentPath)) {
        const hasAccess =
          ['employee', 'deputy_manager', 'manager'].includes(user.role) && user.dept === 'KH&QLRR';
        if (!hasAccess) {
          devLog('Unauthorized access attempt detected:', {
            path: currentPath,
            user: user.username,
            role: user.role,
            dept: user.dept,
            redirecting: userDashboard,
          });
          toast.error(`Truy cập không được phép. Đang chuyển về trang chủ.`);
          navigate(userDashboard, { replace: true });
          return;
        }
      } else {
        devLog('Unauthorized access attempt detected:', {
          path: currentPath,
          user: user.username,
          role: user.role,
          redirecting: userDashboard,
        });
        toast.error(`Truy cập không được phép. Đang chuyển về trang chủ.`);
        navigate(userDashboard, { replace: true });
        return;
      }
    }
  }, [location.pathname, isAuthenticated, user, isLoading, navigate]);

  const login = async (token) => {
    const decodedUser = initializeSession(token);
    if (decodedUser) {
      // Store previous user role to detect role changes
      const previousUser = user;

      localStorage.setItem('token', token);

      // Log successful login with user details (dev only)
      devLog('Login completed successfully:', {
        username: decodedUser.username || 'unknown',
        employeeCode: decodedUser.sub || 'unknown',
        fullname: decodedUser.fullname || 'unknown',
        role: decodedUser.role || 'unknown',
        branch_code: decodedUser.branch_code || 'unknown',
        dept: decodedUser.dept || 'unknown',
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        expiresAt: new Date(decodedUser.exp * 1000).toISOString(),
      });

      toast.success('Đăng nhập thành công!');

      // Fetch session permissions from backend
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/session`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setPermissions(data.permissions || null);
        } else {
          setPermissions(null);
        }
      } catch (_) {
        setPermissions(null);
      }

      // Get appropriate route based on user role and department (keep until routes are updated to permission-based)
      const targetRoute = getUserDashboardRoute(decodedUser);

      devLog('Navigating to:', {
        route: targetRoute,
        username: decodedUser.username,
        role: decodedUser.role,
        timestamp: new Date().toISOString(),
      });

      // Clear browser history to prevent accessing previous user's restricted pages
      // This prevents the back button from navigating to unauthorized pages
      clearBrowserHistory(targetRoute);

      navigate(targetRoute, { replace: true });
    } else {
      devError('Login failed - invalid token:', {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
      });
      toast.error('Đăng nhập thất bại, token không hợp lệ.');
    }
  };

  // 3. Cung cấp giá trị cho các component con
  const value = { user, permissions, isAuthenticated, isLoading, login, logout };

  return <AuthContext.Provider value={value}>{!isLoading && children}</AuthContext.Provider>;
};
