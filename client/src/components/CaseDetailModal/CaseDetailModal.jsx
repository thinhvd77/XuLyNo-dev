import { useState, useEffect } from 'react';
import styles from './CaseDetailModal.module.css';
import { API_ENDPOINTS } from '../../config/api';
import toast from 'react-hot-toast';

const CaseDetailModal = ({ caseId, isOpen, onClose }) => {
  const [caseDetail, setCaseDetail] = useState(null);
  const [caseNotes, setCaseNotes] = useState([]); // public notes only
  const [caseDocuments, setCaseDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Pagination state for notes
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreNotes, setHasMoreNotes] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const notesPerPage = 5;

  useEffect(() => {
    if (isOpen && caseId) {
      fetchCaseDetail();
    }
  }, [isOpen, caseId]);

  // Function to fetch notes with pagination (fallback to client pagination if API unsupported)
  const fetchNotes = async (page = 1, reset = false) => {
    const token = localStorage.getItem('token');
    if (!token || !caseId) return;
    try {
      const offset = (page - 1) * notesPerPage;
      // Correct endpoint for listing notes: /api/case-notes/case/:caseId
      const baseUrl = `${API_ENDPOINTS.CASES.CASE_NOTES}/case/${caseId}`;
      const url = `${baseUrl}?limit=${notesPerPage}&offset=${offset}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const msg = `Không thể tải ghi chú (HTTP ${response.status})`;
        if (reset) setCaseNotes([]);
        toast.error(msg);
        return;
      }

      const result = await response.json();
      // Shape: { success, data: [ ...notes ], pagination: { limit, offset } }
      const rawNotes = Array.isArray(result?.data)
        ? result.data
        : Array.isArray(result?.notes)
          ? result.notes
          : Array.isArray(result)
            ? result
            : [];

      const publicNotes = rawNotes.filter((n) => n && n.is_private !== true);
      publicNotes.sort(
        (a, b) =>
          new Date(b.created_date || b.createdDate) - new Date(a.created_date || a.createdDate),
      );

      if (reset) {
        setCaseNotes(publicNotes);
      } else {
        setCaseNotes((prev) => {
          const existingIds = new Set(prev.map((n) => n.note_id));
          const merged = [...prev];
          for (const n of publicNotes) if (!existingIds.has(n.note_id)) merged.push(n);
          return merged;
        });
      }

      // Determine hasMore from count returned vs requested batch size
      setHasMoreNotes(publicNotes.length === notesPerPage);
      setCurrentPage(page);
    } catch {
      if (reset) setCaseNotes([]);
      toast.error('Không thể tải ghi chú');
    }
  };

  const loadMoreNotes = async () => {
    if (isLoadingMore || !hasMoreNotes) return;
    try {
      setIsLoadingMore(true);
      await fetchNotes(currentPage + 1, false);
    } catch {
      toast.error('Lỗi tải thêm ghi chú');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const fetchCaseDetail = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      setIsLoading(true);
      setError(null);
      const detailResponse = await fetch(API_ENDPOINTS.CASES.CASE_DETAIL(caseId), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!detailResponse.ok) throw new Error('Không thể tải thông tin chi tiết hồ sơ.');
      const detailResult = await detailResponse.json();
      setCaseDetail(detailResult.data);
      // Reset and fetch notes
      setCurrentPage(1);
      setHasMoreNotes(false);
      await fetchNotes(1, true);
      // Documents
      const documentsResponse = await fetch(API_ENDPOINTS.CASES.DOCUMENTS(caseId), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (documentsResponse.ok) {
        const documentsResult = await documentsResponse.json();
        console.log(documentsResult);

        setCaseDocuments(documentsResult.data || []);
      } else {
        toast.error('Không thể tải tài liệu');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  const handlePreviewDocument = async (documentId) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(API_ENDPOINTS.CASES.DOCUMENT_PREVIEW(documentId), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        alert('Không thể xem trước tài liệu.');
      }
    } catch {
      alert('Lỗi khi xem trước tài liệu.');
    }
  };
  const handleDownloadDocument = async (documentId, fileName) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(API_ENDPOINTS.CASES.DOCUMENT_DOWNLOAD(documentId), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (e) {
      console.error('Error downloading document', e);
    }
  };

  const getFileIcon = (fileName) => {
    if (!fileName) return null;
    const ext = fileName.split('.').pop().toLowerCase();
    const icon = (color, path) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill={color}>
        <path d={path} />
      </svg>
    );
    switch (ext) {
      case 'pdf':
        return icon(
          '#d32f2f',
          'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z',
        );
      case 'doc':
      case 'docx':
        return icon(
          '#1976d2',
          'M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z',
        );
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return icon(
          '#4caf50',
          'M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z',
        );
      default:
        return icon(
          '#757575',
          'M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z',
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Chi tiết hồ sơ</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>
        <div className={styles.modalBody}>
          {isLoading ? (
            <div className={styles.loading}>Đang tải thông tin...</div>
          ) : error ? (
            <div className={styles.error}>Lỗi: {error}</div>
          ) : caseDetail ? (
            <>
              {/* Ghi chú gần nhất */}
              {caseNotes.length > 0 && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Ghi chú gần nhất</h3>
                  <div className={styles.recentUpdate}>
                    <div className={styles.recentUpdateContent}>
                      <div className={styles.updateMeta}>
                        <span className={styles.updateDate}>
                          {formatDate(caseNotes[0].created_date)}
                        </span>
                        <span className={styles.updateAuthor}>
                          {caseNotes[0].created_by_fullname ||
                            caseNotes[0].created_by_employee_code ||
                            'Không xác định'}
                        </span>
                      </div>
                      <div className={styles.updateContent}>{caseNotes[0].note_content}</div>
                    </div>
                  </div>
                </div>
              )}
              {/* Tài liệu đính kèm */}
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Tài liệu đính kèm</h3>
                <div className={styles.documentsContainer}>
                  {caseDocuments.length === 0 ? (
                    <div className={styles.noDocuments}>Chưa có tài liệu nào được tải lên.</div>
                  ) : (
                    <div className={styles.documentsList}>
                      {caseDocuments.map((document) => (
                        <div key={document.document_id} className={styles.documentItem}>
                          <div className={styles.documentInfo}>
                            <div className={styles.documentIcon}>
                              {getFileIcon(document.original_filename)}
                            </div>
                            <div className={styles.documentDetails}>
                              <div className={styles.documentName}>
                                {document.original_filename}
                              </div>
                              <div className={styles.documentMeta}>
                                <span className={styles.documentDate}>
                                  {formatDate(document.upload_date)}
                                </span>
                                <span className={styles.documentUploader}>
                                  {document.uploader?.fullname || 'Không xác định'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className={styles.documentActions}>
                            <button
                              onClick={() =>
                                handlePreviewDocument(
                                  document.document_id,
                                  document.original_filename,
                                )
                              }
                              className={styles.previewBtn}
                              title="Xem trước"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z" />
                              </svg>
                            </button>
                            <button
                              onClick={() =>
                                handleDownloadDocument(
                                  document.document_id,
                                  document.original_filename,
                                )
                              }
                              className={styles.downloadBtn}
                              title="Tải xuống"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {/* Lịch sử ghi chú */}
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  Lịch sử ghi chú{' '}
                  {caseNotes.length > 0 && (
                    <span className={styles.updateCount}>({caseNotes.length})</span>
                  )}
                </h3>
                <div className={styles.updatesContainer}>
                  {caseNotes.length === 0 ? (
                    <div className={styles.noUpdates}>Chưa có ghi chú nào cho hồ sơ này.</div>
                  ) : (
                    <>
                      <div className={styles.timelineContainer}>
                        <div className={styles.timeline}>
                          {caseNotes.map((note) => (
                            <div key={note.note_id} className={styles.timelineItem}>
                              <div className={styles.timelineIcon}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                                </svg>
                              </div>
                              <div className={styles.timelineContent}>
                                <div className={styles.updateMeta}>
                                  <span className={styles.updateDate}>
                                    {formatDate(note.created_date)}
                                  </span>
                                  <span className={styles.updateAuthor}>
                                    {note.created_by_fullname ||
                                      note.created_by_employee_code ||
                                      'Không xác định'}
                                  </span>
                                </div>
                                <div className={styles.updateContent}>{note.note_content}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {hasMoreNotes && (
                        <div className={styles.showMoreContainer}>
                          <button
                            onClick={loadMoreNotes}
                            className={styles.showMoreBtn}
                            disabled={isLoadingMore}
                          >
                            {isLoadingMore ? (
                              <>
                                <svg
                                  className={styles.loadingIcon}
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    fill="currentColor"
                                    d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z"
                                    opacity=".25"
                                  />
                                  <path
                                    fill="currentColor"
                                    d="M12,4a8,8,0,0,1,7.89,6.7A1.53,1.53,0,0,0,21.38,12h0a1.5,1.5,0,0,0,1.48-1.75,11,11,0,0,0-21.72,0A1.5,1.5,0,0,0,2.62,12h0a1.53,1.53,0,0,0,1.49-1.3A8,8,0,0,1,12,4Z"
                                  />
                                </svg>
                                Đang tải...
                              </>
                            ) : (
                              <>
                                Xem thêm {notesPerPage} ghi chú
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z" />
                                </svg>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.closeBtn} onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default CaseDetailModal;
