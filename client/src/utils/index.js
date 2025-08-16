/**
 * Centralized utility functions for the application
 * Eliminates code duplication across components
 */

// Browser history management utilities
/**
 * Clear browser history to prevent back navigation to unauthorized pages
 * @param {string} newPath - New path to set as current location
 */
export const clearBrowserHistory = (newPath = '/') => {
  try {
    // Replace current history state to prevent back navigation
    window.history.replaceState(null, '', newPath);

    // Push a new state to ensure the user can't go back to previous pages
    window.history.pushState(null, '', newPath);

    // Replace again to clean up the duplicate entry
    window.history.replaceState(null, '', newPath);

    // Add a listener to prevent back navigation attempts
    const preventBack = (e) => {
      window.history.pushState(null, '', newPath);
    };

    // Temporarily prevent back navigation for a short time
    window.addEventListener('popstate', preventBack);

    // Remove the listener after a short delay to allow normal navigation later
    setTimeout(() => {
      window.removeEventListener('popstate', preventBack);
    }, 1000);
  } catch (error) {
    console.warn('Could not clear browser history:', error);
    // Fallback: just replace current state
    window.history.replaceState(null, '', newPath);
  }
};

/**
 * Get appropriate dashboard route based on user role and department
 * @param {Object} user - User object with role and dept properties
 * @returns {string} Appropriate dashboard route
 */
export const getUserDashboardRoute = (user) => {
  if (!user || !user.role) return '/';

  if (user.role === 'administrator') {
    return '/admin';
  } else if (
    ['director', 'deputy_director'].includes(user.role) ||
    (user.role === 'manager' && user.dept === 'KHDN') ||
    ['KH&QLRR', 'KTGSNB'].includes(user.dept)
  ) {
    return '/director-dashboard';
  } else if (['manager', 'deputy_manager'].includes(user.role)) {
    return '/manager-dashboard';
  } else if (user.role === 'employee') {
    return '/my-cases';
  }

  return '/';
};

// Status management utilities
export const STATUS_MAPPINGS = {
  beingFollowedUp: 'Đang đôn đốc',
  beingSued: 'Đang khởi kiện',
  awaitingJudgmentEffect: 'Chờ hiệu lực án',
  beingExecuted: 'Đang thi hành án',
  proactivelySettled: 'Chủ động XLTS',
  debtSold: 'Bán nợ',
  amcHired: 'Thuê AMC XLN',
};

export const CASE_TYPE_MAPPINGS = {
  internal: 'Nội bảng',
  external: 'Ngoại bảng',
};

/**
 * Convert status code to display name
 * @param {string} status - Status code
 * @returns {string} Display name
 */
export const getStatusDisplayName = (status) => {
  return STATUS_MAPPINGS[status] || status;
};

/**
 * Convert case type to display name
 * @param {string} caseType - Case type code
 * @returns {string} Display name
 */
export const getCaseTypeDisplayName = (caseType) => {
  return CASE_TYPE_MAPPINGS[caseType] || caseType;
};

/**
 * Format currency amount for Vietnamese locale
 * @param {number|string} amount - Amount to format
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount) => {
  const numValue = parseFloat(amount);
  if (isNaN(numValue)) return '0';
  return numValue.toLocaleString('vi-VN');
};

/**
 * Generate status update message for timeline
 * @param {string} oldStatus - Previous status
 * @param {string} newStatus - New status
 * @param {string} userFullname - User's full name
 * @returns {string} Status update message
 */
export const getStatusUpdateMessage = (oldStatus, newStatus, userFullname) => {
  const oldStatusName = getStatusDisplayName(oldStatus);
  const newStatusName = getStatusDisplayName(newStatus);
  return `${userFullname} đã cập nhật trạng thái từ "${oldStatusName}" thành "${newStatusName}"`;
};

/**
 * Format date for Vietnamese locale
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
export const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('vi-VN');
};

/**
 * Format datetime for Vietnamese locale
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted datetime string
 */
export const formatDateTime = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleString('vi-VN');
};

/**
 * Validate if user has permission for action
 * @param {string} userRole - User's role
 * @param {string[]} allowedRoles - Array of allowed roles
 * @returns {boolean} Permission status
 */
export const hasPermission = (userRole, allowedRoles) => {
  return allowedRoles.includes(userRole);
};

/**
 * Generate safe filename from string - preserves Vietnamese characters
 * @param {string} filename - Original filename
 * @returns {string} Safe filename
 */
export const sanitizeFilename = (filename) => {
  if (!filename) return 'untitled';

  // Only remove truly dangerous characters, preserve Vietnamese completely
  // Only remove: null bytes, path separators, and control characters
  return filename.replace(/[\0<>:"/\\|?*]/g, '_').trim();
};

/**
 * Debounce function for search inputs
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};

/**
 * Get file extension from filename or mimetype
 * @param {string} filename - Filename
 * @param {string} mimetype - MIME type
 * @returns {string} File extension
 */
export const getFileExtension = (filename, mimetype) => {
  if (filename && filename.includes('.')) {
    return filename.split('.').pop().toLowerCase();
  }

  const mimeExtensions = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  };

  return mimeExtensions[mimetype] || 'file';
};
