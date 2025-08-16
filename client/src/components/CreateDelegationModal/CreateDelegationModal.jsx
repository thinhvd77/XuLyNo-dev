import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { API_ENDPOINTS } from '../../config/api';
import styles from './CreateDelegationModal.module.css';

const CreateDelegationModal = ({ isOpen, onClose, onSuccess }) => {
  // State quản lý các bước
  const [currentStep, setCurrentStep] = useState(1);

  // State cho các dropdown và dữ liệu
  const [employees, setEmployees] = useState([]);
  const [delegatorCases, setDelegatorCases] = useState([]);
  const [selectedDelegator, setSelectedDelegator] = useState('');
  const [selectedCases, setSelectedCases] = useState([]);
  const [selectedDelegatee, setSelectedDelegatee] = useState('');

  // New: cascading selection state for bước 1
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');

  // New: chọn theo số lượng
  const [quantitySelect, setQuantitySelect] = useState('');
  const [appendMode, setAppendMode] = useState(false);

  // State cho form
  const [formData, setFormData] = useState({
    expiryDate: '',
    notes: '',
  });

  // State cho loading và errors
  const [loading, setLoading] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [loadingCases, setLoadingCases] = useState(false);
  const [errors, setErrors] = useState({});

  // Reset form khi modal mở/đóng
  useEffect(() => {
    if (isOpen) {
      resetForm();
      fetchEmployees();
    }
  }, [isOpen]);

  const resetForm = () => {
    setCurrentStep(1);
    setSelectedDelegator('');
    setDelegatorCases([]);
    setSelectedCases([]);
    setSelectedDelegatee('');
    // reset cascading selects
    setSelectedBranch('');
    setSelectedDept('');
    // reset quantity select
    setQuantitySelect('');
    setAppendMode(false);
    setFormData({
      expiryDate: '',
      notes: '',
    });
    setErrors({});
  };

  // Fetch danh sách nhân viên
  const fetchEmployees = async () => {
    const token = localStorage.getItem('token');
    console.log('Token:', token ? 'Found' : 'Not found');

    if (!token) {
      console.error('No token found in localStorage');
      toast.error('Bạn cần đăng nhập để sử dụng tính năng này');
      return;
    }

    try {
      setLoadingEmployees(true);
      console.log('Fetching employees from:', API_ENDPOINTS.USERS.EMPLOYEES_FOR_FILTER);

      const response = await fetch(API_ENDPOINTS.USERS.EMPLOYEES_FOR_FILTER, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Employee API response status:', response.status);
      const data = await response.json();
      console.log('Employee API response data:', data);

      if (response.ok) {
        console.log('Employees loaded:', data.employees?.length || 0);
        // sort data.employees by branch_code
        data.employees.sort((a, b) => a.branch_code.localeCompare(b.branch_code));
        setEmployees(data.employees || []);
      } else {
        console.error('Failed to fetch employees:', data);
        toast.error('Không thể tải danh sách nhân viên');
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Không thể tải danh sách nhân viên');
    } finally {
      setLoadingEmployees(false);
    }
  };

  // Fetch branches

  // Fetch hồ sơ của người được chọn để ủy quyền
  const fetchDelegatorCases = async (employeeCode) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      setLoadingCases(true);
      console.log('Fetching cases for employee:', employeeCode);

      // Sử dụng endpoint BY_EMPLOYEE mới
      const response = await fetch(API_ENDPOINTS.CASES.BY_EMPLOYEE(employeeCode), {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Cases API response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Cases API response data:', data);

        // Kiểm tra cấu trúc response
        const cases = data.data || [];
        setDelegatorCases(cases);
        console.log('Cases loaded:', cases.length);
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch cases:', response.status, errorText);
        toast.error('Không thể tải danh sách hồ sơ');
      }
    } catch (error) {
      console.error('Error fetching cases:', error);
      toast.error('Không thể tải danh sách hồ sơ');
    } finally {
      setLoadingCases(false);
    }
  };

  // Derived lists for cascading selects
  const branchOptions = useMemo(() => {
    const set = new Set((employees || []).map((e) => e.branch_code).filter(Boolean));
    return Array.from(set).sort();
  }, [employees]);

  const deptOptions = useMemo(() => {
    if (!selectedBranch) return [];
    const set = new Set(
      (employees || [])
        .filter((e) => e.branch_code === selectedBranch)
        .map((e) => e.dept)
        .filter(Boolean),
    );
    return Array.from(set).sort();
  }, [employees, selectedBranch]);

  const officerOptions = useMemo(() => {
    if (!selectedBranch || !selectedDept) return [];
    return (employees || [])
      .filter((e) => e.branch_code === selectedBranch && e.dept === selectedDept)
      .map((e) => ({ code: e.employee_code, name: e.fullname || e.employee_code }));
  }, [employees, selectedBranch, selectedDept]);

  // Handlers for cascading selects
  const handleBranchChange = (value) => {
    setSelectedBranch(value);
    // reset deeper selections
    setSelectedDept('');
    if (selectedDelegator) {
      setSelectedDelegator('');
      setDelegatorCases([]);
      setSelectedCases([]);
      setCurrentStep(1);
    }
  };

  const handleDeptChange = (value) => {
    setSelectedDept(value);
    if (selectedDelegator) {
      setSelectedDelegator('');
      setDelegatorCases([]);
      setSelectedCases([]);
      setCurrentStep(1);
    }
  };

  // Xử lý chọn người ủy quyền (officer)
  const handleDelegatorChange = (employeeCode) => {
    setSelectedDelegator(employeeCode);
    setSelectedCases([]);
    if (employeeCode) {
      fetchDelegatorCases(employeeCode);
      setCurrentStep(2);
    } else {
      setCurrentStep(1);
      setDelegatorCases([]);
    }
  };

  // Xử lý chọn/bỏ chọn hồ sơ
  const handleCaseSelection = (caseId) => {
    setSelectedCases((prev) => {
      if (prev.includes(caseId)) {
        return prev.filter((id) => id !== caseId);
      } else {
        return [...prev, caseId];
      }
    });
  };

  // Xử lý chọn tất cả hồ sơ
  const handleSelectAllCases = () => {
    if (selectedCases.length === delegatorCases.length) {
      setSelectedCases([]);
    } else {
      setSelectedCases(delegatorCases.map((c) => c.case_id));
    }
  };

  // New: Xử lý chọn theo số lượng
  const handleSelectByQuantity = () => {
    const total = delegatorCases.length;
    const nRaw = parseInt(quantitySelect, 10);
    if (isNaN(nRaw) || nRaw <= 0) {
      toast.error('Vui lòng nhập số lượng hợp lệ (> 0)');
      return;
    }
    const n = Math.min(nRaw, total);

    if (n === 0) {
      setSelectedCases([]);
      return;
    }

    const firstN = delegatorCases.slice(0, n).map((c) => c.case_id);

    if (appendMode) {
      // Thêm các hồ sơ chưa có trong lựa chọn hiện tại, theo thứ tự xuất hiện
      setSelectedCases((prev) => {
        const setPrev = new Set(prev);
        const combined = [...prev];
        for (const id of firstN) {
          if (!setPrev.has(id)) combined.push(id);
        }
        return combined;
      });
    } else {
      // Thay thế danh sách lựa chọn
      setSelectedCases(firstN);
    }
  };

  // Chuyển đến bước tiếp theo
  const handleNextStep = () => {
    if (currentStep === 1) {
      if (selectedDelegator) {
        // ensure cases are loaded for the selected delegator
        if (delegatorCases.length === 0 && !loadingCases) {
          fetchDelegatorCases(selectedDelegator);
        }
        setErrors((prev) => ({ ...prev, delegator: undefined }));
        setCurrentStep(2);
      } else {
        setErrors((prev) => ({ ...prev, delegator: 'Vui lòng chọn người ủy quyền' }));
      }
      return;
    }

    if (currentStep === 2) {
      if (selectedCases.length > 0) {
        setErrors((prev) => ({ ...prev, cases: undefined }));
        setCurrentStep(3);
      } else {
        setErrors((prev) => ({ ...prev, cases: 'Vui lòng chọn ít nhất một hồ sơ' }));
      }
    }
  };

  // Quay lại bước trước
  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!selectedDelegator) {
      newErrors.delegator = 'Vui lòng chọn người ủy quyền';
    }

    if (selectedCases.length === 0) {
      newErrors.cases = 'Vui lòng chọn ít nhất một hồ sơ';
    }

    if (!selectedDelegatee) {
      newErrors.delegatee = 'Vui lòng chọn người được ủy quyền';
    }

    if (!formData.expiryDate) {
      newErrors.expiryDate = 'Vui lòng chọn ngày hết hạn';
    } else {
      const expiryDate = new Date(formData.expiryDate);
      const now = new Date();
      if (expiryDate <= now) {
        newErrors.expiryDate = 'Ngày hết hạn phải sau thời điểm hiện tại';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Không tìm thấy token. Vui lòng đăng nhập lại.');
      return;
    }

    try {
      setLoading(true);

      const delegationData = {
        case_ids: selectedCases,
        delegated_to_employee_code: selectedDelegatee,
        expiry_date: formData.expiryDate,
        notes: formData.notes,
      };

      const response = await fetch(API_ENDPOINTS.DELEGATIONS.CREATE, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(delegationData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success('Tạo ủy quyền thành công!');
        onSuccess();
        onClose();
      } else {
        toast.error(data.message || 'Có lỗi xảy ra khi tạo ủy quyền');
      }
    } catch (error) {
      console.error('Error creating delegation:', error);
      toast.error('Có lỗi xảy ra khi tạo ủy quyền');
    } finally {
      setLoading(false);
    }
  };

  // Tìm tên nhân viên theo mã
  const getEmployeeName = (employeeCode) => {
    const employee = employees.find((emp) => emp.employee_code === employeeCode);
    return employee ? `${employee.fullname}` : employeeCode;
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Tạo Ủy quyền Hồ sơ</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.stepIndicator}>
          <div className={`${styles.step} ${currentStep >= 1 ? styles.active : ''}`}>
            <span>1</span>
            <span>Chọn người ủy quyền</span>
          </div>
          <div className={`${styles.step} ${currentStep >= 2 ? styles.active : ''}`}>
            <span>2</span>
            <span>Chọn hồ sơ</span>
          </div>
          <div className={`${styles.step} ${currentStep >= 3 ? styles.active : ''}`}>
            <span>3</span>
            <span>Chọn người nhận ủy quyền</span>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className={`${styles.form} ${loading ? styles.isSubmitting : ''}`}
        >
          {/* Bước 1: Chọn người ủy quyền */}
          {currentStep === 1 && (
            <div className={styles.stepContent}>
              <h3>Bước 1: Chọn người ủy quyền</h3>
              {/* Chi nhánh */}
              <div className={styles.fieldGroup}>
                <label>Chi nhánh *</label>
                <select
                  value={selectedBranch}
                  onChange={(e) => handleBranchChange(e.target.value)}
                  disabled={loadingEmployees}
                >
                  <option value="">{loadingEmployees ? 'Đang tải...' : 'Chọn chi nhánh'}</option>
                  {branchOptions.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              {/* Phòng ban */}
              <div className={styles.fieldGroup}>
                <label>Phòng ban *</label>
                <select
                  value={selectedDept}
                  onChange={(e) => handleDeptChange(e.target.value)}
                  disabled={loadingEmployees || !selectedBranch}
                >
                  <option value="">
                    {!selectedBranch ? 'Chọn chi nhánh trước' : 'Chọn phòng ban'}
                  </option>
                  {deptOptions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cán bộ (người ủy quyền) */}
              <div className={styles.fieldGroup}>
                <label>Người ủy quyền *</label>
                <select
                  value={selectedDelegator}
                  onChange={(e) => handleDelegatorChange(e.target.value)}
                  disabled={loadingEmployees || !selectedBranch || !selectedDept}
                  className={errors.delegator ? styles.error : ''}
                >
                  <option value="">{!selectedDept ? 'Chọn phòng ban trước' : 'Chọn cán bộ'}</option>
                  {officerOptions.length > 0
                    ? officerOptions.map((o) => (
                        <option key={o.code} value={o.code}>
                          {o.name} ({o.code})
                        </option>
                      ))
                    : selectedBranch &&
                      selectedDept && <option disabled>Không có cán bộ phù hợp</option>}
                </select>
                {errors.delegator && <span className={styles.errorText}>{errors.delegator}</span>}
              </div>
            </div>
          )}

          {/* Bước 2: Chọn hồ sơ */}
          {currentStep === 2 && (
            <div
              className={styles.stepContent}
              onClick={(e) => {
                e.stopPropagation();
                console.log('Step 2 content clicked');
              }}
              style={{ position: 'relative', zIndex: 10, pointerEvents: 'auto' }}
            >
              <h3>Bước 2: Chọn hồ sơ của {getEmployeeName(selectedDelegator)}</h3>

              {/* Chọn theo số lượng */}
              <div className={styles.quantitySelectBar}>
                <div className={styles.quantityLeft}>
                  <label className={styles.quantityLabel} htmlFor="quantityInput">
                    Chọn theo số lượng
                  </label>
                  <input
                    id="quantityInput"
                    type="number"
                    min={1}
                    max={Math.max(1, delegatorCases.length)}
                    value={quantitySelect}
                    onChange={(e) => setQuantitySelect(e.target.value)}
                    placeholder="Ví dụ: 10"
                  />
                </div>
                <div className={styles.quantityRight}>
                  <label className={styles.inlineCheckbox}>
                    <input
                      type="checkbox"
                      checked={appendMode}
                      onChange={(e) => setAppendMode(e.target.checked)}
                    />
                    Cộng dồn vào lựa chọn hiện tại
                  </label>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={handleSelectByQuantity}
                    disabled={delegatorCases.length === 0 || !quantitySelect}
                    title="Chọn N hồ sơ đầu tiên theo danh sách"
                  >
                    Áp dụng
                  </button>
                </div>
              </div>

              {loadingCases ? (
                <div className={styles.loading}>Đang tải danh sách hồ sơ...</div>
              ) : delegatorCases.length > 0 ? (
                <div className={styles.casesList}>
                  <div className={styles.selectAllContainer}>
                    <label
                      className={styles.checkboxLabel}
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('Select all checkbox clicked');
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={
                          selectedCases.length === delegatorCases.length &&
                          delegatorCases.length > 0
                        }
                        onChange={(e) => {
                          e.stopPropagation();
                          console.log('Select all checkbox changed:', e.target.checked);
                          handleSelectAllCases();
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      Chọn tất cả ({delegatorCases.length} hồ sơ)
                    </label>
                  </div>

                  <div className={styles.casesContainer}>
                    {delegatorCases.map((caseItem) => (
                      <div
                        key={caseItem.case_id}
                        className={styles.caseItem}
                        style={{ position: 'relative', zIndex: 10, pointerEvents: 'auto' }}
                      >
                        <label
                          className={styles.checkboxLabel}
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log('Case checkbox clicked:', caseItem.case_id);
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedCases.includes(caseItem.case_id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              console.log(
                                'Case checkbox changed:',
                                caseItem.case_id,
                                e.target.checked,
                              );
                              handleCaseSelection(caseItem.case_id);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className={styles.caseInfo}>
                            <div className={styles.caseId}>{caseItem.customer_code}</div>
                            <div className={styles.caseName}>{caseItem.customer_name}</div>
                            <div className={styles.caseAmount}>
                              {new Intl.NumberFormat('vi-VN').format(caseItem.outstanding_debt)} VNĐ
                            </div>
                            <div
                              className={`${styles.caseType} ${caseItem.case_type === 'external' ? styles.externalCase : styles.internalCase}`}
                            >
                              {caseItem.case_type === 'external' ? 'Ngoại bảng' : 'Nội bảng'}
                            </div>
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>

                  <div className={styles.selectedInfo}>
                    Đã chọn: {selectedCases.length}/{delegatorCases.length} hồ sơ
                  </div>
                </div>
              ) : (
                <div className={styles.noData}>Không có hồ sơ nào để ủy quyền</div>
              )}

              {errors.cases && <span className={styles.errorText}>{errors.cases}</span>}
            </div>
          )}

          {/* Bước 3: Chọn người được ủy quyền và thông tin khác */}
          {currentStep === 3 && (
            <div className={styles.stepContent}>
              <h3>Bước 3: Thông tin ủy quyền</h3>

              <div className={styles.summaryInfo}>
                <p>
                  <strong>Người ủy quyền:</strong> {getEmployeeName(selectedDelegator)}
                </p>
                <p>
                  <strong>Số hồ sơ được ủy quyền:</strong> {selectedCases.length}
                </p>
              </div>

              <div className={styles.fieldGroup}>
                <label>Người được ủy quyền *</label>
                <select
                  value={selectedDelegatee}
                  onChange={(e) => setSelectedDelegatee(e.target.value)}
                  className={errors.delegatee ? styles.error : ''}
                >
                  <option value="">Chọn người được ủy quyền</option>
                  {employees
                    .filter((emp) => emp.employee_code !== selectedDelegator)
                    .map((employee) => (
                      <option key={employee.employee_code} value={employee.employee_code}>
                        {employee.fullname} - {employee.branch_code}
                      </option>
                    ))}
                </select>
                {errors.delegatee && <span className={styles.errorText}>{errors.delegatee}</span>}
              </div>

              <div className={styles.fieldGroup}>
                <label>Ngày hết hạn *</label>
                <input
                  type="datetime-local"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, expiryDate: e.target.value }))}
                  className={errors.expiryDate ? styles.error : ''}
                />
                {errors.expiryDate && <span className={styles.errorText}>{errors.expiryDate}</span>}
              </div>

              <div className={styles.fieldGroup}>
                <label>Ghi chú</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Ghi chú về lý do ủy quyền (tùy chọn)"
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className={styles.buttonGroup}>
            {currentStep > 1 && (
              <button type="button" onClick={handlePreviousStep} className={styles.secondaryButton}>
                Quay lại
              </button>
            )}

            {currentStep < 3 ? (
              <button
                type="button"
                onClick={handleNextStep}
                disabled={
                  (currentStep === 1 && !selectedDelegator) ||
                  (currentStep === 2 && selectedCases.length === 0)
                }
                className={styles.primaryButton}
              >
                Tiếp theo
              </button>
            ) : (
              <button type="submit" disabled={loading} className={styles.primaryButton}>
                {loading ? 'Đang tạo...' : 'Tạo ủy quyền'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateDelegationModal;
