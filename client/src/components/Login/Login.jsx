import { useState } from 'react';
import styles from './Login.module.css';
import logo from '../../assets/logo.jpg';
import { API_ENDPOINTS } from '../../config/api';
import { useAuth } from '../../hooks/useAuth';
import {
  logAuthEvent,
  mapAuthError,
  getNetworkErrorMessage,
  handleAuthResponse,
} from '../../utils/authUtils';
import toast from 'react-hot-toast';

const EyeIcon = () => (
  <svg
    className={styles['eye-icon']}
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    fill="currentColor"
    viewBox="0 0 16 16"
  >
    <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0" />
    <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8m8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7" />
  </svg>
);
const EyeSlashIcon = () => (
  <svg
    className={styles['eye-slash-icon']}
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    fill="currentColor"
    viewBox="0 0 16 16"
  >
    <path d="m10.79 12.912-1.614-1.615a3.5 3.5 0 0 1-4.474-4.474l-2.06-2.06C.938 6.278 0 8 0 8s3 5.5 8 5.5a7.029 7.029 0 0 0 2.79-.588M5.21 3.088A7.028 7.028 0 0 1 8 2.5c5 0 8 5.5 8 5.5s-.939 1.721-2.641 3.238l-2.062-2.062a3.5 3.5 0 0 0-4.474-4.474L5.21 3.089z" />
    <path d="M5.525 7.646a2.5 2.5 0 0 0 2.829 2.829l-2.83-2.829zm4.95.708-2.829-2.83a2.5 2.5 0 0 1 2.829 2.829zm3.171 6-12-12 .708-.708 12 12z" />
  </svg>
);

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    // Log login attempt
    logAuthEvent('login_attempt', { username });

    try {
      const response = await fetch(API_ENDPOINTS.AUTH.LOGIN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': navigator.userAgent || 'Unknown Browser',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await handleAuthResponse(response, 'login');

      // Log successful login attempt
      logAuthEvent('login_success', { username });

      await login(data.access_token);
    } catch (err) {
      // Log failed login attempt
      logAuthEvent('login_failure', {
        username,
        error: err.message,
        errorType: err.name,
      });

      // Handle network errors
      const networkError = getNetworkErrorMessage(err);
      if (networkError) {
        setError(networkError);
      } else {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.loginPageWrapper}>
      <div className={styles.loginContainer}>
        <img src={logo} alt="Logo Ngân hàng Agribank" className={styles.logo} />
        <h1>HỆ THỐNG THEO DÕI XỬ LÝ NỢ</h1>
        <form onSubmit={handleSubmit} noValidate>
          <div className={styles.formGroup}>
            <label htmlFor="username">Tên đăng nhập</label>
            <input
              type="text"
              id="username"
              className={styles.formControl}
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="password">Mật khẩu</label>
            <div className={styles.passwordWrapper}>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                className={styles.formControl}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>
          <button type="submit" className={styles.loginButton} disabled={isLoading}>
            {isLoading ? 'Đang xử lý...' : 'Đăng nhập'}
          </button>
          {error && (
            <div className={styles.errorMessage} role="alert">
              {error}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default Login;
