const logger = require('../config/logger');

/**
 * Custom Error Classes for better error handling
 */
class AppError extends Error {
  constructor(message, statusCode, errorCode = null, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND_ERROR');
  }
}

class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', details = null) {
    super(message, 500, 'DATABASE_ERROR', details);
  }
}

class FileOperationError extends AppError {
  constructor(message = 'File operation failed', details = null) {
    super(message, 500, 'FILE_OPERATION_ERROR', details);
  }
}

/**
 * Error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Standardized error logging format
  const errorLog = {
    statusCode: error.statusCode || 500,
    message: error.message,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
    userId: req.user?.employee_code || 'anonymous',
  };

  // Log based on error severity
  if (error.statusCode >= 500) {
    logger.error('Server Error:', errorLog);
  } else if (error.statusCode >= 400) {
    logger.warn('Client Error:', errorLog);
  } else {
    logger.info('Error handled:', errorLog);
  }

  // TypeORM/Database errors
  if (err.name === 'QueryFailedError') {
    const message = 'Database query failed';
    error = new DatabaseError(message, {
      query: err.query,
      parameters: err.parameters,
    });
  }

  // TypeORM Entity not found
  if (err.name === 'EntityNotFound') {
    error = new NotFoundError('Requested resource not found');
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ');
    error = new ValidationError(message, err.errors);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new AuthenticationError('Invalid token');
  }

  if (err.name === 'TokenExpiredError') {
    error = new AuthenticationError('Token expired');
  }

  // Multer errors - Cải thiện thông báo lỗi
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = new ValidationError('File quá lớn. Kích thước tối đa cho phép: 50MB');
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    error = new ValidationError('Quá nhiều file hoặc trường không hợp lệ');
  }

  // PostgreSQL specific errors
  if (err.code === '23505') {
    // Unique constraint violation
    error = new ValidationError('Dữ liệu đã tồn tại trong hệ thống');
  }

  if (err.code === '23503') {
    // Foreign key constraint violation
    error = new ValidationError('Dữ liệu tham chiếu không tồn tại');
  }

  if (err.code === '23502') {
    // Not null constraint violation
    error = new ValidationError('Thiếu thông tin bắt buộc');
  }

  // Security errors
  if (err.message && err.message.includes('[SECURITY]')) {
    error = new ValidationError('Vi phạm chính sách bảo mật', {
      reason: err.message,
    });
  }

  // Xử lý lỗi từ multer file filter
  if (err.message && (
    err.message.includes('Loại file không hợp lệ') ||
    err.message.includes('Phần mở rộng file không hợp lệ') ||
    err.message.includes('Tên file chứa ký tự không hợp lệ') ||
    err.message.includes('Lỗi kiểm tra file Excel')
  )) {
    error = new ValidationError(err.message);
  }

  // Xử lý lỗi từ Excel parsing
  if (err.message && (
    err.message.includes('File không phải là file Excel hợp lệ') ||
    err.message.includes('Không thể đọc file Excel') ||
    err.message.includes('File Excel không chứa sheet nào') ||
    err.message.includes('Sheet đầu tiên trong file Excel bị lỗi') ||
    err.message.includes('File Excel không chứa dữ liệu') ||
    err.message.includes('File Excel trống') ||
    err.message.includes('Sai mẫu file Import')
  )) {
    error = new ValidationError(err.message);
  }

  // Default to 500 server error - nhưng giữ nguyên message gốc nếu có
  if (!error.statusCode) {
    // Nếu có message chi tiết, giữ nguyên
    if (err.message && !err.message.includes('Internal Server Error')) {
      error.statusCode = 400; // Treat as client error if we have a specific message
      error.message = err.message;
    } else {
      error = new AppError('Lỗi hệ thống. Vui lòng thử lại sau.', 500, 'INTERNAL_ERROR');
    }
  }

  // Prepare response
  const response = {
    success: false,
    error: {
      message: error.message,
      code: error.errorCode || 'UNKNOWN_ERROR',
      timestamp: error.timestamp || new Date().toISOString(),
    },
  };

  // Add details in development mode
  if (process.env.NODE_ENV === 'development') {
    response.error.details = error.details;
    response.error.stack = error.stack;
  }

  // Add error details for validation errors
  if (error instanceof ValidationError && error.details) {
    response.error.validation = error.details;
  }

  res.status(error.statusCode).json(response);
};

/**
 * Async error wrapper
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};

/**
 * Unhandled rejection handler
 */
const handleUnhandledRejection = () => {
  process.on('unhandledRejection', (err, promise) => {
    logger.error('Unhandled Promise Rejection:', {
      error: err.message,
      stack: err.stack,
      promise,
    });

    // Close server gracefully
    process.exit(1);
  });
};

/**
 * Uncaught exception handler
 */
const handleUncaughtException = () => {
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', {
      error: err.message,
      stack: err.stack,
    });

    // Close server gracefully
    process.exit(1);
  });
};

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  DatabaseError,
  FileOperationError,
  errorHandler,
  asyncHandler,
  notFoundHandler,
  handleUnhandledRejection,
  handleUncaughtException,
};
