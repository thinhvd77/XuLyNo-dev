import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import { API_ENDPOINTS } from '../../config/api';
import styles from './DocumentUploader.module.css';

const DocumentUploader = ({ caseId, onUploadSuccess, onTimelineRefresh }) => {
  const [files, setFiles] = useState([]);
  const [currentDocType, setCurrentDocType] = useState('court');
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback(
    (acceptedFiles, rejectedFiles) => {
      if (rejectedFiles.length > 0) {
        rejectedFiles.forEach(({ file, errors }) => {
          errors.forEach((error) => {
            if (error.code === 'file-too-large') {
              toast.error(`File "${file.name}" quá lớn (tối đa 50MB)`);
            } else if (error.code === 'file-invalid-type') {
              toast.error(`File "${file.name}" không được hỗ trợ`);
            } else {
              toast.error(`Lỗi file "${file.name}": ${error.message}`);
            }
          });
        });
      }

      if (acceptedFiles.length > 0) {
        const newFiles = acceptedFiles.map((file) => ({
          id: uuidv4(),
          fileObject: file,
          docType: currentDocType,
          status: 'waiting',
          message: 'Sẵn sàng',
        }));
        setFiles((prev) => [...prev, ...newFiles]);
        toast.success(`${newFiles.length} file đã được thêm vào danh sách!`);
      }
    },
    [currentDocType],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 50 * 1024 * 1024,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp', '.bmp'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'text/plain': ['.txt'],
      'text/csv': ['.csv'],
      'video/*': ['.mp4', '.avi', '.mov', '.wmv', '.webm'],
      'audio/*': ['.mp3', '.wav', '.ogg'],
      'application/zip': ['.zip'],
      'application/x-rar-compressed': ['.rar'],
      'application/x-7z-compressed': ['.7z'],
    },
  });

  const getTypeName = (type) => {
    const types = {
      enforcement: 'Thi hành án',
      court: 'Tòa án',
      notification: 'Bán nợ',
      proactive: 'Chủ động XLTS',
      collateral: 'Tài sản đảm bảo',
      processed_collateral: 'TS đã xử lý',
      other: 'Tài liệu khác',
    };
    return types[type] || 'Không xác định';
  };

  const handleUploadAll = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Không tìm thấy token. Vui lòng đăng nhập lại.');
      return;
    }

    setIsUploading(true);
    toast.loading('Đang tải lên các file...', { id: 'upload-all' });

    const filesToUpload = files.filter((f) => f.status === 'waiting' || f.status === 'error');

    const uploadPromises = filesToUpload.map((file) => {
      const formData = new FormData();

      const fileBlob = new File([file.fileObject], file.fileObject.name, {
        type: file.fileObject.type,
        lastModified: file.fileObject.lastModified,
      });

      formData.append('documentFile', fileBlob);
      formData.append('document_type', file.docType);

      return fetch(API_ENDPOINTS.CASES.DOCUMENTS(caseId), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.message || 'Upload thất bại');
          }
          setFiles((prev) =>
            prev.map((f) =>
              f.id === file.id ? { ...f, status: 'success', message: 'Thành công' } : f,
            ),
          );
          return data;
        })
        .catch((err) => {
          let errorMessage = 'Upload thất bại';

          if (err.message.includes('File quá lớn')) {
            errorMessage = 'File quá lớn (tối đa 50MB)';
          } else if (err.message.includes('Loại file không được hỗ trợ')) {
            errorMessage = 'Loại file không được hỗ trợ';
          } else if (err.message.includes('Không đủ dung lượng')) {
            errorMessage = 'Không đủ dung lượng lưu trữ';
          }

          setFiles((prev) =>
            prev.map((f) =>
              f.id === file.id ? { ...f, status: 'error', message: errorMessage } : f,
            ),
          );
          throw err;
        });
    });

    await Promise.all(uploadPromises);
    setIsUploading(false);
    toast.dismiss('upload-all');

    // Emit global event to refresh timeline after file uploads
    window.dispatchEvent(
      new CustomEvent('case-file-uploaded', {
        detail: {
          caseId,
          operation: 'upload',
          fileCount: filesToUpload.length,
        },
      }),
    );

    if (onUploadSuccess) {
      onUploadSuccess();
    }

    if (onTimelineRefresh) {
      onTimelineRefresh();
    }

    setFiles((prev) => prev.filter((f) => f.status !== 'success'));
    toast.success('Hoàn tất quá trình upload!');
  };

  const removeFile = (fileId) => setFiles(files.filter((f) => f.id !== fileId));
  const hasFilesToUpload = files.some((f) => f.status === 'waiting' || f.status === 'error');

  return (
    <div className={styles.uploaderContainer}>
      <div className={styles.formGroup}>
        <label htmlFor="doc-type">1. Chọn loại tài liệu</label>
        <select
          id="doc-type"
          className={styles.formControl}
          value={currentDocType}
          onChange={(e) => setCurrentDocType(e.target.value)}
        >
          <option value="court">Tài liệu Tòa án</option>
          <option value="enforcement">Tài liệu Thi hành án</option>
          <option value="notification">Tài liệu Bán nợ</option>
          <option value="proactive">Tài liệu Chủ động xử lý tài sản</option>
          <option value="collateral">Tài sản đảm bảo (Ảnh QR)</option>
          <option value="processed_collateral">Tài liệu tài sản đã xử lý</option>
          <option value="other">Tài liệu khác</option>
        </select>
      </div>

      <div className={styles.formGroup}>
        <label>2. Tải lên file cho loại tài liệu trên</label>
        <div
          {...getRootProps({
            className: `${styles.dropzone} ${isDragActive ? styles.dragActive : ''}`,
          })}
        >
          <input {...getInputProps()} />
          <p>Kéo thả hoặc nhấn để chọn file</p>
        </div>
      </div>

      {files.length > 0 && (
        <div className={styles.fileList}>
          <div className={styles.fileListHeader}>
            <h4>Danh sách file chờ upload ({files.length})</h4>
            <button
              onClick={handleUploadAll}
              disabled={isUploading || !hasFilesToUpload}
              className={styles.uploadBTN}
            >
              {isUploading ? 'Đang xử lý...' : 'Tải lên tất cả'}
            </button>
          </div>
          <ul>
            {files.map((file) => (
              <li key={file.id} className={`${styles.fileQueueItem} ${styles[file.status]}`}>
                <div className={styles.fileInfo}>
                  <span className={styles.fileTypeBadge}>{getTypeName(file.docType)}</span>
                  <span className={styles.fileName}>{file.fileObject.name}</span>
                  <span className={styles.fileSize}>
                    ({Math.round(file.fileObject.size / 1024)} KB)
                  </span>
                </div>
                <div className={styles.fileStatus}>
                  <span className={styles.statusText}>{file.message}</span>
                  <button onClick={() => removeFile(file.id)} className={styles.removeDoc}>
                    🗙
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default DocumentUploader;
