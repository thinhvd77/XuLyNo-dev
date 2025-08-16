import { useState, useEffect, useMemo } from 'react';
import { jwtDecode } from 'jwt-decode';
import toast from 'react-hot-toast';
import DataTable from '../../components/DataTable/DataTable';
import CreateDelegationModal from '../../components/CreateDelegationModal/CreateDelegationModal';
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal';
import { API_ENDPOINTS } from '../../config/api';
import webSocketService from '../../services/webSocketService';
import Pagination from '../../components/Pagination/Pagination';
import styles from './DelegationManagement.module.css';

function DelegationManagement() {
  const [delegations, setDelegations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    type: 'warning',
  });

  // Check if user is administrator
  const isAdmin = () => {
    const token = localStorage.getItem('token');
    if (!token) return false;

    try {
      const decodedUser = jwtDecode(token);
      return decodedUser.role === 'administrator';
    } catch (error) {
      return false;
    }
  };

  const fetchDelegations = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Không tìm thấy token. Vui lòng đăng nhập lại.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${API_ENDPOINTS.DELEGATIONS.LIST}?page=${page}&limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Không thể tải danh sách ủy quyền');
      }

      const data = await response.json();
      console.log('Delegation API response:', data);

      // Fix: data.data chứa object với {delegations, total, page, limit, totalPages}
      const responseData = data.data || {};
      setDelegations(responseData.delegations || []);
      setTotalPages(responseData.totalPages || 0);
      setTotalItems(responseData.total || 0);
    } catch (error) {
      console.error('Error fetching delegations:', error);
      setError(error.message);
      setDelegations([]); // Ensure it's always an array
      toast.error(`Lỗi: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin()) {
      setError('Bạn không có quyền truy cập trang này.');
      setLoading(false);
      return;
    }
    fetchDelegations();

    // Trigger immediate auto-revoke for any overdue delegations
    const runExpireOverdue = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        await fetch(API_ENDPOINTS.DELEGATIONS.EXPIRE_OVERDUE, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        // After expiring, refresh list
        fetchDelegations();
      } catch (e) {
        console.warn('Expire-overdue call failed (non-blocking):', e);
      }
    };
    runExpireOverdue();

    // Listen to websocket notifications to refresh list when auto-revoke happens
    const ws = webSocketService;
    const onExpired = () => fetchDelegations();
    ws.on('delegation-expired', onExpired);
    // Periodic refresh every 60s to keep statuses fresh
    const interval = setInterval(fetchDelegations, 60000);
    return () => {
      ws.off('delegation-expired', onExpired);
      clearInterval(interval);
    };
  }, [page]);

  const handleRevokeDelegation = async (delegationId) => {
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Không tìm thấy token. Vui lòng đăng nhập lại.');
      return;
    }

    try {
      const response = await fetch(API_ENDPOINTS.DELEGATIONS.REVOKE(delegationId), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Không thể thu hồi ủy quyền');
      }

      toast.success('Đã thu hồi ủy quyền thành công!');
      fetchDelegations(); // Refresh the list
    } catch (error) {
      console.error('Error revoking delegation:', error);
      toast.error(`Lỗi: ${error.message}`);
    }
  };

  const confirmRevokeDelegation = (delegation) => {
    setConfirmModal({
      isOpen: true,
      title: 'Xác nhận thu hồi ủy quyền',
      message: `Bạn có chắc chắn muốn thu hồi ủy quyền hồ sơ "${delegation.customer_code || delegation.case_id}" từ "${delegation.delegatee?.fullname}" không?`,
      onConfirm: () => {
        handleRevokeDelegation(delegation.delegation_id);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
      type: 'warning',
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('vi-VN');
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: { label: 'Hoạt động', className: styles.statusActive },
      expired: { label: 'Hết hạn', className: styles.statusExpired },
      revoked: { label: 'Đã thu hồi', className: styles.statusRevoked },
    };

    const config = statusConfig[status] || { label: status, className: styles.statusDefault };
    return <span className={`${styles.statusBadge} ${config.className}`}>{config.label}</span>;
  };

  const columns = [
    {
      key: 'customer_code',
      title: 'Mã hồ sơ',
      width: '150px',
      render: (value, delegation) => delegation.customer_code || delegation.case_id || 'N/A',
    },
    {
      key: 'delegator_name',
      title: 'Người ủy quyền',
      width: '200px',
      render: (value, delegation) => delegation.delegator?.fullname || 'N/A',
    },
    {
      key: 'delegatee_name',
      title: 'Người được ủy quyền',
      width: '200px',
      render: (value, delegation) => delegation.delegatee?.fullname || 'N/A',
    },
    {
      key: 'delegation_date',
      title: 'Ngày bắt đầu',
      width: '180px',
      render: (value, delegation) => formatDateTime(delegation.delegation_date),
    },
    {
      key: 'expiry_date',
      title: 'Ngày hết hạn',
      width: '180px',
      render: (value, delegation) => formatDateTime(delegation.expiry_date),
    },
    {
      key: 'status',
      title: 'Trạng thái',
      width: '120px',
      render: (value, delegation) => getStatusBadge(delegation.status),
    },
    {
      key: 'actions',
      title: 'Thao tác',
      width: '100px',
      render: (value, delegation) => (
        <div className={styles.actionButtons}>
          {delegation.status === 'active' && (
            <button
              className={`${styles.actionButton} ${styles.revokeButton}`}
              onClick={() => confirmRevokeDelegation(delegation)}
              title="Thu hồi ủy quyền"
            >
              Thu hồi
            </button>
          )}
        </div>
      ),
    },
  ];

  // Decide table sizing: more compact in this view
  const tableHeights = useMemo(
    () => ({
      containerHeight: '530px', // down from 580px default
      wrapperMaxHeight: '525px',
    }),
    [],
  );

  if (!isAdmin()) {
    return (
      <div className={styles.delegationManagement}>
        <div className={styles.errorContainer}>
          <h2>Không có quyền truy cập</h2>
          <p>Bạn không có quyền truy cập trang quản lý ủy quyền này.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.delegationManagement}>
      <div className={styles.header}>
        <h1>Quản lý Ủy quyền Hồ sơ</h1>
        <button className={styles.createButton} onClick={() => setIsCreateModalOpen(true)}>
          + Tạo ủy quyền mới
        </button>
      </div>

      {error && (
        <div className={styles.errorMessage}>
          <p>{error}</p>
        </div>
      )}

      <div className={styles.tableContainer}>
        <DataTable
          data={delegations}
          columns={columns}
          isLoading={loading}
          emptyMessage="Không có ủy quyền nào"
          containerHeight={tableHeights.containerHeight}
          wrapperMaxHeight={tableHeights.wrapperMaxHeight}
        />

        <div className={styles.paginationContainer}>
          <div className={styles.pageInfo}>
            Hiển thị {totalItems === 0 ? 0 : (page - 1) * limit + 1}-
            {Math.min(page * limit, totalItems)} trên tổng số {totalItems} ủy quyền
          </div>
          <Pagination currentPage={page} totalPages={totalPages || 1} onPageChange={setPage} />
        </div>
      </div>

      {/* Create Delegation Modal */}
      <CreateDelegationModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          setIsCreateModalOpen(false);
          fetchDelegations();
        }}
      />

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
      />
    </div>
  );
}

export default DelegationManagement;
