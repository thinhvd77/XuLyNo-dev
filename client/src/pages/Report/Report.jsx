import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import styles from './Report.module.css';
import toast from 'react-hot-toast';
import API_BASE_URL, { API_ENDPOINTS } from '../../config/api';

function Report() {
  const { user, permissions } = useAuth();
  const isAdmin = user?.role === 'administrator';
  const deptDefault = ['KH&QLRR', 'KH&XLRR'];
  const hasDefaultExport = isAdmin || (user && deptDefault.includes(user.dept));
  const isDelegatedExporter = permissions?.canExportReport && !hasDefaultExport;
  const isEmployeeDelegatedExporter = user?.role === 'employee' && isDelegatedExporter;
  const isMgrOrDeputy = user && (user.role === 'manager' || user.role === 'deputy_manager');
  const isManagerException = user && user.role === 'manager' && ['KHDN', 'KTGSNB'].includes(user.dept);
  
  // Check if user has department-level permissions (can see department data)
  const hasDepartmentAccess = permissions?._db?.view_department_cases || 
                              permissions?._db?.export_department_data || 
                              permissions?._db?.export_department_cases ||
                              isMgrOrDeputy || 
                              isAdmin || 
                              hasDefaultExport;
  
  // Only hide employee filter for users who can ONLY see their own cases
  const shouldHideEmployeeFilter = isEmployeeDelegatedExporter && !hasDepartmentAccess;
  const hideBranchDeptForMgr = isDelegatedExporter && isMgrOrDeputy && !isManagerException;
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filterOptions, setFilterOptions] = useState({
    statuses: [],
    branches: [],
    departments: [],
    employees: [],
  });
  const [filteredEmployees, setFilteredEmployees] = useState([]); // New state for filtered employees
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [filters, setFilters] = useState({
    status: '',
    caseType: '',
    branch: '',
    department: '',
    employeeCode: '',
    startDate: '',
    endDate: '',
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  // Lấy danh sách options cho filter
  useEffect(() => {
    fetchFilterOptions();
    if (shouldHideEmployeeFilter) {
      // No extra fetches needed for employee delegates with limited permissions
      return;
    }
    if (hideBranchDeptForMgr) {
      // Only load employees restricted to manager/deputy manager's department
      fetchEmployees(undefined, user?.dept || null);
      return;
    }
    
    // For employees with department access, load department employees
    if (hasDepartmentAccess && user?.role === 'employee' && user?.dept) {
      fetchEmployees(undefined, user.dept);
      return;
    }
    
    // Default: load all filters
    fetchBranches();
    fetchDepartments();
    fetchEmployees();
  }, [shouldHideEmployeeFilter, hideBranchDeptForMgr, user?.dept, permissions?._db]);

  // Update filtered employees when branch or department filter changes
  useEffect(() => {
    updateFilteredEmployees();
  }, [filters.branch, filters.department, employees]);

  const updateFilteredEmployees = () => {
    let filtered = employees;

    // Filter by branch if selected
    if (filters.branch && filters.branch !== '') {
      filtered = filtered.filter((emp) => emp.branch_code === filters.branch);
    }

    // Filter by department if selected
    if (filters.department && filters.department !== '') {
      filtered = filtered.filter((emp) => emp.dept === filters.department);
    }

    setFilteredEmployees(filtered);
  };

  const fetchFilterOptions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/report/filters`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

      if (response.ok) {
        const result = await response.json();
        setFilterOptions(result.data);
      } else {
        toast.error('Lỗi khi tải danh sách bộ lọc');
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
      toast.error('Lỗi kết nối khi tải bộ lọc');
    }
  };

  const fetchBranches = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(API_ENDPOINTS.USERS.BRANCHES_FOR_FILTER, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setBranches(result.branches || []);
      }
    } catch (error) {
      // Silent fail for branches - not critical for app functionality
    }
  };

  const fetchDepartments = async (branchCode = null) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const url = branchCode
        ? `${API_ENDPOINTS.USERS.DEPARTMENTS_FOR_FILTER}?branchCode=${branchCode}`
        : API_ENDPOINTS.USERS.DEPARTMENTS_FOR_FILTER;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setDepartments(result.departments || []);
      }
    } catch (error) {
      setDepartments([]);
      // Silent fail for departments - not critical for app functionality
    }
  };

  const fetchEmployees = async (branchCode = null, departmentCode = null) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (branchCode && branchCode !== 'all') {
        params.append('branchCode', branchCode);
      }
      if (departmentCode && departmentCode !== 'all') {
        params.append('departmentCode', departmentCode);
      }

      const url = params.toString()
        ? `${API_ENDPOINTS.USERS.EMPLOYEES_FOR_FILTER}?${params.toString()}`
        : API_ENDPOINTS.USERS.EMPLOYEES_FOR_FILTER;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setEmployees(result.employees || []);
      } else {
        setEmployees([]);
        if (response.status === 403) {
          toast.error('Không có quyền truy cập danh sách nhân viên');
        }
      }
    } catch (error) {
      setEmployees([]);
      toast.error('Lỗi khi tải danh sách nhân viên');
    }
  };

  // Lấy dữ liệu báo cáo
  const fetchReportData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const queryParams = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });

      const response = await fetch(`${API_BASE_URL}/api/report/data?${queryParams}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

      if (response.ok) {
        const result = await response.json();
        setReportData(result.data);
        setCurrentPage(1);
        toast.success(`Đã tải ${result.total} bản ghi`);
      } else {
        toast.error('Lỗi khi tải dữ liệu báo cáo');
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
      toast.error('Lỗi kết nối khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  // Xuất Excel (tổng hợp: ghi chú công khai mới nhất trong ngày mới nhất của từng hồ sơ)
  const exportToExcel = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });

      const response = await fetch(`${API_BASE_URL}/api/report/export?${queryParams.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          toast.error('Không có dữ liệu để xuất');
        } else {
          toast.error('Lỗi khi xuất báo cáo');
        }
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BaoCao_TongHop_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Xuất báo cáo thành công!');
    } catch (error) {
      console.error('Error exporting report:', error);
      toast.error('Lỗi kết nối khi xuất báo cáo');
    } finally {
      setExporting(false);
    }
  };

  // Xử lý thay đổi filter với cascading logic
  const handleFilterChange = (key, value) => {
    switch (key) {
      case 'branch':
        setFilters((prev) => ({
          ...prev,
          branch: value,
          department: '', // Reset department when branch changes
          employeeCode: '', // Reset employee when branch changes
        }));

        // Fetch departments based on selected branch
        if (value && value !== '') {
          fetchDepartments(value);
        } else {
          fetchDepartments(); // Load all departments if no branch selected
        }

        // Fetch employees based on selected branch
        fetchEmployees(value, '');
        break;
      case 'department':
        setFilters((prev) => ({
          ...prev,
          department: value,
          employeeCode: '', // Reset employee when department changes
        }));

        // Fetch employees based on selected branch and department
        fetchEmployees(filters.branch, value);
        break;
      default:
        setFilters((prev) => ({ ...prev, [key]: value }));
        break;
    }
  };

  // Reset filters
  const resetFilters = () => {
    setFilters({
      status: '',
      caseType: '',
      branch: '',
      department: '',
      employeeCode: '',
      startDate: '',
      endDate: '',
    });
    setReportData([]);

    // Reset data to initial state
    fetchEmployees();
    fetchDepartments();
  };

  // Pagination
  const totalPages = Math.ceil(reportData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = reportData.slice(startIndex, endIndex);

  // Format currency
  const formatCurrency = (amount) => {
    if (!amount) return '';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  return (
    <div className={styles.reportPage}>
      <div className={styles.pageHeader}>
        <h1>Báo cáo xuất Excel</h1>
      </div>

      <div className={styles.card}>
        {/* Bộ lọc */}
        <div className={styles.filterSection}>
          <h3>Bộ lọc báo cáo</h3>

          <div className={styles.filterGrid}>
            {/* Trạng thái khoản vay */}
            <div className={styles.filterGroup}>
              <label>Trạng thái khoản vay</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className={styles.filterSelect}
              >
                <option value="">Tất cả trạng thái</option>
                {(filterOptions.statuses || []).map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Loại Case */}
            <div className={styles.filterGroup}>
              <label>Loại</label>
              <select
                value={filters.caseType}
                onChange={(e) => handleFilterChange('caseType', e.target.value)}
                className={styles.filterSelect}
              >
                <option value="">Tất cả loại case</option>
                <option value="internal">Nội bảng</option>
                <option value="external">Ngoại bảng</option>
              </select>
            </div>

            {/* Chi nhánh */}
            {!isEmployeeDelegatedExporter && !hideBranchDeptForMgr && (
              <div className={styles.filterGroup}>
                <label>Chi nhánh</label>
                <select
                  value={filters.branch}
                  onChange={(e) => handleFilterChange('branch', e.target.value)}
                  className={styles.filterSelect}
                >
                  <option value="">Tất cả chi nhánh</option>
                  {branches.map((branch) => (
                    <option key={branch.branch_code} value={branch.branch_code}>
                      {branch.branch_code === '6421'
                        ? 'Hội sở'
                        : branch.branch_code === '6221'
                          ? 'Chi nhánh Nam Hoa'
                          : 'Chi nhánh 6'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Phòng ban */}
            {!isEmployeeDelegatedExporter && !hideBranchDeptForMgr && (
              <div className={styles.filterGroup}>
                <label>Phòng ban</label>
                <select
                  value={filters.department}
                  onChange={(e) => handleFilterChange('department', e.target.value)}
                  className={styles.filterSelect}
                >
                  <option value="">Tất cả phòng ban</option>
                  {departments.map((department) => (
                    <option key={department.department_code} value={department.department_code}>
                      {department.department_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* CBTD */}
            {!shouldHideEmployeeFilter && (
              <div className={styles.filterGroup}>
                <label>Cán bộ tín dụng</label>
                <select
                  value={filters.employeeCode}
                  onChange={(e) => handleFilterChange('employeeCode', e.target.value)}
                  className={styles.filterSelect}
                >
                  <option value="">Tất cả CBTD</option>
                  {filteredEmployees.map((emp) => (
                    <option key={emp.employee_code} value={emp.employee_code}>
                      {emp.fullname} ({emp.employee_code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Từ ngày */}
            <div className={styles.filterGroup}>
              <label>Từ ngày</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className={styles.filterInput}
              />
            </div>

            {/* Đến ngày */}
            <div className={styles.filterGroup}>
              <label>Đến ngày</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className={styles.filterInput}
              />
            </div>
          </div>

          <div className={styles.filterActions}>
            <button onClick={fetchReportData} disabled={loading} className={styles.searchBtn}>
              {loading ? 'Đang tải...' : 'Tìm kiếm'}
            </button>
            <button onClick={resetFilters} className={styles.resetBtn}>
              Đặt lại
            </button>
            <button
              onClick={exportToExcel}
              disabled={exporting || reportData.length === 0}
              className={styles.exportBtn}
            >
              {exporting ? 'Đang xuất...' : 'Xuất Excel'}
            </button>
          </div>
        </div>

        {/* Kết quả */}
        {reportData.length > 0 && (
          <div className={styles.resultsSection}>
            <div className={styles.resultsHeader}>
              <h3>Kết quả tìm kiếm</h3>
              <span className={styles.resultCount}>Tổng: {reportData.length} bản ghi</span>
            </div>

            <div className={styles.tableContainer}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Mã KH</th>
                    <th>Tên KH</th>
                    <th>Trạng thái</th>
                    <th>Loại Case</th>
                    <th>Chi nhánh</th>
                    <th>CBTD</th>
                    <th>Ghi chú mới nhất</th>
                    <th>Ngày cập nhật</th>
                  </tr>
                </thead>
                <tbody>
                  {currentData.map((row, index) => (
                    <tr key={`${row.customer_code}-${index}`}>
                      <td>{row.customer_code}</td>
                      <td>{row.customer_name}</td>
                      <td>
                        <span className={styles.statusBadge}>{row.state}</span>
                      </td>
                      <td>
                        <span
                          className={`${styles.typeBadge} ${row.case_type === 'NỘI BẢNG' ? 'internal' : 'external'}`}
                        >
                          {row.case_type}
                        </span>
                      </td>
                      <td>
                        {row.branch_code === '6421'
                          ? 'Hội sở'
                          : row.branch_code === '6221'
                            ? 'CN Nam Hoa'
                            : 'Chi nhánh 6'}
                      </td>
                      <td>{row.officer_fullname || 'Chưa phân công'}</td>
                      <td className={styles.updateContent}>
                        {row.last_public_note_content || 'Chưa có ghi chú'}
                      </td>
                      <td>{formatDate(row.created_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className={styles.pageBtn}
                >
                  Trước
                </button>

                <span className={styles.pageInfo}>
                  Trang {currentPage} / {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className={styles.pageBtn}
                >
                  Sau
                </button>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!loading && reportData.length === 0 && (
          <div className={styles.emptyState}>
            <p>Chưa có dữ liệu. Vui lòng chọn điều kiện lọc và nhấn "Tìm kiếm".</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Report;
