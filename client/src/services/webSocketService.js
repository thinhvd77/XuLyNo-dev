/**
 * WebSocket Service for real-time notifications
 */
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { devLog, devWarn, devError } from '../utils/logger';
import API_BASE_URL from '../config/api';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.eventListeners = {}; // Store event listeners for components
  }

  /**
   * Add event listener for component events
   */
  on(eventName, callback) {
    if (!this.eventListeners[eventName]) {
      this.eventListeners[eventName] = [];
    }
    this.eventListeners[eventName].push(callback);
  }

  /**
   * Remove event listener for component events
   */
  off(eventName, callback) {
    if (this.eventListeners[eventName]) {
      this.eventListeners[eventName] = this.eventListeners[eventName].filter(
        (cb) => cb !== callback,
      );
    }
  }

  /**
   * Emit event to all registered listeners
   */
  emit(eventName, data) {
    if (this.eventListeners[eventName]) {
      this.eventListeners[eventName].forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          devError(`Error in event listener for ${eventName}:`, error);
        }
      });
    }
  }

  /**
   * Initialize WebSocket connection
   */
  connect() {
    const token = localStorage.getItem('token');
    if (!token) {
      devWarn('No token found, cannot connect to WebSocket');
      return;
    }

    const serverUrl = API_BASE_URL;

    this.socket = io(serverUrl, {
      auth: {
        token: token,
      },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    this.setupEventListeners();
  }

  /**
   * Setup event listeners for WebSocket
   */
  setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      devLog('✅ WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;

      // Show connection toast only on reconnection
      if (this.reconnectAttempts > 0) {
        toast.success('Kết nối realtime đã được khôi phục', {
          id: 'websocket-reconnect',
        });
      }
    });

    this.socket.on('disconnect', (reason) => {
      devLog('❌ WebSocket disconnected:', reason);
      this.isConnected = false;

      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        this.socket.connect();
      }
    });

    this.socket.on('connect_error', (error) => {
      devError('WebSocket connection error:', error);
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        toast.error('Mất kết nối realtime. Vui lòng tải lại trang.', {
          id: 'websocket-error',
          duration: 10000,
        });
      }
    });

    // Handle delegation expiry notifications
    this.socket.on('notification', (notification) => {
      this.handleNotification(notification);
    });
  }

  /**
   * Handle incoming notifications
   */
  handleNotification(notification) {
    devLog('📡 Received notification:', notification);

    switch (notification.type) {
      case 'DELEGATION_EXPIRED':
        this.handleDelegationExpired(notification);
        break;
      default:
        devLog('Unknown notification type:', notification.type);
    }
  }

  /**
   * Handle delegation expiry notification
   */
  handleDelegationExpired(notification) {
    const { data, action } = notification;

    // Emit event to components that are listening
    this.emit('delegation-expired', {
      caseId: data.caseId,
      expiredCaseCount: data.expiredCaseCount,
      notification: notification,
    });

    // Show notification toast with HTML content
    toast(
      (t) => {
        // Create DOM elements programmatically
        const container = document.createElement('div');
        container.className = 'delegation-expired-toast';

        const header = document.createElement('div');
        header.className = 'toast-header';
        header.innerHTML = `
                <span class="toast-icon">⚠️</span>
                <strong>${notification.title}</strong>
            `;

        const message = document.createElement('div');
        message.className = 'toast-message';
        message.textContent = notification.message;

        const details = document.createElement('div');
        details.className = 'toast-details';
        details.textContent = `Số hồ sơ bị thu hồi: ${data.expiredCaseCount}`;

        const actions = document.createElement('div');
        actions.className = 'toast-actions';

        const primaryBtn = document.createElement('button');
        primaryBtn.className = 'toast-btn primary';
        primaryBtn.textContent = 'Xem hồ sơ của tôi';
        primaryBtn.onclick = () => {
          toast.dismiss(t.id);
          this.navigateToMyCases();
        };

        const secondaryBtn = document.createElement('button');
        secondaryBtn.className = 'toast-btn secondary';
        secondaryBtn.textContent = 'Đóng';
        secondaryBtn.onclick = () => toast.dismiss(t.id);

        actions.appendChild(primaryBtn);
        actions.appendChild(secondaryBtn);

        container.appendChild(header);
        container.appendChild(message);
        container.appendChild(details);
        container.appendChild(actions);

        return container;
      },
      {
        duration: 15000, // 15 seconds
        id: 'delegation-expired',
        style: {
          background: '#FEF3C7',
          border: '1px solid #F59E0B',
          color: '#92400E',
          maxWidth: '400px',
        },
      },
    );

    // Auto-navigate after 3 seconds if user doesn't interact
    setTimeout(() => {
      if (document.visibilityState === 'visible') {
        this.navigateToMyCases();
      }
    }, 3000);
  }

  /**
   * Navigate to MyCases page and reload data
   */
  navigateToMyCases() {
    // Emit reload event for any components listening
    this.emit('reload-casedetail-data', {
      source: 'delegation-expired',
      timestamp: new Date().toISOString(),
    });

    // Check if we're already on MyCases page
    if (window.location.pathname === '/mycases') {
      // Just reload the data
      window.dispatchEvent(new CustomEvent('reload-mycases-data'));
      toast.success('Danh sách hồ sơ đã được cập nhật', {
        id: 'mycases-reload',
      });
    } else {
      // Navigate to MyCases page
      window.location.href = '/mycases';
    }
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      devLog('WebSocket disconnected manually');
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isConnectedToServer() {
    return this.isConnected && this.socket?.connected;
  }

  /**
   * Send test notification (for debugging)
   */
  sendTestNotification() {
    if (this.socket) {
      this.socket.emit('test-notification', {
        message: 'Test notification from client',
      });
    }
  }

  /**
   * Singleton pattern
   */
  static getInstance() {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }
}

// Export singleton instance
const webSocketService = WebSocketService.getInstance();
export default webSocketService;
