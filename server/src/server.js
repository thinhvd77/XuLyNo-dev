require('dotenv').config();
const app = require('./app');
const AppDataSource = require('./config/dataSource');
const bcrypt = require('bcrypt');
const http = require('http');
const { Server } = require('socket.io');
const logger = require('./config/logger');

// Import delegation job
const { startDelegationJob } = require('./jobs/delegation.job');

const PORT = process.env.PORT || 3000;

// Create HTTP server and Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',')
      : [
          'http://localhost',
          'http://localhost:3000',
          'http://127.0.0.1:5173',
          'http://10.190.0.17',
        ],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Make io available globally for services
global.io = io;

// Socket.IO authentication and connection handling
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }

  // Verify JWT token
  const jwt = require('jsonwebtoken');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
      logger.info(`User connected: ${socket.user.employee_code} (${socket.user.role})`);

  // Join user to personal room for targeted notifications
  socket.join(`user_${socket.user.employee_code}`);

  socket.on('disconnect', () => {
    logger.info(`User disconnected: ${socket.user.employee_code}`);
  });
});

// Kết nối CSDL và khởi động server
AppDataSource.initialize()
  .then(async () => {
    logger.info('Database connection successful!');

    const officerRepository = AppDataSource.getRepository('User');

    let admin = await officerRepository.findOneBy({
      username: 'admin',
    });
    if (!admin) {
      logger.info('Creating Administrator...');
      const adminData = {
        employee_code: '99999999',
        username: 'admin',
        fullname: 'Administrator',
        dept: 'IT',
        branch_code: '6421',
        role: 'administrator',
        password: await bcrypt.hash('Admin@6421', 10),
      };
      admin = officerRepository.create(adminData);
      await officerRepository.save(admin);
              logger.info('Administrator created successfully!');
    }

    // Start delegation expiration job
    startDelegationJob();
    logger.info('Delegation expiration job started!');

    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Server running at:`);
      logger.info(`   - Localhost: http://localhost:${PORT}`);
      logger.info(`   - Network: http://[your-ip]:${PORT}`);
      logger.info(`   - API Health: http://localhost:${PORT}/api`);
      logger.info(`📡 WebSocket ready for real-time notifications`);
    });
  })
  .catch((error) => {
    logger.error('Database connection error: ', error);
    process.exit(1);
  });
