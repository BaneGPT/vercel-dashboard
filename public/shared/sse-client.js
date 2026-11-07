// vercel-dashboard/dashboard/shared/sse-client.js
// Real-time SSE Client for Live Updates

export class SSEClient {
  constructor(options = {}) {
    this.url = options.url || '/api/realtime/events';
    this.reconnectInterval = options.reconnectInterval || 3000;
    this.maxRetries = options.maxRetries || 10;
    this.onMessage = options.onMessage || (() => {});
    this.onConnect = options.onConnect || (() => {});
    this.onDisconnect = options.onDisconnect || (() => {});
    this.onError = options.onError || (() => {});
    
    this.eventSource = null;
    this.retryCount = 0;
    this.isConnected = false;
    this.listeners = new Map();
  }

  connect() {
    if (this.eventSource) return;
    
    try {
      this.eventSource = new EventSource(this.url);
      
      this.eventSource.onopen = () => {
        this.isConnected = true;
        this.retryCount = 0;
        this.onConnect();
        this.emit('connect');
      };
      
      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.onMessage(data);
          this.emit('message', data);
          
          // Emit typed events
          if (data.type) {
            this.emit(data.type, data.payload || data);
          }
        } catch (e) {
          console.warn('SSE parse error:', e);
        }
      };
      
      this.eventSource.addEventListener('stats', (event) => {
        this.emit('stats', JSON.parse(event.data));
      });
      
      this.eventSource.addEventListener('notification', (event) => {
        this.emit('notification', JSON.parse(event.data));
      });
      
      this.eventSource.addEventListener('alert', (event) => {
        this.emit('alert', JSON.parse(event.data));
      });
      
      this.eventSource.onerror = (err) => {
        this.isConnected = false;
        this.onError(err);
        this.emit('error', err);
        this.scheduleReconnect();
      };
    } catch (e) {
      console.error('SSE connection failed:', e);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.retryCount >= this.maxRetries) {
      this.emit('maxRetriesReached');
      return;
    }
    
    this.retryCount++;
    const delay = Math.min(this.reconnectInterval * Math.pow(1.5, this.retryCount - 1), 30000);
    
    setTimeout(() => {
      if (!this.isConnected) {
        this.connect();
      }
    }, delay);
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected = false;
    this.onDisconnect();
    this.emit('disconnect');
  }

  // Event emitter pattern
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => cb(data));
    }
  }

  getConnectionState() {
    return this.isConnected ? 'connected' : 'disconnected';
  }
}

// React-like hook for SSE (vanilla JS version)
export function useSSE(url, options = {}) {
  const client = new SSEClient({ url, ...options });
  let state = { connected: false, lastMessage: null, error: null };
  const subscribers = new Set();

  const notify = () => subscribers.forEach(cb => cb(state));

  const wrappedClient = {
    ...client,
    onMessage: (data) => {
      state = { ...state, connected: true, lastMessage: data, error: null };
      notify();
      options.onMessage?.(data);
    },
    onConnect: () => {
      state = { ...state, connected: true, error: null };
      notify();
      options.onConnect?.();
    },
    onDisconnect: () => {
      state = { ...state, connected: false };
      notify();
      options.onDisconnect?.();
    },
    onError: (err) => {
      state = { ...state, connected: false, error: err };
      notify();
      options.onError?.(err);
    },
    subscribe: (callback) => {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
    getState: () => state,
    connect: () => client.connect(),
    disconnect: () => client.disconnect(),
  };

  return wrappedClient;
}

// Global notification system
export class NotificationSystem {
  constructor(container) {
    this.container = container || this.createContainer();
    this.toasts = new Map();
    this.idCounter = 0;
  }

  createContainer() {
    const el = document.createElement('div');
    el.className = 'toast-container';
    document.body.appendChild(el);
    return el;
  }

  show(message, type = 'info', duration = 5000) {
    const id = ++this.idCounter;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${this.getIcon(type)}</span>
      <span class="toast-message">${message}</span>
      <button class="toast-close" aria-label="Close">&times;</button>
    `;
    
    toast.querySelector('.toast-close').onclick = () => this.dismiss(id);
    
    this.container.appendChild(toast);
    this.toasts.set(id, toast);
    
    // Animate in
    requestAnimationFrame(() => toast.classList.add('show'));
    
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
    
    return id;
  }

  dismiss(id) {
    const toast = this.toasts.get(id);
    if (toast) {
      toast.classList.add('hide');
      setTimeout(() => {
        toast.remove();
        this.toasts.delete(id);
      }, 300);
    }
  }

  dismissAll() {
    this.toasts.forEach((_, id) => this.dismiss(id));
  }

  getIcon(type) {
    const icons = {
      success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L21.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      danger: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    };
    return icons[type] || icons.info;
  }
}

// Live data store with reactive updates
export class LiveStore {
  constructor(initialData = {}) {
    this.data = { ...initialData };
    this.subscribers = new Map();
    this.history = [];
    this.maxHistory = 100;
  }

  set(key, value) {
    const oldValue = this.data[key];
    this.data[key] = value;
    this.history.push({ key, oldValue, newValue: value, timestamp: Date.now() });
    if (this.history.length > this.maxHistory) this.history.shift();
    this.notify(key, value, oldValue);
  }

  get(key) {
    return this.data[key];
  }

  getAll() {
    return { ...this.data };
  }

  subscribe(key, callback) {
    if (!this.subscribers.has(key)) this.subscribers.set(key, new Set());
    this.subscribers.get(key).add(callback);
    return () => this.unsubscribe(key, callback);
  }

  unsubscribe(key, callback) {
    if (this.subscribers.has(key)) {
      this.subscribers.get(key).delete(callback);
    }
  }

  notify(key, value, oldValue) {
    if (this.subscribers.has(key)) {
      this.subscribers.get(key).forEach(cb => cb(value, oldValue));
    }
    // Also notify wildcard subscribers
    if (this.subscribers.has('*')) {
      this.subscribers.get('*').forEach(cb => cb(key, value, oldValue));
    }
  }
}

// Export singleton instances
export const liveStore = new LiveStore();
export const notifications = typeof document !== 'undefined' ? new NotificationSystem() : null;