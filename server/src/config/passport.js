const LocalStrategy = require('passport-local').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const bcrypt = require('bcrypt');
const AppDataSource = require('./dataSource');
const { User } = require('../entities/User.entity');
const logger = require('../config/logger');

module.exports = function (passport) {
  // --- Local Strategy (cho việc đăng nhập) ---
  passport.use(
    new LocalStrategy(
      { usernameField: 'username', passReqToCallback: true },
      async (req, username, password, done) => {
        const clientIP =
          req.ip ||
          req.connection.remoteAddress ||
          req.socket.remoteAddress ||
          (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
          'unknown';
        const userAgent = req.get('User-Agent') || 'unknown';

        try {
          logger.info(`Login attempt for username: ${username}`, {
            ip: clientIP,
            userAgent,
            timestamp: new Date().toISOString(),
          });

          const userRepository = AppDataSource.getRepository('User');
          const user = await userRepository.findOneBy({ username });

          if (!user) {
            logger.warn(`Login failed - user not found: ${username}`, {
              ip: clientIP,
              userAgent,
              reason: 'user_not_found',
            });
            return done(null, false, {
              message: 'Tên đăng nhập hoặc mật khẩu không đúng.',
            });
          }

          if (user.status !== 'active') {
            logger.warn(`Login failed - account disabled: ${username} (${user.employee_code})`, {
              ip: clientIP,
              userAgent,
              reason: 'account_disabled',
              status: user.status,
            });
            return done(null, false, {
              message: 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.',
            });
          }

          const isMatch = await bcrypt.compare(password, user.password);
          if (isMatch) {
            logger.info(`Login successful: ${username} (${user.employee_code})`, {
              ip: clientIP,
              userAgent,
              fullname: user.fullname,
              role: user.role,
              branch_code: user.branch_code,
              dept: user.dept,
            });
            return done(null, user);
          } else {
            logger.warn(`Login failed - wrong password: ${username} (${user.employee_code})`, {
              ip: clientIP,
              userAgent,
              reason: 'wrong_password',
            });
            return done(null, false, {
              message: 'Tên đăng nhập hoặc mật khẩu không đúng.',
            });
          }
        } catch (err) {
          logger.error(`Login error for username: ${username}`, {
            ip: clientIP,
            userAgent,
            error: err.message,
            stack: err.stack,
          });
          return done(err);
        }
      },
    ),
  );

  // --- JWT Strategy (để bảo vệ các route) ---
  const opts = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET,
  };

  passport.use(
    new JwtStrategy(opts, async (jwt_payload, done) => {
      try {
        const userRepository = AppDataSource.getRepository('User');
        const user = await userRepository.findOneBy({
          employee_code: jwt_payload.sub,
        });
        if (user) {
          return done(null, user);
        }
        return done(null, false);
      } catch (err) {
        return done(err, false);
      }
    }),
  );
};
