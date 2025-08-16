import { useState, useEffect } from 'react';
import API_BASE_URL, { API_ENDPOINTS } from '../../config/api';
import styles from './PreviewModal.module.css';

const PreviewModal = ({ isOpen, onClose, file }) => {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && file) {
      loadPreview(file);
    }
    return () => {
      if (previewUrl) {
        window.URL.revokeObjectURL(previewUrl);
      }
    };
  }, [isOpen, file]);

  const loadPreview = async (file) => {
    try {
      setError(null);
      const token = localStorage.getItem('token');
      const response = await fetch(API_ENDPOINTS.CASES.DOCUMENT_PREVIEW(file.document_id), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Không thể tải file để xem trước');
      }

      const blob = await response.blob();

      if (blob.size === 0) {
        throw new Error('File rỗng hoặc không hợp lệ');
      }

      const url = window.URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (err) {
      setError(err.message);
    }
  };

  if (!isOpen || !file) return null;

  const mimeType = file.mime_type || '';

  const renderPreview = () => {
    if (error) {
      return <div className={styles.error}>Lỗi: {error}</div>;
    }

    if (!previewUrl) {
      return <div className={styles.loading}>Đang tải...</div>;
    }

    if (mimeType.startsWith('image/')) {
      return <img src={previewUrl} alt={file.original_filename} className={styles.previewImage} />;
    } else if (mimeType.includes('pdf')) {
      return (
        <div className={styles.pdfContainer}>
          <iframe
            src={previewUrl}
            width="100%"
            height="100%"
            style={{ border: 'none' }}
            title={file.original_filename}
            onError={() => {
              setError(
                'Không thể hiển thị PDF trong trình duyệt. Hãy thử Google Viewer hoặc tải xuống file.',
              );
            }}
          />
          <div className={styles.pdfFallback}>
            <p>
              Không thể hiển thị PDF?{' '}
              <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                Mở trong tab mới
              </a>
            </p>
            <iframe
              src={`https://docs.google.com/viewer?url=${encodeURIComponent(
                `${API_BASE_URL}/api/cases/documents/${file.document_id}/preview`,
              )}&embedded=true`}
              width="100%"
              height="100%"
              style={{ border: 'none' }}
              title={file.original_filename}
              onError={() => {
                setError('Google Viewer không thể tải file. Vui lòng thử phương thức khác.');
              }}
            />
          </div>
        </div>
      );
    } else if (mimeType.startsWith('video/')) {
      return <video src={previewUrl} controls className={styles.previewVideo} />;
    } else if (mimeType.startsWith('audio/')) {
      return <audio src={previewUrl} controls className={styles.previewAudio} />;
    } else {
      return <div className={styles.unsupported}>Không hỗ trợ xem trước loại file này</div>;
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>{file.original_filename}</h3>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>
        <div className={styles.modalBody}>{renderPreview()}</div>
        <div className={styles.modalFooter}>
          <div className={styles.fileMetadata}>
            <p>Kích thước: {Math.round(file.file_size / 1024)} KB</p>
            <p className={styles.mimeType}>MIME: {file.mime_type || 'N/A'}</p>
          </div>
          <button
            className={styles.downloadBtn}
            onClick={() => {
              const token = localStorage.getItem('token');
              const downloadUrl = API_ENDPOINTS.CASES.DOCUMENT_DOWNLOAD(file.document_id);
              fetch(downloadUrl, {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              })
                .then((response) => response.blob())
                .then((blob) => {
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = decodeURIComponent(file.original_filename || 'download');
                  document.body.appendChild(a);
                  a.click();
                  window.URL.revokeObjectURL(url);
                  document.body.removeChild(a);
                });
            }}
          >
            Tải xuống
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreviewModal;
