import React from 'react';
import styles from './Pagination.module.css';

function Pagination({ currentPage, totalPages, onPageChange }) {
  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  return (
    <div className={styles.pageNav}>
      <button onClick={handlePrevious} disabled={currentPage === 1}>
        &laquo;
      </button>
      {/* Trong một ứng dụng thực tế, bạn có thể tạo logic để hiển thị các số trang phức tạp hơn */}
      <button className={styles.active}>{currentPage}</button>
      <button onClick={handleNext} disabled={currentPage === totalPages}>
        &raquo;
      </button>
    </div>
  );
}

export default Pagination;
