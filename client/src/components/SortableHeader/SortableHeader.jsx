import styles from './SortableHeader.module.css';

const SortableHeader = ({ field, currentSortField, sortDirection, onSort, children }) => {
  const getSortIcon = () => {
    if (currentSortField !== field) {
      // Icon mặc định khi chưa sort - Both arrows (outlined)
      return (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M8 10L12 6L16 10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M8 14L12 18L16 14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    }

    if (sortDirection === 'asc') {
      // Icon sort tăng dần - Up arrow (outlined)
      return (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M8 14L12 10L16 14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    } else {
      // Icon sort giảm dần - Down arrow (outlined)
      return (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M8 10L12 14L16 10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    }
  };

  return (
    <th
      className={`${styles.sortableHeader} ${currentSortField === field ? styles.sorted : ''}`}
      onClick={() => onSort(field)}
    >
      <div className={styles.headerContent}>
        <span>{children}</span>
        <span className={styles.sortIcon}>{getSortIcon()}</span>
      </div>
    </th>
  );
};

export default SortableHeader;
