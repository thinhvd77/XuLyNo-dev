/**
 * Utility functions for extracting client information from requests
 */

/**
 * Extract client IP address from request object
 * @param {Object} req - Express request object
 * @returns {string} Client IP address
 */
const getClientIP = (req) => {
  return (
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.connection?.socket?.remoteAddress ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    'unknown'
  );
};

/**
 * Extract user agent from request object
 * @param {Object} req - Express request object
 * @returns {string} User agent string
 */
const getUserAgent = (req) => {
  return req.get('User-Agent') || req.headers['user-agent'] || 'unknown';
};

/**
 * Get comprehensive client information
 * @param {Object} req - Express request object
 * @returns {Object} Object containing IP, user agent, and timestamp
 */
const getClientInfo = (req) => {
  return {
    ip: getClientIP(req),
    userAgent: getUserAgent(req),
    timestamp: new Date().toISOString(),
    url: req.originalUrl || req.url,
    method: req.method,
  };
};

/**
 * Parse user agent to extract browser and OS information
 * @param {string} userAgent - User agent string
 * @returns {Object} Parsed user agent information
 */
const parseUserAgent = (userAgent) => {
  if (!userAgent || userAgent === 'unknown') {
    return { browser: 'unknown', os: 'unknown', device: 'unknown' };
  }

  const result = {
    browser: 'unknown',
    os: 'unknown',
    device: 'unknown',
  };

  // Browser detection
  if (userAgent.includes('Chrome')) {result.browser = 'Chrome';}
  else if (userAgent.includes('Firefox')) {result.browser = 'Firefox';}
  else if (userAgent.includes('Safari')) {result.browser = 'Safari';}
  else if (userAgent.includes('Edge')) {result.browser = 'Edge';}
  else if (userAgent.includes('Opera')) {result.browser = 'Opera';}

  // OS detection
  if (userAgent.includes('Windows')) {result.os = 'Windows';}
  else if (userAgent.includes('Mac OS')) {result.os = 'macOS';}
  else if (userAgent.includes('Linux')) {result.os = 'Linux';}
  else if (userAgent.includes('Android')) {result.os = 'Android';}
  else if (userAgent.includes('iOS')) {result.os = 'iOS';}

  // Device detection
  if (userAgent.includes('Mobile')) {result.device = 'Mobile';}
  else if (userAgent.includes('Tablet')) {result.device = 'Tablet';}
  else {result.device = 'Desktop';}

  return result;
};

module.exports = {
  getClientIP,
  getUserAgent,
  getClientInfo,
  parseUserAgent,
};
