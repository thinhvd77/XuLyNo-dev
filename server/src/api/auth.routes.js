const express = require('express');
const router = express.Router();
const passport = require('passport');
const authController = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const logger = require('../config/logger');

// URL: POST /api/auth/login
router.post('/login', (req, res, next) => {
  const clientIP =
    req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
    'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';

  logger.info(`Login request received`, {
    ip: clientIP,
    userAgent,
    username: req.body.username || 'not_provided',
    timestamp: new Date().toISOString(),
  });

  passport.authenticate('local', { session: false }, (err, user, info) => {
    // Xử lý các lỗi hệ thống (ví dụ: không kết nối được CSDL)
    if (err) {
      logger.error(`Login system error`, {
        ip: clientIP,
        userAgent,
        username: req.body.username || 'not_provided',
        error: err.message,
        stack: err.stack,
      });
      return next(err);
    }
    // Nếu xác thực thất bại (username sai, password sai)
    // `user` sẽ là `false`, và `info` sẽ chứa message chúng ta đã định nghĩa
    if (!user) {
      logger.warn(`Login authentication failed`, {
        ip: clientIP,
        userAgent,
        username: req.body.username || 'not_provided',
        reason: info.message || 'authentication_failed',
      });
      // Normalize message for security and better UX
      return res.status(401).json({
        success: false,
        message: info.message || 'Tên đăng nhập hoặc mật khẩu không đúng',
      });
    }
    // Nếu xác thực thành công, `user` sẽ chứa thông tin người dùng
    // Gắn user vào request để controller có thể sử dụng
    req.user = user;
    req.clientInfo = { ip: clientIP, userAgent }; // Pass client info to controller
    // Chuyển tiếp đến controller để tạo token như bình thường
    authController.login(req, res);
  })(req, res, next);
});

module.exports = router;
// GET /api/auth/session - return user info and permissions
router.get('/session', protect, authController.getSessionInfo);
