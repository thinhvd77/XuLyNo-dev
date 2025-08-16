import { useState } from 'react';
import styles from './DataTable.module.css';

function DataTable({
  data = [],
  columns = [],
  onRowAction = null,
  actionButtonText = 'Xem chi tiết',
  actionWidth = '100px',
  isLoading = false,
  emptyMessage = 'Không có dữ liệu',
  sortable = true,
  onSort = null,
  sortField = '',
  sortDirection = 'asc',
  serverSideSort = false,
  // New: optional sizing overrides
  containerHeight,
  wrapperMaxHeight,
}) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const handleSort = (key) => {
    if (!sortable) return;

    if (serverSideSort && onSort) {
      // Server-side sorting
      onSort(key);
    } else {
      // Client-side sorting
      let direction = 'asc';
      if (sortConfig.key === key && sortConfig.direction === 'asc') {
        direction = 'desc';
      }
      setSortConfig({ key, direction });
    }
  };

  const getSortedData = () => {
    // Ensure data is always an array
    const safeData = Array.isArray(data) ? data : [];

    if (serverSideSort) {
      // Server-side sorting: return data as-is since it's already sorted
      return safeData;
    }

    // Client-side sorting
    if (!sortConfig.key) return safeData;

    return [...safeData].sort((a, b) => {
      // Find the column configuration for custom sort logic
      const column = columns.find((col) => col.key === sortConfig.key);

      let aValue, bValue;

      // Use custom sortValue function if provided
      if (column && column.sortValue) {
        aValue = column.sortValue(a[sortConfig.key], a);
        bValue = column.sortValue(b[sortConfig.key], b);
      } else {
        aValue = a[sortConfig.key];
        bValue = b[sortConfig.key];
      }

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      // Handle numeric values (including strings that represent numbers)
      const aNum = parseFloat(aValue);
      const bNum = parseFloat(bValue);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        const comparison = aNum - bNum;
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase());
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        const comparison = aValue - bValue;
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      }

      // For dates
      if (aValue instanceof Date && bValue instanceof Date) {
        const comparison = aValue.getTime() - bValue.getTime();
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      }

      // String comparison as fallback
      const comparison = String(aValue).localeCompare(String(bValue));
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  };

  const getSortIcon = (columnKey) => {
    if (!sortable) return null;

    // Determine current sort state
    let currentField, currentDirection;
    if (serverSideSort) {
      currentField = sortField;
      currentDirection = sortDirection;
    } else {
      currentField = sortConfig.key;
      currentDirection = sortConfig.direction;
    }

    if (currentField !== columnKey) {
      return (
        <span className={styles.sortIcon}>
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
        </span>
      );
    }
    return currentDirection === 'asc' ? (
      <span className={styles.sortIcon}>
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
      </span>
    ) : (
      <span className={styles.sortIcon}>
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
      </span>
    );
  };

  if (isLoading) {
    return (
      <div
        className={styles.tableContainer}
        style={containerHeight ? { height: containerHeight } : undefined}
      >
        <div className={styles.loadingMessage}>Đang tải dữ liệu...</div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        className={styles.tableContainer}
        style={containerHeight ? { height: containerHeight } : undefined}
      >
        <div className={styles.emptyMessage}>{emptyMessage}</div>
      </div>
    );
  }

  const sortedData = getSortedData();

  return (
    <div
      className={styles.tableContainer}
      style={containerHeight ? { height: containerHeight } : undefined}
    >
      <div
        className={styles.tableWrapper}
        style={wrapperMaxHeight ? { maxHeight: wrapperMaxHeight } : undefined}
      >
        <table className={styles.dataTable}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`${styles.tableHeader} ${sortable ? styles.sortable : ''}`}
                  onClick={() => handleSort(column.key)}
                  style={{ width: column.width }}
                >
                  <div className={styles.headerContent}>
                    <span>{column.title}</span>
                    {getSortIcon(column.key)}
                  </div>
                </th>
              ))}
              {onRowAction && (
                <th className={styles.tableHeader} style={{ width: actionWidth }}>
                  Thao tác
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, index) => (
              <tr key={row.id || index} className={styles.tableRow}>
                {columns.map((column) => (
                  <td key={column.key} className={styles.tableCell} style={{ width: column.width }}>
                    {column.render ? column.render(row[column.key], row) : row[column.key]}
                  </td>
                ))}
                {onRowAction && (
                  <td className={styles.tableCell} style={{ width: actionWidth }}>
                    <button onClick={() => onRowAction(row)} className={styles.actionButton}>
                      {actionButtonText}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataTable;
