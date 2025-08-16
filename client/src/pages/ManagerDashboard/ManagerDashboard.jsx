import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './ManagerDashboard.module.css';
import { API_ENDPOINTS } from '../../config/api';
import CaseDetailModal from '../../components/CaseDetailModal/CaseDetailModal';
import DataTable from '../../components/DataTable/DataTable';
import { jwtDecode } from 'jwt-decode';

export default function ManagerDashboard() {
  const [cases, setCases] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [totalCases, setTotalCases] = useState(0);
  const [sortField, setSortField] = useState('');
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentUser, setCurrentUser] = useState(null);
  const [managedEmployees, setManagedEmployees] = useState([]);
  const fetchingRef = useRef(false);
  const limit = 10; // Số dòng mỗi trang
  const navigate = useNavigate();

  // Get current user from token
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setCurrentUser(decoded);
      } catch (error) {
        console.error('Error decoding token:', error);
      }
    }
  }, []);

  // Fetch managed employees for employee filter dropdown
  useEffect(() => {
    const loadEmployees = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const res = await fetch(`${API_ENDPOINTS.USERS.LIST}/managed`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setManagedEmployees(data);
        }
      } catch (e) {
        console.error('Failed to load managed employees', e);
      }
    };
    loadEmployees();
  }, []);

  // Định nghĩa fetchDepartmentCases trước khi sử dụng trong useEffect
  const fetchDepartmentCases = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token || !currentUser || fetchingRef.current) {
      if (!token) {
        navigate('/login');
      }
      return;
    }

    try {
      fetchingRef.current = true;
      setIsLoading(true);
      // Tạo URL với các tham số
      let url = `${API_ENDPOINTS.CASES.DEPARTMENT_CASES}?page=${currentPage}&limit=${limit}&search=${searchTerm}&type=${filterType}&status=${filterStatus}`;
      if (filterEmployee) {
        url += `&employee_code=${encodeURIComponent(filterEmployee)}`;
      }

      // Thêm tham số sort nếu có
      if (sortField) {
        url += `&sortBy=${sortField}&sortOrder=${sortDirection}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Không thể tải danh sách hồ sơ.');
      }

      const result = await response.json();
      setCases(result.data.cases || []);
      setTotalPages(result.data.totalPages || 1);
      setTotalCases(result.data.totalCases || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [
    currentUser,
    currentPage,
    searchTerm,
    filterType,
    filterStatus,
    filterEmployee,
    sortField,
    sortDirection,
    navigate,
  ]);

  // Effect để fetch data
  useEffect(() => {
    if (currentUser) {
      fetchDepartmentCases();
    }
  }, [fetchDepartmentCases]);

  // Effect để reset page khi filter thay đổi
  useEffect(() => {
    if (currentUser && !isInitialLoad) {
      setCurrentPage(1);
    } else if (isInitialLoad) {
      setIsInitialLoad(false);
    }
  }, [searchTerm, filterType, filterStatus, filterEmployee, sortField, sortDirection]);

  const handleViewDetail = (row) => {
    setSelectedCaseId(row.case_id);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCaseId(null);
  };

  const handleSort = (field) => {
    // Nếu click vào cùng field, đổi direction
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Field mới, set thành asc
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  // Component để hiển thị loại case (nội bảng/ngoại bảng) - đồng bộ với DirectorDashboard
  const CaseTypeBadge = ({ caseType }) => {
    const isInternal = caseType === 'internal';
    return (
      <span className={`${styles.caseTypeBadge} ${isInternal ? styles.internal : styles.external}`}>
        {isInternal ? 'Nội bảng' : 'Ngoại bảng'}
      </span>
    );
  };

  // Helper function để chuyển đổi status code thành tên hiển thị (đồng bộ với DirectorDashboard)
  const getStatusDisplayName = (status) => {
    const statusMap = {
      beingFollowedUp: 'Đang đôn đốc',
      beingSued: 'Đang khởi kiện',
      awaitingJudgmentEffect: 'Chờ hiệu lực án',
      beingExecuted: 'Đang thi hành án',
      proactivelySettled: 'Chủ động XLTS',
      debtSold: 'Bán nợ',
      amcHired: 'Thuê AMC XLN',
      // Thêm các trạng thái có thể còn thiếu
      settled: 'Đã giải quyết',
      closed: 'Đã đóng',
      pending: 'Đang chờ xử lý',
      active: 'Đang hoạt động',
      inactive: 'Không hoạt động',
      reviewing: 'Đang xem xét',
      approved: 'Đã duyệt',
      rejected: 'Bị từ chối',
    };

    // Log nếu tìm thấy status chưa được map
    if (!statusMap[status] && status) {
      console.warn(`Status chưa được map sang tiếng Việt: ${status}`);
    }

    return statusMap[status] || status;
  };

  const getStatusClass = (status) => {
    const statusClassMap = {
      beingFollowedUp: 'beingFollowedUp',
      beingSued: 'beingSued',
      awaitingJudgmentEffect: 'awaitingJudgmentEffect',
      beingExecuted: 'beingExecuted',
      proactivelySettled: 'proactivelySettled',
      debtSold: 'debtSold',
      amcHired: 'amcHired',
      // Thêm classes cho các status mới
      settled: 'settled',
      closed: 'closed',
      pending: 'pending',
      active: 'active',
      inactive: 'inactive',
      reviewing: 'reviewing',
      approved: 'approved',
      rejected: 'rejected',
    };
    return statusClassMap[status] || 'statusDefault';
  };

  // Định nghĩa columns cho DataTable
  const tableColumns = [
    {
      key: 'customer_code',
      title: 'Mã KH',
      width: '120px',
      render: (value) => <span style={{ fontWeight: '600', color: '#495057' }}>{value}</span>,
    },
    {
      key: 'customer_name',
      title: 'Tên khách hàng',
      width: '300px',
      render: (value) => (
        <span
          className="customerNameCell"
          style={{
            fontWeight: '500',
          }}
        >
          {value}
        </span>
      ),
    },
    {
      key: 'outstanding_debt',
      title: 'Dư nợ',
      width: '150px',
      sortValue: (value) => {
        // Chuyển đổi về số để sort chính xác
        const numValue = parseFloat(value);
        return isNaN(numValue) ? 0 : numValue;
      },
      render: (value) => (
        <span className="currencyCell" style={{ color: '#28a745', fontWeight: '600' }}>
          {formatCurrency(value)}
        </span>
      ),
    },
    {
      key: 'case_type',
      title: 'Loại',
      width: '120px',
      sortValue: (value) => {
        // Trả về số để sort theo thứ tự logic: Nội bảng (1) trước, Ngoại bảng (2) sau
        return value === 'internal' ? 1 : 2;
      },
      render: (value) => <CaseTypeBadge caseType={value} />,
    },
    {
      key: 'state',
      title: 'Trạng thái',
      width: '120px',
      sortValue: (value) => {
        // Sắp xếp theo thứ tự ưu tiên status codes
        const order = {
          beingFollowedUp: 1,
          beingSued: 2,
          awaitingJudgmentEffect: 3,
          beingExecuted: 4,
          proactivelySettled: 5,
          debtSold: 6,
          amcHired: 7,
        };
        return order[value] || 999;
      },
      render: (value) => (
        <span className={`statusCell ${styles[getStatusClass(value)]}`}>
          {getStatusDisplayName(value)}
        </span>
      ),
    },
    {
      key: 'created_date',
      title: 'Ngày tạo',
      width: '120px',
      sortValue: (value) => {
        // Chuyển đổi string thành Date object để sort chính xác
        return new Date(value).getTime();
      },
      render: (value) => (
        <span className="dateCell" style={{ color: '#6c757d', fontSize: '13px' }}>
          {formatDate(value)}
        </span>
      ),
    },
    {
      key: 'officer',
      title: 'Người phụ trách',
      width: '180px',
      render: (value, row) => (
        <span style={{ color: '#495057', fontWeight: '500' }}>
          {row.officer?.fullname || 'Chưa phân công'}
        </span>
      ),
    },
  ];

  if (error) {
    return (
      <div className={styles.managerDashboard}>
        <div className={styles.errorContainer}>
          <h2>Lỗi</h2>
          <p>{error}</p>
          <button onClick={() => fetchDepartmentCases()} className={styles.retryButton}>
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.managerDashboard}>
      <div className={styles.pageHeader}>
        <div className={styles.headerContent}>
          <h1>
            Hồ sơ phòng ban -{' '}
            {currentUser?.dept === 'KHCN'
              ? 'KHÁCH HÀNG CÁ NHÂN'
              : currentUser?.dept === 'KHDN'
                ? 'KHÁCH HÀNG DOANH NGHIỆP'
                : currentUser?.dept === 'KH'
                  ? 'KHÁCH HÀNG'
                  : 'PHÒNG GIAO DỊCH BÌNH TÂY'}
          </h1>
          {currentUser && (
            <div className={styles.summary}>
              <span>
                Tổng số hồ sơ: <strong>{totalCases}</strong>
              </span>
              <span className={styles.departmentInfo}>
                Phòng ban:{' '}
                <strong>
                  {currentUser?.dept === 'KHCN'
                    ? 'KHÁCH HÀNG CÁ NHÂN'
                    : currentUser?.dept === 'KHDN'
                      ? 'KHÁCH HÀNG DOANH NGHIỆP'
                      : currentUser?.dept === 'KH'
                        ? 'KHÁCH HÀNG'
                        : 'PHÒNG GIAO DỊCH BÌNH TÂY'}
                </strong>{' '}
                | Chi nhánh: <strong>{currentUser.branch_code}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bộ lọc và tìm kiếm */}
      <div className={styles.filterSection}>
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="Tìm kiếm theo tên khách hàng hoặc mã khách hàng..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        <div className={styles.filters}>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">Tất cả loại</option>
            <option value="internal">Nội bảng</option>
            <option value="external">Ngoại bảng</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="beingFollowedUp">Đang đôn đốc</option>
            <option value="beingSued">Đang khởi kiện</option>
            <option value="awaitingJudgmentEffect">Chờ hiệu lực án</option>
            <option value="beingExecuted">Đang thi hành án</option>
            <option value="proactivelySettled">Chủ động XLTS</option>
            <option value="debtSold">Bán nợ</option>
            <option value="amcHired">Thuê AMC XLN</option>
          </select>
          <select
            value={filterEmployee}
            onChange={(e) => setFilterEmployee(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">Tất cả nhân viên</option>
            {managedEmployees.map((emp) => (
              <option key={emp.employee_code} value={emp.employee_code}>
                {emp.fullname} ({emp.employee_code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Container cho DataTable với phân trang */}
      <div className={styles.tableWithPagination}>
        {/* Danh sách hồ sơ - Data Table */}
        <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', height: '630px' }}>
          <DataTable
            data={cases}
            columns={tableColumns}
            onRowAction={handleViewDetail}
            actionButtonText="Xem chi tiết"
            actionWidth="120px"
            isLoading={isLoading}
            emptyMessage="Không tìm thấy hồ sơ nào."
            sortable={true}
            onSort={handleSort}
            sortField={sortField}
            sortDirection={sortDirection}
            serverSideSort={true}
          />
        </div>

        {/* Phân trang - Fixed at bottom */}
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={styles.pageBtn}
            >
              Trang trước
            </button>
            <span className={styles.pageInfo}>
              Trang {currentPage} / {totalPages} ({totalCases} hồ sơ)
            </span>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className={styles.pageBtn}
            >
              Trang sau
            </button>
          </div>
        )}
      </div>

      {/* Modal hiển thị chi tiết case */}
      {isModalOpen && selectedCaseId && (
        <CaseDetailModal caseId={selectedCaseId} isOpen={isModalOpen} onClose={handleCloseModal} />
      )}
    </div>
  );
}
