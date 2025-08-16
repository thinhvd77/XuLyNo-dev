// ecosystem.config.js

module.exports = {
  apps: [
    {
      name: 'XyLyNo-API', // Tên ứng dụng của bạn trong PM2
      script: 'src/server.js', // Đường dẫn đến tệp khởi động
      instances: 5, // Chạy 5 instance. Tăng lên 'max' để tận dụng tất cả CPU
      autorestart: true, // Tự động khởi động lại khi có lỗi
      watch: false, // Tắt watch mode trong production
      max_memory_restart: '8G', // Khởi động lại nếu dùng quá 8GB RAM

      // --- BIẾN MÔI TRƯỜNG CHO PRODUCTION ---
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0', // Lắng nghe trên tất cả các địa chỉ IP của server

        // Cho phép frontend từ IP 10.190.0.17 và localhost (để dự phòng) truy cập
        CORS_ORIGIN: 'http://10.190.0.17,http://localhost',

        // Cấu hình Database trên máy chủ
        DB_HOST: 'localhost', // Hoặc IP của DB server nếu khác
        DB_PORT: 5433,
        DB_USERNAME: 'postgres', // <-- THAY BẰNG USERNAME DB
        DB_PASSWORD: 'Dientoan@6421', // <-- THAY BẰNG MẬT KHẨU DB
        DB_DATABASE: 'xulyno_db', // <-- THAY BẰNG TÊN DATABASE

        // Cấu hình mã bí mật JWT
        JWT_SECRET: 'day-la-ma-bi-mat-cuc-ky-an-toan-cho-production-123456', // <-- THAY BẰNG MÃ BÍ MẬT CỦA BẠN
        JWT_EXPIRES_IN: '1d',

        // Đường dẫn an toàn để lưu file trên server
        // Ví dụ: /home/your_user/xulyno-uploads
        SAFE_BASE_DIR: 'E:/FilesXuLyNo/',

        // Phân quyền xuất báo cáo
        // Vai trò được phép xuất báo cáo (phân tách bởi dấu phẩy)
        REPORT_EXPORT_ALLOWED_ROLES: 'manager,director,administrator',
        // Danh sách mã nhân viên được whitelisted để xuất báo cáo (tùy chọn)
        // Ví dụ: '99999999,64210001,64210002'
        REPORT_EXPORT_ALLOWED_EMPLOYEES: '',
      },
    },
  ],
};
