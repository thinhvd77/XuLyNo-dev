require('dotenv').config();
require('reflect-metadata');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const passport = require('passport');
const apiRoutes = require('./api');
const {
  errorHandler,
  notFoundHandler,
  handleUnhandledRejection,
  handleUncaughtException,
} = require('./middleware/errorHandler');

// Khởi tạo các trình xử lý lỗi toàn cục
handleUnhandledRejection();
handleUncaughtException();

// Khởi tạo server
const app = express();

// Tin tưởng proxy để phát hiện IP chính xác khi deploy sau Nginx
app.set('trust proxy', 1);

// --- TỐI ƯU HÓA CẤU HÌNH CORS ---
// Gộp toàn bộ logic CORS vào một nơi duy nhất.
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : ['http://localhost', 'http://127.0.0.1:5173'];

const corsOptions = {
  origin: (origin, callback) => {
    // Cho phép các request không có origin (ví dụ: Postman) và các origin trong danh sách
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Disposition', 'Content-Type', 'Content-Length'],
};

// Sử dụng CORS cho tất cả các route, bao gồm cả các request OPTIONS (preflight)
app.use(cors(corsOptions));
// --- KẾT THÚC TỐI ƯU HÓA CORS ---

// --- TỐI ƯU HÓA HELMET VÀ CACHE ---
app.use(helmet()); // Sử dụng các cài đặt mặc định an toàn của Helmet

// Middleware để vô hiệu hóa cache cho tất cả các phản hồi API
// Điều này rất quan trọng để đảm bảo dữ liệu luôn mới
app.use('/api/', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});
// --- KẾT THÚC TỐI ƯU HÓA HELMET VÀ CACHE ---

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cấu hình Passport
app.use(passport.initialize());
require('./config/passport')(passport);

// Routes
app.use('/api', apiRoutes);

// Route gốc để health check
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to Debt Collection API!',
    timestamp: new Date().toISOString(),
  });
});

// Middleware xử lý lỗi (phải nằm sau tất cả các routes)
app.use(notFoundHandler);
app.use(errorHandler);

// Xuất app để server.js sử dụng
module.exports = app;
