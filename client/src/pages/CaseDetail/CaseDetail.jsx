import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import styles from './CaseDetail.module.css';
import { jwtDecode } from 'jwt-decode';
import { API_ENDPOINTS } from '../../config/api';
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal';
import DocumentUploader from '../../components/DocumentUploader/DocumentUploader';
import PreviewModal from '../../components/PreviewModal/PreviewModal';
import CaseTimeline from '../../components/CaseTimeline/CaseTimeline';
import { CASE_ACTIVITY_TYPES } from '../../constants/activityConstants';
import webSocketService from '../../services/webSocketService';
import {
  getStatusDisplayName,
  getFileIcon,
  canPreview,
  getTypeName,
  organizeFilesByType,
} from '../../utils/caseHelpers';

// Helper function để tạo message cập nhật trạng thái cho timeline
const getStatusUpdateMessage = (oldStatus, newStatus, userFullname) => {
  const oldStatusName = getStatusDisplayName(oldStatus);
  const newStatusName = getStatusDisplayName(newStatus);
  return `${userFullname} đã cập nhật trạng thái từ "${oldStatusName}" thành "${newStatusName}"`;
};

// Component Icon tái sử dụng
const SvgIcon = ({ path, className = '' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d={path} />
  </svg>
);

function CaseDetail() {
  const { caseId } = useParams(); // Lấy ID từ URL
  const [caseData, setCaseData] = useState(null);
  const [caseNote, setCaseNote] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [hasMoreUpdates, setHasMoreUpdates] = useState(false);
  const [currentPage, setCurrentPage] = useState(1); // Add pagination state
  const [updatesPerPage] = useState(5); // Fixed at 5 updates per page
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMoreUpdates, setIsLoadingMoreUpdates] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('timeline');
  const [activeFileTab, setActiveFileTab] = useState('court'); // Tab con cho uploaded files
  const [newNote, setNewNote] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null); // Store current user info
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    type: 'warning',
  });
  const navigate = useNavigate();

  // Function to fetch updates with pagination
  const fetchUpdates = async (page = 1, reset = false) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(
        `${API_ENDPOINTS.CASES.CASE_UPDATES(caseId)}?page=${page}&limit=${updatesPerPage}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.ok) {
        const updatesData = await response.json();
        const updates = updatesData.data || updatesData.updates || [];
        const pagination = updatesData.pagination || {};

        if (reset) {
          setCaseNote(updates);
        } else {
          setCaseNote((prev) => [...prev, ...updates]);
        }

        setHasMoreUpdates(pagination.hasMore || false);
        setCurrentPage(page);
      }
    } catch (error) {
      console.error('Error fetching updates:', error);
    }
  };

  // WebSocket event listeners for real-time updates
  useEffect(() => {
    const handleDelegationExpired = (data) => {
      // Check if this case is affected by the delegation expiry
      if (data.caseId === caseId) {
        toast.info('Quyền ủy quyền cho hồ sơ này đã hết hạn. Đang tải lại dữ liệu...', {
          duration: 4000,
          icon: '⏰',
        });

        // Reload case data to reflect permission changes
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    };

    const handleReloadCaseDetailData = (data) => {
      // Check if this case should be reloaded
      if (data.caseId === caseId) {
        // Refresh case overview data
        const token = localStorage.getItem('token');
        if (token) {
          fetch(API_ENDPOINTS.CASES.CASE_OVERVIEW(caseId), {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((response) => response.json())
            .then((result) => {
              setCaseData(result.data.caseDetail);
              setUploadedFiles(result.data.documents || []);

              // Refresh timeline
              fetchUpdates(1, true);

              toast.success('Đã cập nhật dữ liệu hồ sơ theo thời gian thực!');
            })
            .catch((error) => {
              toast.error('Không thể tải lại dữ liệu hồ sơ');
            });
        }
      }
    };

    // Register WebSocket event listeners
    webSocketService.on('delegation-expired', handleDelegationExpired);
    webSocketService.on('reload-casedetail-data', handleReloadCaseDetailData);

    // Cleanup function to remove listeners
    return () => {
      webSocketService.off('delegation-expired', handleDelegationExpired);
      webSocketService.off('reload-casedetail-data', handleReloadCaseDetailData);
    };
  }, [caseId, fetchUpdates]); // Dependencies: caseId and fetchUpdates

  useEffect(() => {
    const fetchCaseOverview = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      // SECURITY: Validate user access to case detail page
      try {
        const decodedUser = jwtDecode(token);
        const userRole = decodedUser.role;
        const userDept = decodedUser.dept;

        // Check if user has permission to access case details
        const hasAccess =
          userRole === 'administrator' ||
          userRole === 'deputy_director' ||
          userRole === 'director' ||
          (userRole === 'manager' && userDept === 'KHDN') ||
          userDept === 'KTGSNB' ||
          (userRole === 'employee' && ['KHCN', 'KHDN', 'KH', 'PGD'].includes(userDept)) ||
          (userRole === 'deputy_manager' && userDept === 'KHDN') ||
          ((userRole === 'manager' || userRole === 'deputy_manager') &&
            ['KHCN', 'KH', 'PGD'].includes(userDept));

        if (!hasAccess) {
          console.warn('🚫 SECURITY: Unauthorized case detail access attempt', {
            user: decodedUser.sub,
            role: userRole,
            dept: userDept,
            caseId: caseId,
          });

          // Redirect to appropriate page
          if (userDept === 'KH&QLRR') {
            navigate('/dashboard', { replace: true });
          } else {
            navigate('/login', { replace: true });
          }
          return;
        }

        // Store current user info for permission checking
        setCurrentUser(decodedUser);
      } catch (error) {
        console.error('Token validation error in CaseDetail:', error);
        navigate('/login', { replace: true });
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Fetch basic case data first
        const response = await fetch(API_ENDPOINTS.CASES.CASE_OVERVIEW(caseId), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          if (response.status === 403) {
            // User doesn't have access to this specific case
            console.warn('🚫 SECURITY: User does not have access to case:', caseId);
            const token = localStorage.getItem('token');
            const decodedUser = jwtDecode(token);

            // Redirect back to appropriate dashboard
            if (decodedUser.role === 'deputy_director' || decodedUser.role === 'director') {
              navigate('/director-dashboard', { replace: true });
            } else if (decodedUser.role === 'manager' || decodedUser.role === 'deputy_manager') {
              navigate('/manager-dashboard', { replace: true });
            } else {
              navigate('/my-cases', { replace: true });
            }
            return;
          }
          throw new Error('Không thể tải dữ liệu hồ sơ.');
        }

        const { data } = await response.json();

        // Set basic case data and files
        setCaseData(data.caseDetail);
        setSelectedStatus(data.caseDetail.state);
        setUploadedFiles(data.documents || []);

        // Fetch first page of updates separately
        await fetchUpdates(1, true); // true = reset updates array
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCaseOverview();
  }, [caseId, navigate, updatesPerPage]);

  // Function to load more updates on demand
  const loadMoreUpdates = async () => {
    if (isLoadingMoreUpdates || !hasMoreUpdates) return;

    try {
      setIsLoadingMoreUpdates(true);
      await fetchUpdates(currentPage + 1, false); // false = append to existing updates
      toast.success(`Đã tải thêm ${updatesPerPage} cập nhật`);
    } catch (err) {
      console.error('Error loading more updates:', err);
      toast.error('Không thể tải thêm lịch sử cập nhật');
    } finally {
      setIsLoadingMoreUpdates(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) {
      toast.error('Vui lòng nhập nội dung ghi chú.');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Không tìm thấy token. Vui lòng đăng nhập lại.');
      return;
    }

    setIsSubmittingNote(true);

    try {
      // Use new Case Notes endpoint (legacy updates endpoint still supported server-side)
      const response = await fetch(API_ENDPOINTS.CASES.CASE_NOTES(caseId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          note_content: newNote,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Không thể gửi ghi chú.');
      }

      setNewNote('');
      toast.success('Đã thêm ghi chú mới!');

      // Refresh timeline from the first page to show new note
      await fetchUpdates(1, true);
    } catch (error) {
      toast.error(`Lỗi: ${error.message}`);
    } finally {
      setIsSubmittingNote(false); // Bật lại nút sau khi xử lý xong
    }
  };

  const handleUpdateStatus = async () => {
    if (selectedStatus === caseData.state) {
      toast.error('Trạng thái mới giống với trạng thái hiện tại.');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Không tìm thấy token. Vui lòng đăng nhập lại.');
      return;
    }

    // Lấy thông tin user từ token để ghi log
    const userInfo = jwtDecode(token);
    const oldStatus = caseData.state;

    setIsUpdatingStatus(true);

    try {
      const response = await fetch(API_ENDPOINTS.CASES.CASE_STATUS(caseId), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: selectedStatus,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Không thể cập nhật trạng thái.');
      }

      // Update local case data
      setCaseData((prev) => ({ ...prev, state: selectedStatus }));

      // Optimistically inject status change into timeline via custom event
      try {
        const event = new CustomEvent('case-status-changed', {
          detail: {
            caseId,
            activity: {
              id: result?.data?.activity_id || `temp-${Date.now()}`,
              type: 'activity',
              caseId,
              content: `Thay đổi trạng thái từ "${getStatusDisplayName(oldStatus)}" thành "${getStatusDisplayName(selectedStatus)}"`,
              activityType: CASE_ACTIVITY_TYPES.STATUS_CHANGE,
              oldValue: getStatusDisplayName(oldStatus),
              newValue: getStatusDisplayName(selectedStatus),
              performedBy: { fullname: userInfo.fullname },
              performedDate: new Date().toISOString(),
              updatedDate: null,
            },
          },
        });
        window.dispatchEvent(event);
      } catch {}

      // Also refresh dedicated updates list (notes) to keep sync
      await fetchUpdates(1, true);

      toast.success(`Đã cập nhật trạng thái thành "${getStatusDisplayName(selectedStatus)}"!`);
    } catch (error) {
      toast.error(`Lỗi: ${error.message}`);
      // Reset selected status on error
      setSelectedStatus(caseData.state);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handlePreviewFile = async (file) => {
    // Nếu là file PDF, mở trong tab mới
    if (file.mime_type && file.mime_type.includes('pdf')) {
      try {
        // Hiển thị loading toast
        const loadingToast = toast.loading('Đang tải file PDF...');

        // Tải file và tạo blob URL cho tab mới
        const token = localStorage.getItem('token');
        const response = await fetch(API_ENDPOINTS.CASES.DOCUMENT_PREVIEW(file.document_id), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Không thể tải file PDF');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);

        // Dismiss loading toast
        toast.dismiss(loadingToast);

        // Mở tab mới với blob URL
        const newWindow = window.open('', '_blank');
        if (newWindow) {
          newWindow.document.write(`
                        <html>
                            <head>
                                <title>${file.original_filename}</title>
                                <meta charset="UTF-8">
                                <style>
                                    body { 
                                        margin: 0; 
                                        padding: 0; 
                                        font-family: Arial, sans-serif; 
                                    }
                                    .header {
                                        background: #f8f9fa;
                                        padding: 10px 20px;
                                        border-bottom: 1px solid #dee2e6;
                                        display: flex;
                                        justify-content: space-between;
                                        align-items: center;
                                    }
                                    .filename {
                                        font-weight: bold;
                                        font-size: 14px;
                                    }
                                    .download-btn {
                                        background: #007bff;
                                        color: white;
                                        border: none;
                                        padding: 6px 12px;
                                        border-radius: 4px;
                                        cursor: pointer;
                                        font-size: 12px;
                                    }
                                    .download-btn:hover {
                                        background: #0056b3;
                                    }
                                    iframe { 
                                        width: 100%; 
                                        height: calc(100vh - 60px); 
                                        border: none; 
                                    }
                                </style>
                            </head>
                            <body>
                                <div class="header">
                                    <span class="filename">${file.original_filename}</span>
                                    <button class="download-btn" onclick="downloadFile()">Tải xuống</button>
                                </div>
                                <iframe src="${url}#toolbar=1&navpanes=1&scrollbar=1&page=1&view=FitH" title="${file.original_filename}"></iframe>
                                <script>
                                    function downloadFile() {
                                        const a = document.createElement('a');
                                        a.href = '${url}';
                                        a.download = '${file.original_filename}';
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                    }
                                    
                                    // Cleanup blob URL when window is closed
                                    window.addEventListener('beforeunload', function() {
                                        URL.revokeObjectURL('${url}');
                                    });
                                </script>
                            </body>
                        </html>
                    `);
          newWindow.document.close();
          toast.success('Đã mở file PDF trong tab mới');
        } else {
          // Cleanup nếu không thể mở tab mới
          window.URL.revokeObjectURL(url);
          toast.error('Trình duyệt chặn việc mở tab mới. Vui lòng cho phép popup.');
        }
      } catch (error) {
        toast.error('Không thể mở file PDF');
        console.error('Error opening PDF file:', error);
      }
    } else {
      // Các file khác (ảnh, video, v.v.) hiển thị trong modal
      setPreviewFile(file);
      setIsPreviewOpen(true);
    }
  };

  const closePreview = () => {
    setIsPreviewOpen(false);
    setPreviewFile(null);
  };

  const handleDownloadFile = (fileId, fileName) => {
    const token = localStorage.getItem('token');
    const downloadUrl = API_ENDPOINTS.CASES.DOCUMENT_DOWNLOAD(fileId);

    fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Không thể tải xuống file');
        }
        return response.blob();
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // Đảm bảo tên file được decode đúng
        a.download = decodeURIComponent(fileName || 'download');
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Tải xuống thành công');
      })
      .catch((error) => {
        toast.error(`Lỗi tải xuống: ${error.message}`);
      });
  };

  const refreshUploadedFiles = async () => {
    const token = localStorage.getItem('token');
    try {
      const filesResponse = await fetch(API_ENDPOINTS.CASES.DOCUMENTS(caseId), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (filesResponse.ok) {
        const filesData = await filesResponse.json();
        setUploadedFiles(filesData.data || []);
      }
    } catch (error) {
      console.error('Error refreshing uploaded files:', error);
    }
  };

  const refreshTimeline = async () => {
    try {
      // Add a small delay to ensure backend has processed the upload
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Refresh timeline from the first page
      await fetchUpdates(1, true);

      console.log('Timeline refreshed successfully');
    } catch (error) {
      console.error('Error refreshing timeline:', error);
    }
  };

  // Kiểm tra quyền xóa file
  const canDeleteFile = useCallback(() => {
    if (!currentUser || !caseData) return false;

    // Administrators và directors luôn có quyền xóa
    if (currentUser.role === 'administrator' || currentUser.role === 'director') {
      return true;
    }

    // Chỉ chủ sở hữu trực tiếp (assigned employee) mới có quyền xóa file
    return caseData.assigned_employee_code === currentUser.sub;
  }, [currentUser, caseData]);

  const handleDeleteFile = async (fileId) => {
    const fileToDelete = uploadedFiles.find((file) => file.document_id === fileId);

    setConfirmModal({
      isOpen: true,
      title: 'Xóa tài liệu',
      message: `Bạn có chắc chắn muốn xóa file "${fileToDelete?.original_filename || 'này'}"? Hành động này không thể hoàn tác.`,
      type: 'danger',
      onConfirm: async () => {
        const token = localStorage.getItem('token');

        try {
          const response = await fetch(API_ENDPOINTS.CASES.DELETE_DOCUMENT(fileId), {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            setUploadedFiles((prev) => prev.filter((file) => file.document_id !== fileId));

            // Emit global event to refresh timeline after file deletion
            window.dispatchEvent(
              new CustomEvent('case-file-deleted', {
                detail: {
                  caseId,
                  operation: 'delete',
                  fileName: fileToDelete?.original_filename,
                  fileId,
                },
              }),
            );

            // Refresh timeline to show delete log
            refreshTimeline();
            toast.success('Đã xóa file thành công');
          } else {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Không thể xóa file');
          }
        } catch (error) {
          toast.error(`Lỗi khi xóa file: ${error.message}`);
        }
      },
    });
  };

  if (isLoading)
    return (
      <div className={styles.caseDetailContainer}>
        <div className={styles.loadingSpinner}>
          <div>Đang tải dữ liệu hồ sơ...</div>
        </div>
      </div>
    );

  if (!caseData)
    return (
      <div className={styles.caseDetailContainer}>
        <div className={styles.loadingSpinner}>
          <div>Không tìm thấy hồ sơ.</div>
        </div>
      </div>
    );

  // Dynamic breadcrumb based on user role
  const getBreadcrumbLink = () => {
    // Fallback
    return { path: '/my-cases', label: 'Hồ sơ của tôi' };
  };

  const breadcrumbLink = getBreadcrumbLink();

  return (
    <div className={styles.caseDetailContainer}>
      <div className={styles.pageHeader}>
        <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
          <ol>
            <li>
              <Link to={breadcrumbLink.path}>{breadcrumbLink.label}</Link>
            </li>
            <li>
              <span aria-current="page">{caseData.case_id}</span>
            </li>
          </ol>
        </nav>
        <h1>Hồ sơ: {caseData.customer_name}</h1>
      </div>

      <div className={styles.detailsGrid}>
        {/* Cột thông tin bên trái */}
        <div className={styles.infoColumn}>
          <div className={styles.card}>
            <h3>Thông tin Khách hàng</h3>
            <dl className={styles.infoGrid}>
              <dt>Mã KH:</dt>
              <dd>{caseData.customer_code}</dd>
              <dt>Tên KH:</dt>
              <dd>{caseData.customer_name}</dd>
            </dl>
          </div>
          <div className={styles.card}>
            <h3>Thông tin Khoản nợ</h3>
            <dl className={styles.infoGrid}>
              <dt>Dư nợ:</dt>
              <dd>
                <strong>{parseFloat(caseData.outstanding_debt).toLocaleString('vi-VN')} VND</strong>
              </dd>
              <dt>Trạng thái:</dt>
              <dd>
                <strong style={{ color: 'var(--primary-color)' }}>
                  {getStatusDisplayName(caseData.state)}
                </strong>
              </dd>
            </dl>
          </div>
          <div className={styles.card}>
            <h3>Hành động</h3>
            <div className={styles.formGroup}>
              <label htmlFor="case-status">Cập nhật Trạng thái</label>
              <select
                id="case-status"
                className={styles.formControl}
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="beingFollowedUp">Đang đôn đốc</option>
                <option value="beingSued">Đang khởi kiện</option>
                <option value="awaitingJudgmentEffect">Chờ hiệu lực án</option>
                <option value="beingExecuted">Đang thi hành án</option>
                <option value="proactivelySettled">Chủ động XLTS</option>
                <option value="debtSold">Bán nợ</option>
                <option value="amcHired">Thuê AMC XLN</option>
              </select>
            </div>
            <button
              className={styles.button}
              onClick={handleUpdateStatus}
              disabled={isUpdatingStatus || selectedStatus === caseData.state}
            >
              {isUpdatingStatus ? 'Đang cập nhật...' : 'Lưu thay đổi'}
            </button>
          </div>
        </div>

        {/* Cột tab bên phải */}
        <div className={`${styles.card} ${styles.tabsColumn}`}>
          <nav className={styles.tabNav}>
            <button
              onClick={() => setActiveTab('timeline')}
              className={` ${styles.tabButton} ${activeTab === 'timeline' ? styles.active : ''}`}
            >
              Nhật ký Xử lý
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={` ${styles.tabButton} ${activeTab === 'documents' ? styles.active : ''}`}
            >
              Upload Tài liệu & Hồ sơ
            </button>
            <button
              onClick={() => setActiveTab('uploaded-files')}
              className={` ${styles.tabButton} ${activeTab === 'uploaded-files' ? styles.active : ''}`}
            >
              Tài liệu đã tải lên
            </button>
          </nav>

          {activeTab === 'timeline' && (
            <div className={styles.tabContent}>
              <CaseTimeline caseId={caseId} />
            </div>
          )}

          {activeTab === 'documents' && (
            <div className={styles.tabContent}>
              <DocumentUploader
                caseId={caseId}
                onUploadSuccess={refreshUploadedFiles}
                onTimelineRefresh={refreshTimeline}
              />
            </div>
          )}

          {activeTab === 'uploaded-files' && (
            <div className={styles.tabContent}>
              {/* <h4>Tài liệu đã tải lên</h4> */}

              {/* Sub-tabs cho từng loại file */}
              <nav className={styles.subTabNav}>
                <button
                  onClick={() => setActiveFileTab('court')}
                  className={`${styles.subTabButton} ${activeFileTab === 'court' ? styles.active : ''}`}
                >
                  Tòa án ({organizeFilesByType(uploadedFiles)['court'].length})
                </button>
                <button
                  onClick={() => setActiveFileTab('enforcement')}
                  className={`${styles.subTabButton} ${activeFileTab === 'enforcement' ? styles.active : ''}`}
                >
                  Thi hành án ({organizeFilesByType(uploadedFiles)['enforcement'].length})
                </button>
                <button
                  onClick={() => setActiveFileTab('notification')}
                  className={`${styles.subTabButton} ${activeFileTab === 'notification' ? styles.active : ''}`}
                >
                  Bán nợ ({organizeFilesByType(uploadedFiles)['notification'].length})
                </button>
                <button
                  onClick={() => setActiveFileTab('proactive')}
                  className={`${styles.subTabButton} ${activeFileTab === 'proactive' ? styles.active : ''}`}
                >
                  Chủ động xử lý tài sản ({organizeFilesByType(uploadedFiles)['proactive'].length})
                </button>
                <button
                  onClick={() => setActiveFileTab('collateral')}
                  className={`${styles.subTabButton} ${activeFileTab === 'collateral' ? styles.active : ''}`}
                >
                  Tài sản đảm bảo ({organizeFilesByType(uploadedFiles)['collateral'].length})
                </button>
                <button
                  onClick={() => setActiveFileTab('processed_collateral')}
                  className={`${styles.subTabButton} ${activeFileTab === 'processed_collateral' ? styles.active : ''}`}
                >
                  Tài sản đã xử lý (
                  {organizeFilesByType(uploadedFiles)['processed_collateral'].length})
                </button>
                <button
                  onClick={() => setActiveFileTab('other')}
                  className={`${styles.subTabButton} ${activeFileTab === 'other' ? styles.active : ''}`}
                >
                  Khác ({organizeFilesByType(uploadedFiles)['other'].length})
                </button>
              </nav>

              {/* Hiển thị files của tab được chọn */}
              <div className={styles.activeFileContent}>
                {(() => {
                  const organizedFiles = organizeFilesByType(uploadedFiles);
                  const currentFiles = organizedFiles[activeFileTab];

                  return currentFiles.length > 0 ? (
                    <div className={styles.filesList}>
                      {currentFiles.map((file) => (
                        <div
                          key={file.document_id}
                          className={styles.fileItem}
                          data-mime={file.mime_type}
                          data-filename={file.original_filename}
                        >
                          <div className={styles.fileIcon}>
                            {getFileIcon(file.mime_type, file.original_filename)}
                          </div>
                          <div className={styles.fileDetails}>
                            <div className={styles.fileName}>{file.original_filename}</div>
                            <div className={styles.fileInfo}>
                              Tải lên: {new Date(file.upload_date).toLocaleDateString('vi-VN')} -{' '}
                              {file.file_size ? Math.round(file.file_size / 1024) + ' KB' : 'N/A'}
                            </div>
                          </div>
                          <div className={styles.fileActions}>
                            {canPreview(file.mime_type) && (
                              <button
                                className={styles.previewBtn}
                                onClick={() => handlePreviewFile(file)}
                              >
                                <svg
                                  width="20"
                                  height="20"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                  style={{ marginRight: '6px', verticalAlign: 'middle' }}
                                >
                                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                                </svg>
                                Xem trước
                              </button>
                            )}
                            <button
                              className={styles.downloadBtn}
                              onClick={() =>
                                handleDownloadFile(file.document_id, file.original_filename)
                              }
                            >
                              <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                style={{ marginRight: '6px', verticalAlign: 'middle' }}
                              >
                                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                              </svg>
                              Tải xuống
                            </button>
                            {canDeleteFile() && (
                              <button
                                className={styles.deleteBtn}
                                onClick={() => handleDeleteFile(file.document_id)}
                              >
                                <svg
                                  width="20"
                                  height="20"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                  style={{ marginRight: '6px', verticalAlign: 'middle' }}
                                >
                                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                                </svg>
                                Xóa
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.noFiles}>
                      Chưa có tài liệu {getTypeName(activeFileTab).toLowerCase()} nào được tải lên
                    </p>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal cho các file không phải PDF */}
      <PreviewModal isOpen={isPreviewOpen} onClose={closePreview} file={previewFile} />

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

export default CaseDetail;
