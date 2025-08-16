/**
 * API interceptor for consistent authentication and error handling
 */
import { getAuthHeaders, handleAuthResponse, logAuthEvent } from './authUtils';

/**
 * Enhanced fetch wrapper with authentication and logging
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options
 * @param {string} context - Context for logging (e.g., 'user_management', 'case_management')
 * @returns {Promise} Response data
 */
export const authenticatedFetch = async (url, options = {}, context = 'api_call') => {
  const token = localStorage.getItem('token');

  // Log API call attempt
  logAuthEvent('api_request', {
    url,
    method: options.method || 'GET',
    context,
    hasToken: !!token,
  });

  if (!token) {
    logAuthEvent('api_unauthorized', { url, context, reason: 'no_token' });
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại');
  }

  // Merge authentication headers
  const headers = {
    ...getAuthHeaders(token),
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await handleAuthResponse(response, context);

    // Log successful API call
    logAuthEvent('api_success', {
      url,
      method: options.method || 'GET',
      context,
      statusCode: response.status,
    });

    return data;
  } catch (error) {
    // Log API error
    logAuthEvent('api_error', {
      url,
      method: options.method || 'GET',
      context,
      error: error.message,
    });

    throw error;
  }
};

/**
 * GET request with authentication
 * @param {string} url - API endpoint URL
 * @param {string} context - Context for logging
 * @returns {Promise} Response data
 */
export const apiGet = (url, context) => {
  return authenticatedFetch(url, { method: 'GET' }, context);
};

/**
 * POST request with authentication
 * @param {string} url - API endpoint URL
 * @param {Object} data - Request body data
 * @param {string} context - Context for logging
 * @returns {Promise} Response data
 */
export const apiPost = (url, data, context) => {
  return authenticatedFetch(
    url,
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
    context,
  );
};

/**
 * PUT request with authentication
 * @param {string} url - API endpoint URL
 * @param {Object} data - Request body data
 * @param {string} context - Context for logging
 * @returns {Promise} Response data
 */
export const apiPut = (url, data, context) => {
  return authenticatedFetch(
    url,
    {
      method: 'PUT',
      body: JSON.stringify(data),
    },
    context,
  );
};

/**
 * PATCH request with authentication
 * @param {string} url - API endpoint URL
 * @param {Object} data - Request body data
 * @param {string} context - Context for logging
 * @returns {Promise} Response data
 */
export const apiPatch = (url, data, context) => {
  return authenticatedFetch(
    url,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    },
    context,
  );
};

/**
 * DELETE request with authentication
 * @param {string} url - API endpoint URL
 * @param {string} context - Context for logging
 * @returns {Promise} Response data
 */
export const apiDelete = (url, context) => {
  return authenticatedFetch(url, { method: 'DELETE' }, context);
};

/**
 * File upload with authentication
 * @param {string} url - API endpoint URL
 * @param {FormData} formData - Form data with file
 * @param {string} context - Context for logging
 * @returns {Promise} Response data
 */
export const apiUpload = (url, formData, context) => {
  const token = localStorage.getItem('token');

  if (!token) {
    logAuthEvent('api_unauthorized', { url, context, reason: 'no_token' });
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại');
  }

  // For file uploads, don't set Content-Type header (let browser set it with boundary)
  const headers = {
    Authorization: `Bearer ${token}`,
    'User-Agent': navigator.userAgent || 'Unknown Browser',
    'X-Requested-With': 'XMLHttpRequest',
  };

  return authenticatedFetch(
    url,
    {
      method: 'POST',
      headers,
      body: formData,
    },
    context,
  );
};

export default {
  authenticatedFetch,
  apiGet,
  apiPost,
  apiPut,
  apiPatch,
  apiDelete,
  apiUpload,
};
