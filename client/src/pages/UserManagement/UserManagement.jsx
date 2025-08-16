import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import styles from './UserManagement.module.css';
import Pagination from '../../components/Pagination/Pagination';
import DataTable from '../../components/DataTable/DataTable';
import { API_ENDPOINTS } from '../../config/api';
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal';
import AddUserModal from '../../components/AddUserModal/AddUserModal';
import EditUserModal from '../../components/EditUserModal/EditUserModal';
import ChangePasswordModal from '../../components/ChangePasswordModal/ChangePasswordModal';
import PermissionModal from '../../components/admin/PermissionModal';

// Helper functions for data formatting
const getDeptDisplayName = (dept) => {
  const deptMap = {
    KHCN: 'Khách hàng cá nhân',
    KHDN: 'Khách hàng doanh nghiệp',
    'KH&QLRR': 'Kế hoạch & quản lý rủi ro',
    KTGSNB: 'Kiểm tra giám sát nội bộ',
    PGD: 'PGD Bình Tây',
    BGĐ: 'Ban Giám đốc',
    IT: 'IT',
    KH: 'Khách hàng',
  };
  return deptMap[dept] || 'Chưa xác định';
};

const getRoleDisplayName = (role, dept) => {
  if (role === 'employee' && dept === 'KH&QLRR') {
    return 'Cán bộ';
  }
  const roleMap = {
    employee: 'Cán bộ tín dụng',
    manager: 'Trưởng phòng',
    deputy_manager: 'Phó phòng',
    director: 'Giám đốc',
    deputy_director: 'Phó giám đốc',
    administrator: 'Administrator',
  };
  return roleMap[role] || 'Chưa xác định';
};

const getBranchDisplayName = (branchCode) => {
  const branchMap = {
    6421: 'Hội sở',
    6221: 'Chi nhánh Nam Hoa',
    1605: 'Chi nhánh 6',
  };
  return branchMap[branchCode] || 'Chưa xác định';
};

// Status Badge Component
const StatusBadge = ({ status }) => {
  // Handle both "active" and "disabled" status values
  const isActive = status === 'active';
  const cssClass = isActive ? 'active' : 'disabled';
  const displayText = isActive ? 'Hoạt động' : 'Vô hiệu hóa';

  return <span className={`${styles.statusBadge} ${styles[cssClass]}`}>{displayText}</span>;
};

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(11);
  const [sortField, setSortField] = useState('');
  const [sortDirection, setSortDirection] = useState('asc');
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Force refresh trigger
  // Filter states
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    type: 'warning',
  });
  const navigate = useNavigate();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [userForPasswordChange, setUserForPasswordChange] = useState(null);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [userForPermission, setUserForPermission] = useState(null);

  useEffect(() => {
    const fetchUsers = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Build query parameters for filters
        const params = new URLSearchParams();
        if (selectedDept && selectedDept !== 'all') {
          params.append('dept', selectedDept);
        }
        if (selectedBranch && selectedBranch !== 'all') {
          params.append('branch_code', selectedBranch);
        }

        const url = `${API_ENDPOINTS.USERS.LIST}${params.toString() ? `?${params.toString()}` : ''}`;

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Không thể tải dữ liệu người dùng.');
        }

        const data = await response.json();
        // Ensure we always set an array, handle different API response structures
        const usersArray = Array.isArray(data) ? data : data.data || data.users || [];
        setUsers(usersArray);
      } catch (err) {
        setError(err.message);
        toast.error(`Lỗi: ${err.message}`);
        // Ensure users remains an array even on error
        setUsers([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [navigate, refreshTrigger, selectedDept, selectedBranch]); // Add filter dependencies

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Define action buttons configuration for DataTable
  const getActionButtons = (user) => [
    {
      text: 'Sửa',
      onClick: () => openEditModal(user),
      className: styles.actionButton,
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" >
          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
        </svg>
      ),
    },
    {
      text: 'Phân quyền',
      onClick: () => openPermissionModal(user),
      className: `${styles.actionButton} ${styles.secondary}`,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 2a4 4 0 00-4 4v2H5a3 3 0 00-3 3v4a3 3 0 003 3h10a3 3 0 003-3v-4a3 3 0 00-3-3h-1V6a4 4 0 00-4-4zm-2 6V6a2 2 0 114 0v2H8z" />
        </svg>
      ),
    },
    {
      text: user.status === 'active' ? 'Vô hiệu hóa' : 'Kích hoạt',
      onClick: () => handleDisableUser(user.employee_code),
      className: `${styles.actionButton} ${styles.disable}`,
      icon:
        user.status === 'active' ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            height="24px"
            viewBox="0 0 24 24"
            width="24px"
            fill="currentColor"
          >
            <g>
              <rect fill="none" height="24" width="24" />
            </g>
            <g>
              <g>
                <path d="M15.18,10.94c0.2-0.44,0.32-0.92,0.32-1.44C15.5,7.57,13.93,6,12,6c-0.52,0-1,0.12-1.44,0.32L15.18,10.94z" />
                <path d="M12,2C6.48,2,2,6.48,2,12s4.48,10,10,10s10-4.48,10-10S17.52,2,12,2z M12,15c-2.32,0-4.45,0.8-6.14,2.12 C4.7,15.73,4,13.95,4,12c0-1.85,0.63-3.55,1.69-4.9l2.86,2.86c0.21,1.56,1.43,2.79,2.99,2.99l2.2,2.2C13.17,15.05,12.59,15,12,15z M18.31,16.9L7.1,5.69C8.45,4.63,10.15,4,12,4c4.42,0,8,3.58,8,8C20,13.85,19.37,15.54,18.31,16.9z" />
              </g>
            </g>
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            height="24px"
            viewBox="0 0 24 24"
            width="24px"
            fill="currentColor"
          >
            <g>
              <rect fill="none" height="24" width="24" />
            </g>
            <g>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-4.43-.82-6.14-2.88C7.55 15.8 9.68 15 12 15s4.45.8 6.14 2.12C16.43 19.18 14.03 20 12 20z" />
            </g>
          </svg>
        ),
    },
    {
      text: 'Đổi mật khẩu',
      onClick: () => openChangePasswordModal(user),
      className: `${styles.actionButton} ${styles.changePassword}`,
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    {
      text: 'Quyền xuất BC',
      onClick: () => toggleExportPermission(user.employee_code),
      className: `${styles.actionButton} ${styles.secondary}`,
      disabled: user.role === 'administrator' || user.dept === 'KH&XLRR' || user.dept === 'KH&QLRR',
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 5a2 2 0 012-2h6l2 2h4a2 2 0 012 2v2H2V5zM2 11h16v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
        </svg>
      ),
    },
    {
      text: 'Xóa',
      onClick: () => handleDeleteUser(user.employee_code),
      className: `${styles.actionButton} ${styles.delete}`,
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
  ];

  const openPermissionModal = (user) => {
    setUserForPermission(user);
    setIsPermissionModalOpen(true);
  };

  const closePermissionModal = () => {
    setIsPermissionModalOpen(false);
    setUserForPermission(null);
  };

  // Custom action renderer for DataTable that shows multiple action buttons
  const renderActionCell = (user) => (
    <div className={styles.actionCell}>
      {getActionButtons(user).map((button, index) => (
        <button key={index} className={button.className} onClick={button.onClick} title={button.text}>
          {button.icon}
        </button>
      ))}
    </div>
  );

  // Column definitions for DataTable
  const tableColumns = [
    {
      key: 'employee_code',
      title: 'Mã Nhân viên',
      // width: '100px',
      render: (value) => <span style={{ fontWeight: '600', color: '#495057' }}>{value}</span>,
    },
    {
      key: 'fullname',
      title: 'Họ và Tên',
      // width: '220px',
      render: (value) => <span style={{ fontWeight: '500' }}>{value}</span>,
    },
    {
      key: 'username',
      title: 'Tên đăng nhập',
      // width: '140px'
    },
    {
      key: 'dept',
      title: 'Phòng ban',
      // width: '180px',
      sortValue: (value) => getDeptDisplayName(value),
      render: (value) => getDeptDisplayName(value),
    },
    {
      key: 'role',
      title: 'Chức vụ',
      // width: '140px',
      sortValue: (value, row) => getRoleDisplayName(value, row.dept),
      render: (value, row) => getRoleDisplayName(value, row.dept),
    },
    {
      key: 'branch_code',
      title: 'Chi nhánh',
      // width: '130px',
      sortValue: (value) => getBranchDisplayName(value),
      render: (value) => getBranchDisplayName(value),
    },
    {
      key: 'status',
      title: 'Trạng thái',
      // width: '100px',
      sortValue: (value) => (value === 'active' ? 'Hoạt động' : 'Vô hiệu hóa'),
      render: (value) => <StatusBadge status={value} />,
    },
    {
      key: 'can_export',
      title: 'Xuất BC',
      sortValue: (value) => (value ? 'Có' : 'Không'),
      render: (value, row) => {
        const isDefaultAccess = row.role === 'administrator' || row.dept === 'KH&XLRR' || row.dept === 'KH&QLRR';
        const effective = isDefaultAccess ? true : !!value;
        return (
          <span className={`${styles.statusBadge} ${effective ? styles.active : styles.disabled}`}>
            {effective ? 'Có' : 'Không'}
          </span>
        );
      },
    },
    {
      key: 'actions',
      title: 'Hành động',
      // width: '280px',
      render: (value, row) => renderActionCell(row),
      sortable: false,
    },
  ];

  const filteredUsers = useMemo(() => {
    // Ensure users is always an array
    const usersArray = Array.isArray(users) ? users : [];

    // Since department and branch filtering is now done server-side,
    // we only need to handle the search term filtering here
    if (!searchTerm) {
      return usersArray;
    }

    return usersArray.filter(
      (user) =>
        user.employee_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.fullname.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [users, searchTerm]); // Remove selectedDept and selectedBranch dependencies since they're server-side now

  const totalPages = Math.ceil((filteredUsers?.length || 0) / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentUsers = Array.isArray(filteredUsers)
    ? filteredUsers.slice(indexOfFirstItem, indexOfLastItem)
    : [];

  const handleAddUser = async (newUserData) => {
    // Show confirmation dialog before proceeding
    setConfirmModal({
      isOpen: true,
      title: 'Xác nhận thêm người dùng',
      message: `Bạn có chắc chắn muốn thêm người dùng mới "${newUserData.fullname}"?`,
      type: 'warning',
      onConfirm: async () => {
        const token = localStorage.getItem('token');
        if (!token) {
          navigate('/login');
          return;
        }

        try {
          const response = await fetch(API_ENDPOINTS.USERS.CREATE, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(newUserData),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Không thể tạo người dùng.');
          }

          const responseData = await response.json();

          // Close modal first
          setIsAddModalOpen(false);

          // Show success message
          toast.success('Thêm người dùng mới thành công!');

          // Trigger refresh to reload data from server with current filters
          setRefreshTrigger((prev) => prev + 1);
        } catch (err) {
          toast.error(`Lỗi: ${err.message}`);
        } finally {
          // Close the confirmation modal
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Export permission management
  const [whitelist, setWhitelist] = useState([]);

  const loadWhitelist = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(API_ENDPOINTS.REPORT.EXPORT_WHITELIST, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const list = data.employees || [];
        setWhitelist(list);
        // merge indicator into users state for UI
        setUsers((prev) => (Array.isArray(prev) ? prev.map((u) => ({ ...u, can_export: list.includes(u.employee_code) })) : prev));
      }
    } catch (_) {}
  };

  useEffect(() => {
    loadWhitelist();
  }, [refreshTrigger]);

  const toggleExportPermission = async (employeeCode) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const isAllowed = whitelist.includes(employeeCode);
      const res = await fetch(
        isAllowed ? `${API_ENDPOINTS.REPORT.EXPORT_WHITELIST}/${employeeCode}` : API_ENDPOINTS.REPORT.EXPORT_WHITELIST,
        {
          method: isAllowed ? 'DELETE' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: isAllowed ? undefined : JSON.stringify({ employeeCode }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Không thể cập nhật quyền xuất báo cáo.');
      }
      const data = await res.json();
      const list = data.employees || [];
      setWhitelist(list);
      setUsers((prev) => (Array.isArray(prev) ? prev.map((u) => ({ ...u, can_export: list.includes(u.employee_code) })) : prev));
      toast.success('Cập nhật quyền xuất báo cáo thành công');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const openEditModal = (user) => {
    setCurrentUser(user);
    setIsEditModalOpen(true);
  };

  const handleEditUser = async (userId, updatedData) => {
    // Show confirmation dialog before proceeding
    setConfirmModal({
      isOpen: true,
      title: 'Xác nhận cập nhật người dùng',
      message: `Bạn có chắc chắn muốn cập nhật thông tin người dùng này?`,
      type: 'warning',
      onConfirm: async () => {
        const token = localStorage.getItem('token');
        if (!token) {
          navigate('/login');
          return;
        }

        try {
          const response = await fetch(API_ENDPOINTS.USERS.UPDATE(userId), {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(updatedData),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Không thể cập nhật người dùng.');
          }

          const updatedUser = await response.json();

          // Close modal and show success message
          setIsEditModalOpen(false);
          setCurrentUser(null);
          toast.success('Cập nhật người dùng thành công!');

          // Trigger refresh to reload data from server with current filters
          setRefreshTrigger((prev) => prev + 1);
        } catch (err) {
          toast.error(`Lỗi: ${err.message}`);
        } finally {
          // Close the confirmation modal
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const openChangePasswordModal = (user) => {
    setUserForPasswordChange(user);
    setIsChangePasswordModalOpen(true);
  };

  const handleChangePassword = async (userId, passwordData) => {
    // Show confirmation dialog before proceeding
    const usersArray = Array.isArray(users) ? users : [];
    const user = usersArray.find((u) => u.employee_code === userId);

    setConfirmModal({
      isOpen: true,
      title: 'Xác nhận đổi mật khẩu',
      message: `Bạn có chắc chắn muốn đổi mật khẩu cho người dùng "${user?.fullname || userId}"?`,
      type: 'warning',
      onConfirm: async () => {
        const token = localStorage.getItem('token');
        if (!token) {
          navigate('/login');
          return;
        }

        try {
          const response = await fetch(API_ENDPOINTS.USERS.CHANGE_PASSWORD(userId), {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(passwordData),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Không thể đổi mật khẩu.');
          }

          setIsChangePasswordModalOpen(false);
          setUserForPasswordChange(null);
          toast.success('Đổi mật khẩu thành công!');
        } catch (err) {
          toast.error(`Lỗi: ${err.message}`);
        } finally {
          // Close the confirmation modal
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleDisableUser = async (userId) => {
    const usersArray = Array.isArray(users) ? users : [];
    const user = usersArray.find((u) => u.employee_code === userId);
    if (!user) return;

    const action = user.status === 'active' ? 'vô hiệu hóa' : 'kích hoạt';

    setConfirmModal({
      isOpen: true,
      title: `Xác nhận ${action} người dùng`,
      message: `Bạn có chắc chắn muốn ${action} người dùng "${user.fullname}"?`,
      type: 'warning',
      onConfirm: async () => {
        const token = localStorage.getItem('token');
        if (!token) {
          navigate('/login');
          return;
        }

        try {
          const response = await fetch(API_ENDPOINTS.USERS.TOGGLE_STATUS(userId), {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Không thể ${action} người dùng.`);
          }

          // Get the response data
          const responseData = await response.json();

          toast.success(
            `${action.charAt(0).toUpperCase() + action.slice(1)} người dùng thành công!`,
          );

          // Trigger refresh to reload data from server with current filters
          setRefreshTrigger((prev) => prev + 1);
        } catch (err) {
          toast.error(`Lỗi: ${err.message}`);
        } finally {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleDeleteUser = async (userId) => {
    const usersArray = Array.isArray(users) ? users : [];
    const user = usersArray.find((u) => u.employee_code === userId);
    if (!user) return;

    setConfirmModal({
      isOpen: true,
      title: 'Xác nhận xóa người dùng',
      message: `Bạn có chắc chắn muốn xóa người dùng "${user.fullname}"? Hành động này không thể hoàn tác.`,
      type: 'danger',
      onConfirm: async () => {
        const token = localStorage.getItem('token');
        if (!token) {
          navigate('/login');
          return;
        }

        try {
          const response = await fetch(API_ENDPOINTS.USERS.DELETE(userId), {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Không thể xóa người dùng.');
          }

          toast.success('Xóa người dùng thành công!');

          // Trigger refresh to reload data from server with current filters
          setRefreshTrigger((prev) => prev + 1);
        } catch (err) {
          toast.error(`Lỗi: ${err.message}`);
        } finally {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  if (isLoading) {
    return <div className={styles.loading}>Đang tải dữ liệu người dùng...</div>;
  }

  if (error) {
    return <div className={styles.error}>Lỗi: {error}</div>;
  }

  return (
    <>
      <div className={styles.pageHeader}>
        <h1>Quản lý Người dùng</h1>
        <button className={styles.addButton} onClick={() => setIsAddModalOpen(true)}>
          <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
            <path
              fillRule="evenodd"
              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
          Thêm Người dùng
        </button>
      </div>

      <div className={styles.card}>
        <div className={styles.filterBar}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Tìm theo Mã NV, Tên, Tên đăng nhập..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1); // Reset to first page when search term changes
            }}
          />

          <div className={styles.filterControls}>
            <div className={styles.filterGroup}>
              <label htmlFor="dept-filter">Phòng ban:</label>
              <select
                id="dept-filter"
                className={styles.filterSelect}
                value={selectedDept}
                onChange={(e) => {
                  setSelectedDept(e.target.value);
                  setCurrentPage(1); // Reset to first page when filter changes
                }}
              >
                <option value="all">Tất cả phòng ban</option>
                <option value="KHCN">Khách hàng cá nhân</option>
                <option value="KHDN">Khách hàng doanh nghiệp</option>
                <option value="KH&QLRR">Kế hoạch & quản lý rủi ro</option>
                <option value="PGD">PGD Bình Tây</option>
                <option value="BGĐ">Ban Giám đốc</option>
                <option value="IT">IT</option>
                <option value="KH">Khách hàng</option>
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label htmlFor="branch-filter">Chi nhánh:</label>
              <select
                id="branch-filter"
                className={styles.filterSelect}
                value={selectedBranch}
                onChange={(e) => {
                  setSelectedBranch(e.target.value);
                  setCurrentPage(1); // Reset to first page when filter changes
                }}
              >
                <option value="all">Tất cả chi nhánh</option>
                <option value="6421">Hội sở</option>
                <option value="6221">Chi nhánh Nam Hoa</option>
                <option value="1605">Chi nhánh 6</option>
              </select>
            </div>

            {(selectedDept !== 'all' || selectedBranch !== 'all') && (
              <button
                className={styles.clearFiltersButton}
                onClick={() => {
                  setSelectedDept('all');
                  setSelectedBranch('all');
                  setCurrentPage(1);
                }}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
                Xóa bộ lọc
              </button>
            )}
          </div>
        </div>

        <div className={styles.tableWrapper}>
          <DataTable
            data={currentUsers}
            columns={tableColumns}
            isLoading={isLoading}
            emptyMessage="Không có người dùng nào."
            sortable={true}
            onSort={handleSort}
            sortField={sortField}
            sortDirection={sortDirection}
            serverSideSort={false}
            showActionColumn={false} // We handle actions in the custom column
          />

          <div className={styles.paginationContainer}>
            <div className={styles.rowsPerPageSelector}>
              <span>Hiển thị:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
              >
                <option value={11}>11 dòng</option>
                <option value={15}>15 dòng</option>
                <option value={20}>20 dòng</option>
              </select>
            </div>
            <div className={styles.pageInfo}>
              Hiển thị {indexOfFirstItem + 1}-
              {Math.min(indexOfLastItem, filteredUsers?.length || 0)} trên tổng số{' '}
              {filteredUsers?.length || 0} người dùng
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddUserModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleAddUser}
      />

      <EditUserModal
        isOpen={isEditModalOpen}
        user={currentUser}
        onClose={() => {
          setIsEditModalOpen(false);
          setCurrentUser(null);
        }}
        onSubmit={handleEditUser}
      />

      <ChangePasswordModal
        isOpen={isChangePasswordModalOpen}
        user={userForPasswordChange}
        onClose={() => {
          setIsChangePasswordModalOpen(false);
          setUserForPasswordChange(null);
        }}
        onSubmit={handleChangePassword}
        isAdmin={true}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
      />

      <PermissionModal
        isOpen={isPermissionModalOpen}
        onClose={closePermissionModal}
        userId={userForPermission?.employee_code}
        onSuccess={(msg) => {
          toast.success(msg || 'Cập nhật quyền hạn thành công');
          // Optional: refresh if needed
        }}
        onError={(msg) => toast.error(msg || 'Có lỗi khi cập nhật quyền hạn')}
      />
    </>
  );
}

export default UserManagement;
