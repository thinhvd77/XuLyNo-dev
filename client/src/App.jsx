import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './hooks/useAuth';
import AppLayout from './components/Layout/AppLayout';
import toast from 'react-hot-toast';
import { getUserDashboardRoute } from './utils/index';

// Pages
import Login from './components/Login/Login';
import MyCases from './pages/MyCases/MyCases';
import CaseDetail from './pages/CaseDetail/CaseDetail';
import UserManagement from './pages/UserManagement/UserManagement';
import DelegationManagement from './pages/DelegationManagement/DelegationManagement';
import DirectorDashboard from './pages/DirectorDashboard/DirectorDashboard';
import ManagerDashboard from './pages/ManagerDashboard/ManagerDashboard';
import ImportPage from './pages/Import/Import';
import Report from './pages/Report/Report';

// Styles
import './index.css';
import './styles/websocket.css';

// --- LOGIC PHÂN QUYỀN TẬP TRUNG ---
const checkAccess = (permissions, permissionCheck) => {
  if (!permissions) return false;
  try {
    return typeof permissionCheck === 'function' ? !!permissionCheck(permissions) : false;
  } catch {
    return false;
  }
};

const ProtectedRoute = ({ children, permissionCheck }) => {
  const { isAuthenticated, isLoading, user, permissions } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div>Loading session...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!checkAccess(permissions, permissionCheck)) {
    // Instead of just showing error, redirect to appropriate dashboard based on user role
    const redirectPath = getUserDashboardRoute(user);

    // toast.error(`Bạn không có quyền truy cập trang ${location.pathname}. Đang chuyển về trang chủ.`);
    return <Navigate to={redirectPath} replace />;
  }

  return children;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div>Loading...</div>;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return children;
};

const HomeRedirect = () => {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user) return <Navigate to="/login" replace />; // Should not happen

  const targetRoute = getUserDashboardRoute(user);

  if (targetRoute === '/') {
    // Fallback an toàn
    toast.error('Không xác định được trang chủ cho vai trò của bạn.');
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={targetRoute} replace />;
};

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route path="/" element={<HomeRedirect />} />

        <Route
          path="/director-dashboard"
          element={
            <ProtectedRoute permissionCheck={(p) => p.canAccessDirectorDashboard}>
              <AppLayout>
                <DirectorDashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/manager-dashboard"
          element={
            <ProtectedRoute permissionCheck={(p) => p.canAccessManagerDashboard}>
              <AppLayout>
                <ManagerDashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/my-cases"
          element={
            <ProtectedRoute permissionCheck={(p) => p.canAccessMyCases}>
              <AppLayout>
                <MyCases />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/case/:caseId"
          element={
            <ProtectedRoute permissionCheck={(p) => p.canAccessMyCases}>
              <AppLayout>
                <CaseDetail />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute permissionCheck={(p) => p.canAccessAdminPages}>
              <AppLayout>
                <UserManagement />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/delegation-management"
          element={
            <ProtectedRoute permissionCheck={(p) => p.canAccessAdminPages}>
              <AppLayout>
                <DelegationManagement />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/import"
          element={
            <ProtectedRoute permissionCheck={(p) => p.canImport}>
              <AppLayout>
                <ImportPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/report"
          element={
            <ProtectedRoute permissionCheck={(p) => p.canExportReport}>
              <AppLayout>
                <Report />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
