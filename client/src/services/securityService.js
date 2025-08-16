/**
 * Security Service - Client-side security monitoring và protection
 */
import { jwtDecode } from 'jwt-decode';
import API_BASE_URL from '../config/api';
import { devLog, devWarn, devError } from '../utils/logger';

class SecurityService {
  constructor() {
    this.securityEvents = [];
    this.isInitialized = false;
  }

  /**
   * Initialize security monitoring - call this after app is fully loaded
   */
  initializeSecurityMonitoring() {
    if (this.isInitialized) return;

    // Add a small delay to ensure all dependencies are loaded
    setTimeout(() => {
      // Monitor back button attempts
      this.monitorBackButtonAttempts();

      // Monitor tab switching
      this.monitorTabSwitching();

      // Monitor token tampering
      this.monitorTokenChanges();

      // Monitor unauthorized navigation attempts
      this.monitorUnauthorizedNavigation();

      this.isInitialized = true;
      devLog('🔒 Security monitoring initialized');
    }, 1000);
  }

  /**
   * Monitor back button attempts to prevent unauthorized access
   * NOTE: Disabled - handled by AuthGuard component instead
   */
  monitorBackButtonAttempts() {
    // Disabled to prevent conflicts with AuthGuard popstate handling
    // AuthGuard now handles all back button security
    devLog('💡 Back button monitoring handled by AuthGuard component');

    // Keep minimal logging for debugging
    /* 
        let backButtonAttempts = 0;
        
        window.addEventListener('popstate', (event) => {
            const token = localStorage.getItem('token');
            if (!token) {
                // No token - legitimate back navigation to login
                return;
            }

            backButtonAttempts++;
            
            if (backButtonAttempts > 3) {
                this.logSecurityEvent('EXCESSIVE_BACK_BUTTON_ATTEMPTS', {
                    attempts: backButtonAttempts,
                    currentPath: window.location.pathname,
                    timestamp: new Date().toISOString()
                });
                
                // Force logout after excessive attempts
                this.forceLogout('Phát hiện hoạt động bất thường. Vui lòng đăng nhập lại.');
            }
        });
        */
  }

  /**
   * Monitor tab switching to detect potential session sharing
   */
  monitorTabSwitching() {
    let tabSwitchCount = 0;
    let lastActiveTime = Date.now();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        lastActiveTime = Date.now();
      } else {
        const inactiveTime = Date.now() - lastActiveTime;
        if (inactiveTime > 30000) {
          // 30 seconds
          tabSwitchCount++;

          if (tabSwitchCount > 10) {
            this.logSecurityEvent('EXCESSIVE_TAB_SWITCHING', {
              count: tabSwitchCount,
              inactiveTime: inactiveTime,
              timestamp: new Date().toISOString(),
            });
          }
        }
      }
    });
  }

  /**
   * Monitor localStorage changes to detect token tampering
   */
  monitorTokenChanges() {
    let originalToken = localStorage.getItem('token');
    let isFirstCheck = true;

    // Check for token changes every 10 seconds (increased interval)
    setInterval(() => {
      const currentToken = localStorage.getItem('token');

      // Skip first check to allow login process to complete
      if (isFirstCheck) {
        originalToken = currentToken;
        isFirstCheck = false;
        return;
      }

      if (originalToken && !currentToken) {
        // Token was removed - legitimate logout
        originalToken = null;
        return;
      }

      if (currentToken && currentToken !== originalToken && originalToken !== null) {
        // Only trigger if both tokens are valid JWT tokens
        try {
          if (originalToken) {
            jwtDecode(originalToken);
          }
          if (currentToken) {
            jwtDecode(currentToken);
          }

          this.logSecurityEvent('TOKEN_TAMPERING_DETECTED', {
            originalTokenExists: !!originalToken,
            newTokenExists: !!currentToken,
            timestamp: new Date().toISOString(),
          });

          // Force logout due to token tampering
          this.forceLogout('Phát hiện thay đổi bất thường trong phiên đăng nhập.');
        } catch (error) {
          // Invalid token format - this is expected during login process
          devLog('Token validation during transition - ignoring');
        }
      }

      originalToken = currentToken;
    }, 15000); // Increased from 10000 to 15000
  }

  /**
   * Monitor unauthorized navigation attempts
   */
  monitorUnauthorizedNavigation() {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      SecurityService.getInstance().checkNavigationSecurity(args[2]);
      return originalPushState.apply(history, args);
    };

    history.replaceState = function (...args) {
      SecurityService.getInstance().checkNavigationSecurity(args[2]);
      return originalReplaceState.apply(history, args);
    };
  }

  /**
   * Check navigation security
   */
  checkNavigationSecurity(url) {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const decoded = jwtDecode(token);
      const currentTime = Date.now() / 1000;

      if (decoded.exp <= currentTime) {
        this.forceLogout('Phiên đăng nhập đã hết hạn.');
        return;
      }

      // Log suspicious navigation patterns
      if (url && (url.includes('admin') || url.includes('director') || url.includes('manager'))) {
        this.logSecurityEvent('SUSPICIOUS_NAVIGATION_ATTEMPT', {
          attemptedUrl: url,
          userRole: decoded.role,
          userDept: decoded.dept,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      // Only force logout if token is definitely expired or malformed
      // During login process, temporary token states are normal
      try {
        const decoded = jwtDecode(token);
        if (decoded.exp <= Date.now() / 1000) {
          this.forceLogout('Token đã hết hạn.');
        }
      } catch (decodeError) {
        // Token format invalid - only logout if we're not in login process
        if (!window.location.pathname.includes('/login')) {
          devWarn('Invalid token format detected outside login process');
          this.forceLogout('Token không hợp lệ.');
        }
      }
    }
  }

  /**
   * Log security events
   */
  logSecurityEvent(eventType, details) {
    const event = {
      type: eventType,
      details: details,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    this.securityEvents.push(event);

    // Keep only last 100 events
    if (this.securityEvents.length > 100) {
      this.securityEvents = this.securityEvents.slice(-100);
    }

    // Log to console for debugging (dev only)
    devWarn('🚨 SECURITY EVENT:', event);

    // Server logging disabled - endpoint not available
    // this.sendSecurityEventToServer(event);
  }

  /**
   * Send security event to server for logging
   */
  async sendSecurityEventToServer(event) {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      await fetch(`${API_BASE_URL}/api/security/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(event),
      });
    } catch (error) {
      // Silent fail - không làm gián đoạn UX
      devError('Failed to send security event to server:', error);
    }
  }

  /**
   * Force logout with security reasons
   */
  forceLogout(reason) {
    devError('🚨 SECURITY LOGOUT:', reason);

    // Clear all storage
    localStorage.clear();
    sessionStorage.clear();

    // Clear browser cache
    if (window.history.replaceState) {
      window.history.replaceState(null, null, '/login');
    }

    // Clear all cached pages
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => {
          caches.delete(name);
        });
      });
    }

    // Show reason and redirect
    if (window.toast) {
      window.toast.error(reason);
    } else {
      alert(reason);
    }

    // Force redirect
    window.location.replace('/login');
  }

  /**
   * Clear all cached data
   */
  clearAllCache() {
    // Clear localStorage except for essential settings
    const essentialKeys = ['theme', 'language']; // Add any keys you want to preserve
    const keysToRemove = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!essentialKeys.includes(key)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));

    // Clear sessionStorage completely
    sessionStorage.clear();

    // Clear browser cache
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => {
          caches.delete(name);
        });
      });
    }
  }

  /**
   * Get security events (for debugging)
   */
  getSecurityEvents() {
    return this.securityEvents;
  }

  /**
   * Singleton pattern
   */
  static getInstance() {
    if (!SecurityService.instance) {
      SecurityService.instance = new SecurityService();
    }
    return SecurityService.instance;
  }
}

// Auto-initialize when imported
const securityService = SecurityService.getInstance();

export default securityService;
