import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import styles from './Import.module.css';
import { API_ENDPOINTS } from '../../config/api';

// Component con cho các icon
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

// Component Modal để hiển thị lỗi chi tiết
const ErrorModal = ({ isOpen, onClose, errorData, importType }) => {
  if (!isOpen || !errorData) return null;

  const getDetailedErrorInfo = () => {
    const { fileName, errorMessage } = errorData;
    
    // Phân tích chi tiết lỗi
    if (errorMessage.includes('Sai mẫu file Import nội bảng')) {
      return {
        title: '❌ Sai Mẫu File Import Nội Bảng',
        icon: '📋',
        severity: 'critical',
        details: [
          { label: 'File bị lỗi', value: fileName },
          { label: 'Vấn đề', value: 'File Excel không đúng mẫu Import nội bảng' },
          { label: 'Nguyên nhân', value: errorMessage.split('.')[1]?.trim() || 'Thiếu các cột bắt buộc' },
        ],
        requiredColumns: ['AQCCDFIN', 'brcd', 'dsbsbal', 'ofcno', 'custnm'],
        solution: 'Vui lòng sử dụng đúng mẫu Excel cho Import nội bảng với đầy đủ các cột bắt buộc.',
        hint: errorMessage.includes('Có vẻ bạn đang dùng mẫu Ngoại bảng') 
          ? '💡 Có vẻ bạn đang sử dụng mẫu Ngoại bảng. Hãy chuyển sang tab "Ngoại bảng" để import file này.'
          : null
      };
    } else if (errorMessage.includes('Sai mẫu file Import ngoại bảng')) {
      return {
        title: '❌ Sai Mẫu File Import Ngoại Bảng',
        icon: '📋',
        severity: 'critical',
        details: [
          { label: 'File bị lỗi', value: fileName },
          { label: 'Vấn đề', value: 'File Excel không đúng mẫu Import ngoại bảng' },
          { label: 'Nguyên nhân', value: errorMessage.split('.')[1]?.trim() || 'Thiếu các cột bắt buộc' },
        ],
        requiredColumns: ['makh', 'Ngoaibang', 'cbtd', 'TenKhachHang'],
        solution: 'Vui lòng sử dụng đúng mẫu Excel cho Import ngoại bảng với đầy đủ các cột bắt buộc.',
        hint: errorMessage.includes('Có vẻ bạn đang dùng mẫu Nội bảng')
          ? '💡 Có vẻ bạn đang sử dụng mẫu Nội bảng. Hãy chuyển sang tab "Nội bảng" để import file này.'
          : null
      };
    } else if (errorMessage.includes('File Excel trống') || errorMessage.includes('File rỗng')) {
      return {
        title: '⚠️ File Excel Trống',
        icon: '📄',
        severity: 'warning',
        details: [
          { label: 'File bị lỗi', value: fileName },
          { label: 'Vấn đề', value: 'File không chứa dữ liệu' },
        ],
        solution: 'Vui lòng kiểm tra lại file Excel và đảm bảo có dữ liệu để import.'
      };
    } else if (errorMessage.includes('File không phải là file Excel hợp lệ')) {
      return {
        title: '⛔ File Không Hợp Lệ',
        icon: '⚠️',
        severity: 'error',
        details: [
          { label: 'File bị lỗi', value: fileName },
          { label: 'Vấn đề', value: 'File không phải Excel hoặc bị hỏng' },
        ],
        solution: 'Chỉ chấp nhận file Excel (.xls, .xlsx). Vui lòng kiểm tra định dạng file.'
      };
    } else {
      return {
        title: '❌ Lỗi Import',
        icon: '⚠️',
        severity: 'error',
        details: [
          { label: 'File bị lỗi', value: fileName },
          { label: 'Lỗi', value: errorMessage },
        ],
        solution: 'Vui lòng kiểm tra lại file và thử lại.'
      };
    }
  };

  const errorInfo = getDetailedErrorInfo();

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={`${styles.modalHeader} ${styles[errorInfo.severity]}`}>
          <span className={styles.modalIcon}>{errorInfo.icon}</span>
          <h2>{errorInfo.title}</h2>
          <button className={styles.modalClose} onClick={onClose}>×</button>
        </div>
        
        <div className={styles.modalBody}>
          <div className={styles.errorDetailsSection}>
            <h3>Chi tiết lỗi:</h3>
            <table className={styles.errorDetailsTable}>
              <tbody>
                {errorInfo.details.map((detail, index) => (
                  <tr key={index}>
                    <td className={styles.detailLabel}>{detail.label}:</td>
                    <td className={styles.detailValue}>{detail.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {errorInfo.requiredColumns && (
            <div className={styles.requiredColumnsSection}>
              <h3>Các cột bắt buộc trong file Excel:</h3>
              <div className={styles.columnsList}>
                {errorInfo.requiredColumns.map((col, index) => (
                  <span key={index} className={styles.columnTag}>
                    {col}
                  </span>
                ))}
              </div>
            </div>
          )}

          {errorInfo.hint && (
            <div className={styles.hintBox}>
              {errorInfo.hint}
            </div>
          )}

          <div className={styles.solutionSection}>
            <h3>Giải pháp:</h3>
            <p>{errorInfo.solution}</p>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.btnPrimary} onClick={onClose}>
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
};

// Component con để hiển thị kết quả import chi tiết
const ImportResult = ({ result }) => {
  if (!result) return null;
  return (
    <div className={styles.resultSummary}>
      <div className={styles.resultItem}>
        <span>Tổng số dòng:</span>
        <strong>{result.totalRowsInFile}</strong>
      </div>
      <div className={styles.resultItem}>
        <span>Đã xử lý:</span>
        <strong>{result.processedCustomers}</strong>
      </div>
      <div className={styles.resultItem}>
        <span className={styles.created}>Tạo mới:</span>
        <strong className={styles.created}>{result.created}</strong>
      </div>
      <div className={styles.resultItem}>
        <span className={styles.updated}>Cập nhật:</span>
        <strong className={styles.updated}>{result.updated}</strong>
      </div>
    </div>
  );
};

// Component để hiển thị chi tiết lỗi
const ErrorDetails = ({ error, importType, fileName, onShowModal }) => {
  if (!error) return null;

  const classifyError = (errorMessage) => {
    if (errorMessage.includes('Sai mẫu file Import')) {
      return { type: 'template', label: 'Sai mẫu file' };
    } else if (errorMessage.includes('Loại file không hợp lệ') || 
               errorMessage.includes('Phần mở rộng file không hợp lệ') ||
               errorMessage.includes('Định dạng file không được hỗ trợ')) {
      return { type: 'validation', label: 'File không hợp lệ' };
    } else if (errorMessage.includes('File rỗng') || errorMessage.includes('File Excel trống')) {
      return { type: 'validation', label: 'File trống' };
    } else if (errorMessage.includes('Không thể đọc file Excel') || 
               errorMessage.includes('File không phải là file Excel hợp lệ')) {
      return { type: 'corruption', label: 'File bị hỏng' };
    } else {
      return { type: 'system', label: 'Lỗi hệ thống' };
    }
  };

  const getErrorHint = (errorMessage, importType) => {
    if (errorMessage.includes('Sai mẫu file Import nội bảng')) {
      return 'Đảm bảo file Excel có các cột: AQCCDFIN, brcd, dsbsbal, ofcno, custnm. Nếu bạn muốn import ngoại bảng, hãy chuyển sang tab "Ngoại bảng".';
    } else if (errorMessage.includes('Sai mẫu file Import ngoại bảng')) {
      return 'Đảm bảo file Excel có các cột: makh, Ngoaibang, cbtd, TenKhachHang. Nếu bạn muốn import nội bảng, hãy chuyển sang tab "Nội bảng".';
    } else if (errorMessage.includes('Loại file không hợp lệ') || 
               errorMessage.includes('Định dạng file không được hỗ trợ')) {
      return 'Chỉ chấp nhận file Excel với định dạng .xls hoặc .xlsx. Vui lòng kiểm tra lại file của bạn.';
    } else if (errorMessage.includes('File rỗng') || errorMessage.includes('File Excel trống')) {
      return 'File Excel không chứa dữ liệu hoặc bị hỏng. Vui lòng kiểm tra lại file gốc.';
    } else if (errorMessage.includes('Không thể đọc file Excel') || 
               errorMessage.includes('File không phải là file Excel hợp lệ')) {
      return 'File Excel có thể bị hỏng hoặc có định dạng không đúng. Vui lòng kiểm tra lại file gốc và thử lại.';
    } else if (errorMessage.includes('File Excel không chứa sheet nào')) {
      return 'File Excel không có sheet nào hoặc bị lỗi. Vui lòng kiểm tra lại file.';
    } else if (errorMessage.includes('Sheet đầu tiên trong file Excel bị lỗi')) {
      return 'Sheet đầu tiên trong file Excel bị lỗi hoặc rỗng. Vui lòng kiểm tra lại file.';
    } else if (errorMessage.includes('File Excel không chứa dữ liệu')) {
      return 'File Excel không chứa dữ liệu hoặc định dạng không đúng. Vui lòng kiểm tra lại file.';
    }
    return null;
  };

  const errorInfo = classifyError(error);
  const hint = getErrorHint(error, importType);
  const isTemplateError = error.includes('Sai mẫu file Import');

  return (
    <div className={styles.errorDetails}>
      <div className={`${styles.errorType} ${styles[errorInfo.type]}`}>
        {errorInfo.label}
      </div>
      <p className={styles.errorMessage}>{error}</p>
      {hint && (
        <div className={styles.errorHint}>
          💡 <strong>Gợi ý:</strong> {hint}
        </div>
      )}
      {isTemplateError && onShowModal && (
        <button 
          className={styles.btnShowDetails}
          onClick={() => onShowModal({ fileName, errorMessage: error })}
        >
          Xem chi tiết lỗi →
        </button>
      )}
    </div>
  );
};

// Component con cho khu vực upload, có thể tái sử dụng
const UploadArea = ({ importType, onShowErrorModal }) => {
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  const validateExcelFile = (file) => {
    // Check file extension
    const allowedExtensions = ['.xls', '.xlsx'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

    if (!allowedExtensions.includes(fileExtension)) {
      return {
        isValid: false,
        error: `File "${file.name}" không phải là file Excel hợp lệ. Chỉ chấp nhận file .xls và .xlsx`,
      };
    }

    // Check MIME type
    const allowedMimeTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (!allowedMimeTypes.includes(file.type)) {
      return {
        isValid: false,
        error: `File "${file.name}" có định dạng không hợp lệ. Định dạng hiện tại: ${file.type || 'không xác định'}`,
      };
    }

    // Check file size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return {
        isValid: false,
        error: `File "${file.name}" quá lớn. Kích thước tối đa cho phép: 50MB`,
      };
    }

    return { isValid: true };
  };

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    const allErrorMessages = new Set(); // Prevent duplicate error messages

    // Handle rejected files (from dropzone validation)
    if (rejectedFiles.length > 0) {
      rejectedFiles.forEach(({ file, errors }) => {
        errors.forEach((error) => {
          let errorMessage = '';

          if (error.code === 'file-too-large') {
            errorMessage = `File "${file.name}" quá lớn (tối đa 50MB)`;
          } else if (error.code === 'file-invalid-type') {
            errorMessage = `File "${file.name}" không phải là file Excel hợp lệ`;
          } else if (error.code === 'invalid-excel-file') {
            errorMessage = error.message; // Custom validation message
          } else {
            errorMessage = `File "${file.name}": ${error.message}`;
          }

          allErrorMessages.add(errorMessage);
        });
      });
    }

    // Process accepted files (only add them, no additional validation since dropzone already validated)
    const validFiles = [];

    if (acceptedFiles.length > 0) {
      const newFiles = acceptedFiles.map((file) =>
        Object.assign(file, {
          id: uuidv4(),
          status: 'waiting',
          message: 'Sẵn sàng',
          result: null,
        }),
      );
      validFiles.push(...newFiles);
      setFiles((prevFiles) => [...prevFiles, ...newFiles]);
    }

    // Show error messages (deduplicated)
    allErrorMessages.forEach((message) => {
      toast.error(message);
    });

    // Show success message if any valid files were added
    if (validFiles.length > 0) {
      toast.success(`${validFiles.length} file Excel hợp lệ đã được thêm vào danh sách!`);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    maxSize: 50 * 1024 * 1024, // 50MB limit
    multiple: true,
    validator: (file) => {
      const validation = validateExcelFile(file);
      if (!validation.isValid) {
        return {
          code: 'invalid-excel-file',
          message: validation.error,
        };
      }
      return null;
    },
  });

  const handleUpload = async () => {
    setIsUploading(true);
    const token = localStorage.getItem('token');

    if (!token) {
      toast.error('Lỗi: Không tìm thấy token xác thực.');
      setIsUploading(false);
      return;
    }

    const apiEndpoint =
      importType === 'internal'
        ? API_ENDPOINTS.CASES.IMPORT_INTERNAL
        : API_ENDPOINTS.CASES.IMPORT_EXTERNAL;

    toast.loading(
      `Đang import file cho ${importType === 'internal' ? 'Nội bảng' : 'Ngoại bảng'}...`,
      { id: 'uploading' },
    );

    const filesToUpload = files.filter((f) => f.status === 'waiting' || f.status === 'error');
    setFiles((prev) =>
      prev.map((f) =>
        filesToUpload.some((fu) => fu.id === f.id)
          ? { ...f, status: 'uploading', message: 'Đang tải lên...' }
          : f,
      ),
    );

  const uploadPromises = filesToUpload.map((file) => {
      const formData = new FormData();
      formData.append('casesFile', file);

      return fetch(apiEndpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
        .then(async (res) => {
          const data = await res.json();
          console.log(data);
          
          if (!res.ok) {
            // Enhanced error handling for file type errors
            let errorMessage = data.error.message || `Lỗi: ${res.status}`;

            // Cải thiện thông báo lỗi để rõ ràng hơn
            if (data.message && data.message.includes('Loại file không hợp lệ') || 
                data.message && data.message.includes('Định dạng file không được hỗ trợ')) {
              errorMessage = 'Định dạng file không được hỗ trợ. Vui lòng tải lên file Excel (.xls hoặc .xlsx)';
            } else if (data.message && data.message.includes('Phần mở rộng file không hợp lệ')) {
              errorMessage = 'Phần mở rộng file không hợp lệ. Chỉ chấp nhận file .xls và .xlsx';
            } else if (data.message && data.message.includes('File rỗng') || 
                       data.message && data.message.includes('File Excel trống')) {
              errorMessage = 'File Excel trống hoặc bị hỏng. Vui lòng kiểm tra lại file gốc';
            } else if (data.message && data.message.includes('Không thể đọc file Excel') ||
                       data.message && data.message.includes('File không phải là file Excel hợp lệ')) {
              errorMessage = 'File Excel có thể bị hỏng hoặc có định dạng không đúng. Vui lòng kiểm tra lại file gốc';
            } else if (data.message && data.message.includes('File Excel không chứa sheet nào')) {
              errorMessage = 'File Excel không chứa sheet nào. Vui lòng kiểm tra lại file';
            } else if (data.message && data.message.includes('Sheet đầu tiên trong file Excel bị lỗi')) {
              errorMessage = 'Sheet đầu tiên trong file Excel bị lỗi hoặc rỗng. Vui lòng kiểm tra lại file';
            } else if (data.message && data.message.includes('File Excel không chứa dữ liệu')) {
              errorMessage = 'File Excel không chứa dữ liệu hoặc định dạng không đúng. Vui lòng kiểm tra lại file';
            } else if (
              data.message &&
              (data.message.includes('Sai mẫu file Import nội bảng') ||
                data.message.includes('Sai mẫu file Import ngoại bảng'))
            ) {
              // Pass-through backend header validation message as-is for user clarity
              errorMessage = data.message;
            }

            throw new Error(errorMessage);
          }
          return data;
        })
        .then((data) =>
          setFiles((prev) =>
            prev.map((f) =>
              f.id === file.id
                ? { ...f, status: 'success', message: data.message, result: data.data }
                : f,
            ),
          ),
        )
        .catch((err) => {
          console.error('Upload error for file:', file.name, err);
          const errorMessage = err.message || 'Lỗi không xác định khi tải file';
          
          // Classify error severity for styling
          const isCriticalError = errorMessage.includes('Sai mẫu file Import') || 
                                  errorMessage.includes('Loại file không hợp lệ') ||
                                  errorMessage.includes('Định dạng file không được hỗ trợ');
          const isCorruptionError = errorMessage.includes('Không thể đọc file Excel') ||
                                   errorMessage.includes('File không phải là file Excel hợp lệ') ||
                                   errorMessage.includes('File Excel có thể bị hỏng');
          
          let status = 'error';
          if (isCriticalError) {
            status = 'critical';
          } else if (isCorruptionError) {
            status = 'corruption';
          }
          
          setFiles((prev) =>
            prev.map((f) =>
              f.id === file.id ? { ...f, status, message: errorMessage } : f,
            ),
          );
        });
    });

    await Promise.all(uploadPromises);
    setIsUploading(false);
    toast.dismiss('uploading');

    // Summarize results for the current batch
    const uploadedIds = new Set(filesToUpload.map((f) => f.id));
    const successCount = (files || []).filter((f) => uploadedIds.has(f.id) && f.status === 'success').length;
    const errorCount = (files || []).filter((f) => uploadedIds.has(f.id) && (f.status === 'error' || f.status === 'critical' || f.status === 'corruption')).length;

    // Detect wrong-template errors to give a clearer hint
    const wrongTemplate = (files || []).some(
      (f) => uploadedIds.has(f.id) && typeof f.message === 'string' && f.message.includes('Sai mẫu file')
    );

    // Count different error types for detailed feedback
    const templateErrors = (files || []).filter(
      (f) => uploadedIds.has(f.id) && typeof f.message === 'string' && f.message.includes('Sai mẫu file')
    ).length;
    
    const validationErrors = (files || []).filter(
      (f) => uploadedIds.has(f.id) && typeof f.message === 'string' && 
      (f.message.includes('Loại file không hợp lệ') || f.message.includes('File rỗng') || f.message.includes('File Excel trống'))
    ).length;

    const corruptionErrors = (files || []).filter(
      (f) => uploadedIds.has(f.id) && typeof f.message === 'string' && 
      (f.message.includes('Không thể đọc file Excel') || f.message.includes('File không phải là file Excel hợp lệ') || f.message.includes('File Excel có thể bị hỏng'))
    ).length;

    if (errorCount > 0 && successCount === 0) {
      toast.error(`Tất cả ${errorCount} file đều thất bại. Kiểm tra thông báo chi tiết bên dưới từng file.`);
      if (wrongTemplate) {
        toast.error(
          `Có vẻ bạn đã chọn sai mẫu import cho tab ${importType === 'internal' ? 'Nội bảng' : 'Ngoại bảng'}. ` +
            `Vui lòng chọn đúng tab và thử lại.`
        );
      }
    } else if (errorCount > 0 && successCount > 0) {
      const errorBreakdown = [];
      if (templateErrors > 0) errorBreakdown.push(`${templateErrors} sai mẫu`);
      if (validationErrors > 0) errorBreakdown.push(`${validationErrors} file không hợp lệ`);
      if (corruptionErrors > 0) errorBreakdown.push(`${corruptionErrors} file bị hỏng`);
      const otherErrors = errorCount - templateErrors - validationErrors - corruptionErrors;
      if (otherErrors > 0) errorBreakdown.push(`${otherErrors} lỗi khác`);
      
      toast.error(
        `Import hoàn tất: ${successCount} thành công, ${errorCount} thất bại ` +
        `(${errorBreakdown.join(', ')}). Xem chi tiết lỗi ở từng file.`
      );
      
      if (wrongTemplate) {
        toast.error(
          `Một số file có sai mẫu import cho tab ${importType === 'internal' ? 'Nội bảng' : 'Ngoại bảng'}. ` +
            `Vui lòng kiểm tra và chọn đúng tab.`
        );
      }
    } else {
      toast.success(`Import hoàn tất: ${successCount} file thành công.`);
    }
  };

  const removeFile = (fileId) => {
    setFiles(files.filter((file) => file.id !== fileId));
  };

  const hasFilesToUpload = files.some((f) => f.status === 'waiting' || f.status === 'error');

  return (
    <div>
      <div
        {...getRootProps({
          className: `${styles.dropzone} ${isDragActive ? styles.dragActive : ''}`,
        })}
      >
        <input {...getInputProps()} />
        <SvgIcon
          path="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"
          className={styles.uploadIcon}
        />
        <p>
          {isDragActive
            ? 'Thả file Excel vào đây...'
            : 'Kéo và thả file Excel vào đây, hoặc nhấn để chọn file'}
        </p>
        <em className={styles.fileTypeHint}>
          📋 Chỉ chấp nhận file Excel (.xls, .xlsx) | Kích thước tối đa: 50MB
        </em>
        <small className={styles.additionalHint}>
          ⚠️ Hệ thống sẽ kiểm tra định dạng file để đảm bảo an toàn
        </small>
      </div>
      {files.length > 0 && (
        <div className={styles.fileList}>
          <ul>
            {files.map((file) => (
              <li key={file.id} className={`${styles.fileListItem} ${styles[file.status]}`}>
                <div className={styles.fileDetails}>
                  <div className={styles.fileInfo}>
                    <SvgIcon
                      path="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"
                      className={styles.fileIcon}
                    />
                    <div>
                      <span className={styles.fileName}>{file.name}</span>
                      <span className={styles.fileSize}>({(file.size / 1024).toFixed(2)} KB)</span>
                    </div>
                  </div>
                  <div className={styles.fileStatus}>
                    <span className={styles.statusMessage}>{file.message}</span>
                    <button
                      onClick={() => removeFile(file.id)}
                      className={styles.removeBtn}
                      disabled={file.status === 'uploading'}
                    >
                      &times;
                    </button>
                  </div>
                </div>
                {file.status === 'success' && <ImportResult result={file.result} />}
                {(file.status === 'error' || file.status === 'critical' || file.status === 'corruption') && (
                  <ErrorDetails 
                    error={file.message} 
                    importType={importType} 
                    fileName={file.name}
                    onShowModal={onShowErrorModal}
                  />
                )}
              </li>
            ))}
          </ul>
          <div className={styles.actions}>
            <button onClick={handleUpload} disabled={isUploading || !hasFilesToUpload}>
              {isUploading ? 'Đang xử lý...' : 'Bắt đầu Import'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

function ImportPage() {
  const [activeTab, setActiveTab] = useState('internal');
  const [modalState, setModalState] = useState({
    isOpen: false,
    fileName: '',
    errorMessage: ''
  });

  if (localStorage.getItem('token') === null) {
    toast.error('Lỗi: Không tìm thấy token xác thực. Vui lòng đăng nhập lại.');
  }

  const showErrorModal = ({ fileName, errorMessage }) => {
    setModalState({
      isOpen: true,
      fileName,
      errorMessage
    });
  };

  const closeModal = () => {
    setModalState({
      isOpen: false,
      fileName: '',
      errorMessage: ''
    });
  };

  return (
    <>
      <div className={styles.pageHeader}>
        <h1>Import Dữ liệu Hồ sơ</h1>
        <p>
          Chọn loại hồ sơ và tải lên file Excel (.xls, .xlsx) tương ứng. Hệ thống sẽ kiểm tra định
          dạng file để đảm bảo bảo mật.
        </p>
      </div>

      <div className={styles.card}>
        <div className={styles.tabNav}>
          <button
            className={`${styles.tabButton} ${activeTab === 'internal' ? styles.active : ''}`}
            onClick={() => setActiveTab('internal')}
          >
            Nội bảng
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === 'external' ? styles.active : ''}`}
            onClick={() => setActiveTab('external')}
          >
            Ngoại bảng
          </button>
        </div>

        <div className={styles.tabContent}>
          {activeTab === 'internal' && (
            <div>
              <div className={styles.templateHint}>
                📋 <strong>Mẫu file Nội bảng:</strong> File Excel cần có các cột: 
                <code>AQCCDFIN</code>, <code>brcd</code>, <code>dsbsbal</code>, <code>ofcno</code>, <code>custnm</code>
              </div>
              <UploadArea importType="internal" key="internal" onShowErrorModal={showErrorModal} />
            </div>
          )}
          {activeTab === 'external' && (
            <div>
              <div className={styles.templateHint}>
                📋 <strong>Mẫu file Ngoại bảng:</strong> File Excel cần có các cột: 
                <code>makh</code>, <code>Ngoaibang</code>, <code>cbtd</code>, <code>TenKhachHang</code>
              </div>
              <UploadArea importType="external" key="external" onShowErrorModal={showErrorModal} />
            </div>
          )}
        </div>
      </div>

      {/* Error Modal */}
      {modalState.isOpen && (
        <ErrorModal
          fileName={modalState.fileName}
          errorMessage={modalState.errorMessage}
          onClose={closeModal}
        />
      )}
    </>
  );
}

export default ImportPage;