import { useState } from 'react';
import toast from 'react-hot-toast';
import styles from './AddCaseNote.module.css';
import { API_ENDPOINTS } from '../../config/api';

const AddCaseNote = ({ caseId, onNoteAdded }) => {
  const [noteContent, setNoteContent] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!noteContent.trim()) {
      toast.error('Vui lòng nhập nội dung ghi chú');
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_ENDPOINTS.CASES.CASE_NOTES}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          case_id: caseId,
          note_content: noteContent.trim(),
          is_private: isPrivate,
        }),
      });
      let data = {};
      try {
        data = await response.json();
      } catch (parseErr) {
        // Handle empty/invalid JSON
        console.error('Failed to parse JSON response when adding note', parseErr);
        throw new Error('Phản hồi máy chủ không hợp lệ');
      }

      if (response.ok && data.success) {
        toast.success('Ghi chú đã được thêm thành công');
        setNoteContent('');
        setIsPrivate(false);

        // Emit global event to refresh timeline
        window.dispatchEvent(
          new CustomEvent('case-timeline-refresh', {
            detail: {
              caseId,
              reason: 'note_added',
              noteData: data.data,
            },
          }),
        );

        // Notify parent component
        if (onNoteAdded && data.data) {
          onNoteAdded(data.data);
        }
      } else {
        throw new Error(data.message || 'Lỗi khi thêm ghi chú');
      }
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error(error.message || 'Có lỗi xảy ra khi thêm ghi chú');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.addCaseNote}>
      <form onSubmit={handleSubmit} className={styles.noteForm}>
        <div className={styles.formGroup}>
          <label htmlFor="note-content" className={styles.label}>
            Thêm ghi chú mới:
          </label>
          <textarea
            id="note-content"
            className={styles.textarea}
            placeholder="Nhập nội dung ghi chú..."
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            rows={4}
            disabled={isSubmitting}
          />
        </div>

        <div className={styles.formOptions}>
          <button
            type="submit"
            className={styles.submitButton}
            disabled={isSubmitting || !noteContent.trim()}
          >
            {isSubmitting ? 'Đang gửi...' : 'Thêm ghi chú'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddCaseNote;
