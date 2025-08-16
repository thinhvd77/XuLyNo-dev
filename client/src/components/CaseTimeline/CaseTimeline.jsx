import { useState, useEffect } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import styles from './CaseTimeline.module.css';
import useCaseTimeline from '../../hooks/useCaseTimeline';
import AddCaseNote from '../AddCaseNote/AddCaseNote';
import { CASE_ACTIVITY_TYPES } from '../../constants/activityConstants';

// Timeline item icons
const TimelineIcon = ({ type, activityType }) => {
  const getIconData = () => {
    if (type === 'note') {
      return {
        path: 'M19,3H5C3.9,3 3,3.9 3,5V19C3,20.1 3.9,21 5,21H19C20.1,21 21,20.1 21,19V5C21,3.9 20.1,3 19,3M19,19H5V5H19V19ZM17,12H7V10H17V12ZM15,16H7V14H15V16ZM17,8H7V6H17V8Z',
        color: '#3b82f6', // Blue for notes
      };
    }

    switch (activityType) {
      case CASE_ACTIVITY_TYPES?.STATUS_CHANGE:
        return {
          path: 'M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,16.5L6.5,12L7.91,10.59L11,13.67L16.59,8.09L18,9.5L11,16.5Z',
          color: '#10b981', // Green for status changes
        };
      case CASE_ACTIVITY_TYPES?.FILE_UPLOAD:
        return {
          path: 'M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z',
          color: '#8b5cf6', // Purple for file uploads
        };
      case CASE_ACTIVITY_TYPES?.FILE_DELETE:
        return {
          path: 'M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z',
          color: '#ef4444', // Red for file deletions
        };
      case CASE_ACTIVITY_TYPES?.CASE_ASSIGNMENT:
        return {
          path: 'M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z',
          color: '#f59e0b', // Orange for assignments
        };
      default:
        return {
          path: 'M13,9H11V7H13M13,17H11V11H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z',
          color: '#6b7280', // Gray for default/system activities
        };
    }
  };

  const iconClass = type === 'note' ? styles.noteIcon : styles.activityIcon;
  const { path, color } = getIconData();

  return (
    <div className={iconClass}>
      <svg viewBox="0 0 24 24" fill={color}>
        <path d={path} />
      </svg>
    </div>
  );
};

// Timeline item component
const TimelineItem = ({ item, isLast = false }) => {
  const isNote = item.type === 'note';
  const date = new Date(item.performedDate);
  const formattedDate = format(date, 'dd/MM/yyyy HH:mm', { locale: vi });
  const relativeTime = formatDistanceToNow(date, { addSuffix: true, locale: vi });

  // Title and status change UI handled inline where needed

  return (
    <div
      className={`${styles.timelineItem} ${isNote ? styles.noteItem : styles.activityItem} ${isLast ? styles.lastItem : ''}`}
      style={isLast ? { '--timeline-line-display': 'none' } : {}}
    >
      <div className={styles.timelineIcon}>
        <TimelineIcon type={item.type} activityType={item.activityType} />
      </div>
      <div className={styles.timelineContent}>
        <div className={styles.timelineHeader}>
          <div className={styles.titleSection}>
            <div className={styles.performer}>
              <span>{item.performedBy?.fullname || 'Hệ thống'}</span>
              {item.performedBy?.department && (
                <span className={styles.department}>• {item.performedBy.department}</span>
              )}
            </div>
          </div>
          <div className={styles.timeSection}>
            <time className={styles.timestamp} title={formattedDate}>
              {relativeTime}
            </time>
          </div>
        </div>

        <div className={styles.contentBody}>
          {/* {getStatusChangeDisplay()} */}
          <div className={styles.description}>{item.content}</div>
        </div>
      </div>
    </div>
  );
};

// Main timeline component
const CaseTimeline = ({ caseId }) => {
  const {
    timeline,
    isLoading,
    isLoadingMore,
    error,
    pagination,
    loadMore,
    refresh,
    addTimelineItem,
  } = useCaseTimeline(caseId);
  const [filter, setFilter] = useState('all');

  // Listen for global status change events to refresh timeline
  useEffect(() => {
    const handler = (e) => {
      const { caseId: eventCaseId, activity } = e.detail || {};
      if (!activity || eventCaseId !== caseId) return;

      // Refresh timeline to get updated data from server
      setTimeout(() => refresh(filter), 500); // Small delay to ensure server has processed
    };
    window.addEventListener('case-status-changed', handler);
    return () => window.removeEventListener('case-status-changed', handler);
  }, [caseId, refresh, filter]);

  // Listen for timeline refresh events from other components
  useEffect(() => {
    const handleTimelineRefresh = (e) => {
      const { caseId: eventCaseId, reason } = e.detail || {};
      if (eventCaseId && eventCaseId !== caseId) return;

      // Refresh timeline with current filter
      refresh(filter);
    };

    const handleFileOperations = (e) => {
      const { caseId: eventCaseId, operation, fileName } = e.detail || {};
      if (eventCaseId && eventCaseId !== caseId) return;

      // Refresh timeline to show file upload/delete activities
      setTimeout(() => refresh(filter), 500); // Small delay to ensure server has processed
    };

    window.addEventListener('case-timeline-refresh', handleTimelineRefresh);
    window.addEventListener('case-file-uploaded', handleFileOperations);
    window.addEventListener('case-file-deleted', handleFileOperations);

    return () => {
      window.removeEventListener('case-timeline-refresh', handleTimelineRefresh);
      window.removeEventListener('case-file-uploaded', handleFileOperations);
      window.removeEventListener('case-file-deleted', handleFileOperations);
    };
  }, [caseId, refresh, filter]);

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    refresh(newFilter);
  };

  const handleNoteAdded = (newNote) => {
    // Convert note to timeline item format
    const timelineItem = {
      id: newNote.note_id,
      type: 'note',
      caseId: newNote.case_id,
      content: newNote.note_content,
      isPrivate: newNote.is_private,
      performedBy: {
        employeeCode: newNote.created_by_employee_code,
        fullname: 'Bạn', // Current user
        department: '',
        role: '',
      },
      performedDate: new Date().toISOString(),
      updatedDate: null,
    };

    addTimelineItem(timelineItem);

    // Refresh to get updated data from server and trigger global event
    setTimeout(() => {
      refresh(filter);

      // Emit global event for other components that might need to refresh
      window.dispatchEvent(
        new CustomEvent('case-timeline-refresh', {
          detail: {
            caseId,
            reason: 'note_added',
            noteId: newNote.note_id,
          },
        }),
      );
    }, 500);
  };

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <span>Đang tải timeline...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error}>
        <p>Có lỗi xảy ra: {error}</p>
        <button onClick={() => refresh(filter)} className={styles.retryButton}>
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className={styles.caseTimeline}>
      <AddCaseNote caseId={caseId} onNoteAdded={handleNoteAdded} />

      <div className={styles.timelineHeader}>
        <h3>Lịch sử hoạt động</h3>
        <div className={styles.filters}>
          <button
            className={filter === 'all' ? styles.active : ''}
            onClick={() => handleFilterChange('all')}
          >
            Tất cả
          </button>
          <button
            className={filter === 'notes' ? styles.active : ''}
            onClick={() => handleFilterChange('notes')}
          >
            Ghi chú
          </button>
          <button
            className={filter === 'activities' ? styles.active : ''}
            onClick={() => handleFilterChange('activities')}
          >
            Hoạt động
          </button>
        </div>
      </div>

      <div className={styles.timelineList}>
        {timeline.length === 0 ? (
          <div className={styles.emptyState}>
            <p>Chưa có hoạt động nào được ghi nhận</p>
          </div>
        ) : (
          <>
            {timeline.map((item, index) => (
              <TimelineItem
                key={`${item.type}-${item.id}`}
                item={item}
                isLast={index === timeline.length - 1}
              />
            ))}
          </>
        )}
      </div>
      {pagination.hasMore && (
        <div className={styles.loadMoreSection}>
          <button onClick={loadMore} disabled={isLoadingMore} className={styles.loadMoreButton}>
            {isLoadingMore ? 'Đang tải...' : 'Xem thêm'}
          </button>
        </div>
      )}
    </div>
  );
};

export default CaseTimeline;
