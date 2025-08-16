const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint(),
);

// Simple, readable console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;

    // Only show meta data in development for better readability
    if (process.env.NODE_ENV === 'development' && Object.keys(meta).length > 0) {
      log += '\n' + JSON.stringify(meta, null, 2);
    }
    return log;
  }),
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'xulyno-backend' },
  transports: [
    // Error logs
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize:
        parseInt(process.env.LOG_MAX_SIZE?.replace('m', '')) * 1024 * 1024 || 20 * 1024 * 1024, // Default 20MB
      maxFiles: process.env.LOG_MAX_FILES || '14d',
    }),
    // Combined logs
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize:
        parseInt(process.env.LOG_MAX_SIZE?.replace('m', '')) * 1024 * 1024 || 20 * 1024 * 1024, // Default 20MB
      maxFiles: process.env.LOG_MAX_FILES || '14d',
    }),
    // Database logs
    new winston.transports.File({
      filename: path.join(logsDir, 'database.log'),
      level: 'debug',
      maxsize: 5242880, // 5MB
      maxFiles: 3,
    }),
  ],
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    }),
  );
}

// Create specialized loggers for different components
const createChildLogger = (module) => {
  return logger.child({ module });
};

module.exports = {
  logger,
  createChildLogger,
  // Convenience methods for different log levels
  info: (message, meta = {}) => logger.info(message, meta),
  error: (message, meta = {}) => logger.error(message, meta),
  warn: (message, meta = {}) => logger.warn(message, meta),
  debug: (message, meta = {}) => logger.debug(message, meta),
  verbose: (message, meta = {}) => logger.verbose(message, meta),
};
