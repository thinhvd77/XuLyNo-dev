/**
 * Client-side authentication utilities and logging
 */

/**
 * Get client information for logging
 * @returns {Object} Client information object
 */
export const getClientInfo = () => {
  return {
    userAgent: navigator.userAgent || 'unknown',
    platform: navigator.platform || 'unknown',
    language: navigator.language || 'unknown',
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    timestamp: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
    screen: {
      width: window.screen?.width || 'unknown',
      height: window.screen?.height || 'unknown',
      colorDepth: window.screen?.colorDepth || 'unknown',
    },
    viewport: {
      width: window.innerWidth || 'unknown',
      height: window.innerHeight || 'unknown',
    },
  };
};

/**
 * Log authentication events consistently
 * @param {string} event - Event type (login_attempt, login_success, login_failure, logout, session_expired)
 * @param {Object} details - Additional details for the event
 */
export const logAuthEvent = (event, details = {}) => {
  const logData = {
    event,
    ...details,
    client: getClientInfo(),
    url: window.location.href,
    referrer: document.referrer || 'direct',
  };

  // Console logging for development
  if (
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env.MODE === 'development'
  ) {
    // Removed console.log for production
  }

  // In production, you might want to send this to an analytics service
  // Example: sendToAnalytics(logData);

  return logData;
};

/**
 * Enhanced error message mapping for Vietnamese localization
 * @param {string} error - Error message from server
 * @param {number} statusCode - HTTP status code
 * @returns {string} User-friendly Vietnamese error message
 */
export const mapAuthError = (error, statusCode) => {
  // Server-specific error messages
  if (error?.includes('không tồn tại')) {
    return 'Tên đăng nhập không tồn tại trong hệ thống';
  }

  if (error?.includes('không chính xác') || error?.includes('sai')) {
    return 'Mật khẩu không chính xác';
  }

  if (error?.includes('vô hiệu hóa') || error?.includes('disabled')) {
    return 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên';
  }

  if (error?.includes('expired') || error?.includes('hết hạn')) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại';
  }

  if (error?.includes('invalid') || error?.includes('không hợp lệ')) {
    return 'Thông tin đăng nhập không hợp lệ';
  }

  // HTTP status code based errors
  switch (statusCode) {
    case 400:
      return 'Dữ liệu đăng nhập không hợp lệ';
    case 401:
      return 'Tên đăng nhập hoặc mật khẩu không đúng';
    case 403:
      return 'Tài khoản không có quyền truy cập';
    case 404:
      return 'Không tìm thấy dịch vụ đăng nhập';
    case 429:
      return 'Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau';
    case 500:
      return 'Lỗi máy chủ nội bộ. Vui lòng thử lại sau';
    case 502:
      return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau';
    case 503:
      return 'Hệ thống đang bảo trì. Vui lòng thử lại sau';
    case 504:
      return 'Kết nối tới máy chủ quá chậm. Vui lòng thử lại';
    default:
      if (error) {
        return error;
      }
      return 'Đã xảy ra lỗi không xác định. Vui lòng thử lại';
  }
};

/**
 * Check if network error and provide appropriate message
 * @param {Error} error - JavaScript error object
 * @returns {string} Network error message in Vietnamese
 */
export const getNetworkErrorMessage = (error) => {
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return 'Không thể kết nối tới máy chủ. Vui lòng kiểm tra kết nối mạng';
  }

  if (error.message?.includes('NetworkError') || error.message?.includes('network')) {
    return 'Lỗi kết nối mạng. Vui lòng kiểm tra kết nối internet';
  }

  if (error.message?.includes('timeout')) {
    return 'Kết nối quá chậm. Vui lòng thử lại';
  }

  if (error.message?.includes('CORS')) {
    return 'Lỗi bảo mật kết nối. Vui lòng liên hệ quản trị viên';
  }

  return null; // Not a network error
};

/**
 * Validate user session and handle token expiration
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded user object or null if invalid
 */
export const validateSession = (token) => {
  if (!token) {
    logAuthEvent('session_validation_failed', { reason: 'no_token' });
    return null;
  }

  try {
    // Simple JWT payload extraction (without verification)
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join(''),
    );

    const decoded = JSON.parse(jsonPayload);

    if (decoded.exp * 1000 < Date.now()) {
      logAuthEvent('session_expired', {
        username: decoded.username || 'unknown',
        employeeCode: decoded.sub || 'unknown',
        expiredAt: new Date(decoded.exp * 1000).toISOString(),
      });
      return null;
    }

    logAuthEvent('session_validated', {
      username: decoded.username || 'unknown',
      employeeCode: decoded.sub || 'unknown',
      role: decoded.role || 'unknown',
    });

    return decoded;
  } catch (error) {
    logAuthEvent('session_validation_failed', {
      reason: 'invalid_token',
      error: error.message,
    });
    return null;
  }
};

/**
 * Security headers for authenticated requests
 * @param {string} token - JWT token
 * @returns {Object} Headers object for fetch requests
 */
export const getAuthHeaders = (token) => {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'User-Agent': navigator.userAgent || 'Unknown Browser',
    'X-Requested-With': 'XMLHttpRequest',
  };
};

/**
 * Handle authentication-related HTTP responses
 * @param {Response} response - Fetch response object
 * @param {string} context - Context of the request (login, api_call, etc.)
 * @returns {Promise} Response data or throws error
 */
export const handleAuthResponse = async (response, context = 'unknown') => {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = mapAuthError(data.message, response.status);

    logAuthEvent('auth_error', {
      context,
      statusCode: response.status,
      error: data.message || 'unknown error',
      mappedError: error,
    });

    // Handle specific auth errors
    if (response.status === 401) {
      // For login flow: surface error to form instead of redirecting
      if (context === 'login') {
        throw new Error(error);
      }
      // Token expired or invalid during authenticated flow - redirect to login
      localStorage.removeItem('token');
      window.location.replace('/login');
      return;
    }

    throw new Error(error);
  }

  return data;
};

export default {
  getClientInfo,
  logAuthEvent,
  mapAuthError,
  getNetworkErrorMessage,
  validateSession,
  getAuthHeaders,
  handleAuthResponse,
};
