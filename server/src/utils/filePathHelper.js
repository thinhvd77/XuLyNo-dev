const path = require('path');

/**
 * Helper functions để xử lý file paths cho hệ thống upload mới
 * SECURITY: Bảo vệ chống path traversal attacks
 */

// Base directory an toàn cho file operations - sử dụng environment variable
const SAFE_BASE_DIR = path.resolve(process.env.SAFE_BASE_DIR || 'D:/FilesXuLyNo/');

/**
 * Validate và sanitize file path để ngăn chặn path traversal
 * @param {string} inputPath - Đường dẫn đầu vào cần validate
 * @param {boolean} allowAbsolute - Cho phép đường dẫn tuyệt đối (dành cho temp files)
 * @returns {string|null} - Đường dẫn an toàn hoặc null nếu không hợp lệ
 */
const validateAndSanitizePath = (inputPath, allowAbsolute = false) => {
  if (!inputPath || typeof inputPath !== 'string') {
    return null;
  }

  // Loại bỏ null bytes
  const sanitized = inputPath.replace(/\0/g, '').trim();

  // Check for dangerous path traversal patterns first
  const pathTraversalPatterns = [
    /\.\.\//, // Parent directory traversal (Unix)
    /\.\.\\/, // Parent directory traversal (Windows)
    /\.\.$/, // Ending with ..
  ];

  for (const pattern of pathTraversalPatterns) {
    if (pattern.test(sanitized)) {
      logger.warn(`[SECURITY] Rejected dangerous path pattern: ${sanitized}`);
      return null;
    }
  }

  // For absolute paths (temp files), validate Windows drive letter format
  if (allowAbsolute) {
    const isValidWindowsPath = /^[A-Za-z]:[\\\/]/.test(sanitized);
    const isValidUnixPath = /^\//.test(sanitized);

    if (isValidWindowsPath || isValidUnixPath) {
      // Additional check: ensure no dangerous characters except drive colon
      if (/[<>"|?*]/.test(sanitized.replace(/^[A-Za-z]:/, ''))) {
        logger.warn(`[SECURITY] Rejected path with dangerous characters: ${sanitized}`);
        return null;
      }
      return sanitized;
    }
  }

  // For relative paths, only reject characters that are invalid in filenames,
  // but allow path separators. This preserves the directory structure.
  if (/[<>"|?*]/.test(sanitized)) {
          logger.warn(`[SECURITY] Rejected relative path with dangerous characters: ${sanitized}`);
    return null;
  }

  return sanitized;
};

/**
 * Securely resolve path and ensure it's within safe base directory
 * @param {string} relativePath - Relative path to resolve
 * @returns {string|null} - Absolute path if safe, null otherwise
 */
const securePathResolve = (relativePath) => {
  // For joined paths, we need different validation than individual segments
  // Skip validateAndSanitizePath for already-joined paths since path.join() creates valid separators
  if (!relativePath || typeof relativePath !== 'string') {
    return null;
  }

  // Normalize the path to handle different separator types
  const normalizedPath = path.normalize(relativePath);

  // Check for path traversal attempts in the normalized path
  if (normalizedPath.includes('..')) {
    console.warn(`[SECURITY] Path traversal attempt detected: ${relativePath}`);
    return null;
  }

  try {
    // Resolve the absolute path
    const resolvedPath = path.resolve(SAFE_BASE_DIR, normalizedPath);

    // Ensure the resolved path is still within our safe base directory
    if (!resolvedPath.startsWith(SAFE_BASE_DIR)) {
      console.warn(`[SECURITY] Path traversal attempt blocked: ${relativePath} -> ${resolvedPath}`);
      return null;
    }

    return resolvedPath;
  } catch (error) {
    console.error(`[SECURITY] Path resolution error: ${error.message}`);
    return null;
  }
};

// Helper function để tạo đường dẫn tương đối từ root project (DEPRECATED - use securePathResolve)
const getRelativeFilePath = (fullPath) => {
  if (!fullPath || typeof fullPath !== 'string') {
    return null;
  }

  try {
    // Ensure the path is within our safe directory
    const normalizedPath = path.normalize(fullPath);
    if (!normalizedPath.startsWith(SAFE_BASE_DIR)) {
      console.warn(`[SECURITY] Attempted to get relative path outside safe directory: ${fullPath}`);
      return null;
    }

    return path.relative(SAFE_BASE_DIR, normalizedPath);
  } catch (error) {
    console.error(`[SECURITY] Error getting relative path: ${error.message}`);
    return null;
  }
};

// Helper function để tạo absolute path từ relative path (SECURE VERSION)
const getAbsoluteFilePath = (relativePath) => {
  return securePathResolve(relativePath);
};

// Helper function để tạo web-accessible URL cho file
const getFileWebPath = (relativePath) => {
  const sanitized = validateAndSanitizePath(relativePath);
  if (!sanitized) {
    return null;
  }

  // Chuyển đổi path separators cho web
  return sanitized.replace(/\\/g, '/');
};

// Helper function để extract thông tin từ file path
const extractFilePathInfo = (filePath) => {
  const sanitized = validateAndSanitizePath(filePath);
  if (!sanitized) {
    return null;
  }

  const parts = sanitized.split(path.sep);

  // Assuming structure: CBTD Name/Customer Code/Case Type/Doc Type/filename
  if (parts.length >= 5) {
    return {
      cbtdName: parts[0],
      customerCode: parts[1],
      caseType: parts[2],
      documentType: parts[3],
      fileName: parts[parts.length - 1],
    };
  }

  return null;
};

// Helper function để tạo breadcrumb cho file path
const getFilePathBreadcrumb = (filePath) => {
  const info = extractFilePathInfo(filePath);
  if (!info) {return null;}

  return [
    'Files Xử Lý Nợ',
    info.cbtdName,
    info.customerCode,
    info.caseType,
    info.documentType,
  ].filter(Boolean);
};

/**
 * Safely create directory path within base directory
 * @param {Array} pathSegments - Array of path segments to join
 * @returns {string|null} - Safe directory path or null if invalid
 */
const createSafeDirectoryPath = (pathSegments) => {
  if (!Array.isArray(pathSegments) || pathSegments.length === 0) {
    return null;
  }

  // Sanitize each segment - only remove truly dangerous characters, preserve Vietnamese
  const sanitizedSegments = pathSegments
    .map((segment) => {
      if (!segment || typeof segment !== 'string') {
        return null;
      }
      // Only remove characters that are actually dangerous for file systems
      // Preserve Vietnamese characters and spaces
      return segment.replace(/[<>:"|?*\0]/g, '_').trim();
    })
    .filter(Boolean);

  if (sanitizedSegments.length !== pathSegments.length) {
    console.warn(`[SECURITY] Some path segments were rejected during sanitization`);
    return null;
  }

  const relativePath = path.join(...sanitizedSegments);
  return securePathResolve(relativePath);
};

module.exports = {
  getRelativeFilePath,
  getAbsoluteFilePath,
  getFileWebPath,
  extractFilePathInfo,
  getFilePathBreadcrumb,
  validateAndSanitizePath,
  securePathResolve,
  createSafeDirectoryPath,
  SAFE_BASE_DIR,
};
