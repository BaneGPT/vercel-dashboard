// vercel-dashboard/dashboard/app.js
// Chaos C2 Dashboard - Main Application Logic

// ============ STATE MANAGEMENT ============
const State = {
  currentView: 'overview',
  currentCampaign: null,
  campaigns: [],
  systems: [],
  globalStats: {},
  charts: {},
  sse: null,
  auth: { valid: false, role: null, campaignId: null },
  timeRange: '24h',
  pollingInterval: null
};

// ============ UTILITIES ============
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const fmtBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const fmtNumber = (n) => n?.toLocaleString() || '0';
const fmtDate = (iso) => iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never';
const timeAgo = (iso) => {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

const generateId = (prefix = 'id') => `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

const showToast = (message, type = 'info', duration = 4000) => {
  const container = $('#toastContainer');
  const colors = {
    info: 'border-chaos-500 bg-chaos-950/50',
    success: 'border-acc-emerald bg-acc-emeraldDim',
    warning: 'border-acc-amber bg-acc-amberDim',
    error: 'border-acc-rose bg-acc-roseDim'
  };
  const icons = {
    info: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
    success: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>',
    warning: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>',
    error: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>'
  };
  const toast = document.createElement('div');
  toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl border ${colors[type]} shadow-xl animate-slide-in-right`;
  toast.innerHTML = `${icons[type]}<span class="text-sm font-medium text-white">${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(100%)'; setTimeout(() => toast.remove(), 300); }, duration);
};

const api = async (path, options = {}) => {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (State.auth.valid && State.auth.campaignId) {
    headers['Authorization'] = `Bearer ${State.auth.campaignId}`; // Will be replaced by actual key
  }
  const res = await fetch(`${window.__CHAOS_CONFIG__.apiBase}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
};

// ============ CHART HELPERS ============
const chartColors = {
  primary: '#d6781e',
  primaryLight: 'rgba(214,120,30,0.15)',
  emerald: '#10b981',
  emeraldLight: 'rgba(16,185,129,0.15)',
  amber: '#f59e0b',
  amberLight: 'rgba(245,158,11,0.15)',
  rose: '#f43f5e',
  roseLight: 'rgba(244,63,94,0.15)',
  sky: '#0ea5e9',
  skyLight: 'rgba(14,165,233,0.15)',
  violet: '#8b5cf6',
  violetLight: 'rgba(139,92,246,0.15)',
  cyan: '#06b6d4',
  cyanLight: 'rgba(6,182,212,0.15)',
  gradient1: 'rgba(214,120,30,0.4)',
  gradient2: 'rgba(214,120,30,0.0)'
};

function destroyChart(id) {
  if (State.charts[id]) { State.charts[id].destroy(); delete State.charts[id]; }
}

function createGradient(ctx, color1, color2) {
  const grad = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
  grad.addColorStop(0, color1);
  grad.addColorStop(1, color2);
  return grad;
}

// ============ VIEW RENDERING ============
async function renderView(view) {
  State.currentView = view;
  $('#viewTitle').textContent = view.charAt(0).toUpperCase() + view.slice(1);
  $$('.sidebar-link').forEach(el => {
    el.classList.toggle('sidebar-link-active', el.dataset.view === view);
    el.classList.toggle('sidebar-link', el.dataset.view !== view);
  });
  $$('.tab-btn').forEach(el => el.classList.toggle('tab-btn-active', el.dataset.view === view));

  const content = $('#viewContent');
  content.innerHTML = '<div class="flex items-center justify-center h-64"><div class="animate-spin-slow w-10 h-10 border-4 border-chaos-500 border-t-transparent rounded-full"></div></div>';

  try {
    switch (view) {
      case 'overview': await renderOverview(); break;
      case 'systems': await renderSystems(); break;
      case 'campaigns': await renderCampaigns(); break;
      case 'analytics': await renderAnalytics(); break;
      case 'geo': await renderGeo(); break;
      case 'timeline': await renderTimeline(); break;
      case 'files': await renderFiles(); break;
    }
  } catch (e) {
    console.error(`Render ${view} error:`, e);
    content.innerHTML = `<div class="card-base text-center py-12"><svg class="w-12 h-12 mx-auto text-acc-rose mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg><h3 class="text-lg font-semibold mb-2">Failed to load</h3><p class="text-gray-500 mb-4">${e.message}</p><button class="btn-primary" onclick="renderView('${view}')">Retry</button></div>`;
  }
}

async function renderOverview() {
  const content = $('#viewContent');
  // Fetch global stats
  const stats = await api('/stats?range=7d');
  State.globalStats = stats;

  // Update badges
  $('#overviewBadge').classList.remove('hidden');
  $('#systemsBadge').textContent = stats.summary?.totalInfections || 0;
  $('#systemsBadge').classList.remove('hidden');
  $('#campaignsBadge').textContent = stats.summary?.totalInfections || 0; // placeholder
  $('#campaignsBadge').classList.remove('hidden');

  content.innerHTML = `
    <!-- Stats Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6" id="statCards">
      <article class="card-base stat-card animate-slide-up" style="animation-delay: 0ms">
        <p class="stat-label">Active Infections</p>
        <p class="stat-value text-acc-emerald" id="statInfections">${fmtNumber(stats.summary?.totalInfections)}</p>
        <p class="text-xs text-gray-500 mt-1">+${fmtNumber(stats.daily?.[stats.daily.length-1]?.uploads || 0)} today</p>
      </article>
      <article class="card-base stat-card animate-slide-up" style="animation-delay: 50ms">
        <p class="stat-label">Files Exfiltrated</p>
        <p class="stat-value text-acc-sky" id="statFiles">${fmtNumber(stats.summary?.totalUploads)}</p>
        <p class="text-xs text-gray-500 mt-1">Avg ${stats.summary?.avgFilesPerInfection || 0}/infection</p>
      </article>
      <article class="card-base stat-card animate-slide-up" style="animation-delay: 100ms">
        <p class="stat-label">Data Exfiltrated</p>
        <p class="stat-value text-chaos-400" id="statBytes">${fmtBytes(stats.summary?.totalBytes)}</p>
        <p class="text-xs text-gray-500 mt-1">${fmtBytes(stats.daily?.[stats.daily.length-1]?.bytes || 0)} today</p>
      </article>
      <article class="card-base stat-card animate-slide-up" style="animation-delay: 150ms">
        <p class="stat-label">Campaigns Active</p>
        <p class="stat-value text-acc-violet" id="statCampaigns">${State.campaigns.filter(c => c.status === 'active').length || 0}</p>
        <p class="text-xs text-gray-500 mt-1">Total: ${State.campaigns.length}</p>
      </article>
    </div>

    <!-- Charts Row -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      <!-- Daily Activity -->
      <article class="card-base">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold">Daily Activity (7 Days)</h3>
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 bg-acc-emerald rounded-full"></span>
            <span class="text-xs text-gray-400">Live via SSE</span>
          </div>
        </div>
        <div class="chart-container-lg">
          <canvas id="overviewDailyChart"></canvas>
        </div>
      </article>

      <!-- Top Extensions Treemap -->
      <article class="card-base">
        <h3 class="text-lg font-semibold mb-4">File Types Exfiltrated</h3>
        <div class="chart-container-lg">
          <canvas id="overviewExtTreemap"></canvas>
        </div>
      </article>
    </div>

    <!-- Second Row -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      <!-- Status Distribution -->
      <article class="card-base lg:col-span-1">
        <h3 class="text-lg font-semibold mb-4">System Status</h3>
        <div class="chart-container">
          <canvas id="overviewStatusChart"></canvas>
        </div>
      </article>

      <!-- Campaign Performance -->
      <article class="card-base lg:col-span-2">
        <h3 class="text-lg font-semibold mb-4">Campaign Performance</h3>
        <div class="scrollbar-thin overflow-x-auto">
          <table class="w-full min-w-[600px]">
            <thead>
              <tr>
                <th class="table-header">Campaign</th>
                <th class="table-header text-right">Infections</th>
                <th class="table-header text-right">Files</th>
                <th class="table-header text-right">Data</th>
                <th class="table-header text-right">Last Activity</th>
                <th class="table-header">Status</th>
              </tr>
            </thead>
            <tbody id="campaignPerfBody" class="divide-y divide-gray-800">
              ${State.campaigns.slice(0, 10).map(c => `
                <tr class="table-row" onclick="openCampaignDetail('${c.id}')">
                  <td class="table-cell font-mono text-chaos-400">${c.name}</td>
                  <td class="table-cell text-right font-mono">${fmtNumber(c.stats?.totalInfections)}</td>
                  <td class="table-cell text-right font-mono">${fmtNumber(c.stats?.totalFiles)}</td>
                  <td class="table-cell text-right font-mono">${fmtBytes(c.stats?.totalBytes)}</td>
                  <td class="table-cell text-right text-gray-400">${timeAgo(c.stats?.lastActivity)}</td>
                  <td class="table-cell"><span class="badge ${c.status === 'active' ? 'badge-active' : 'badge-inactive'}">${c.status}</span></td>
                </tr>
              `).join('') || '<tr><td colspan="6" class="table-cell text-center text-gray-500 py-8">No campaigns</td></tr>'}
            </tbody>
          </table>
        </div>
      </article>
    </div>

    <!-- Recent Systems -->
    <article class="card-base">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold">Recent Infections</h3>
        <button class="btn-ghost text-sm" onclick="showView('systems')">View All →</button>
      </div>
      <div class="scrollbar-thin overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr>
              <th class="table-header">Victim ID</th>
              <th class="table-header">Hostname</th>
              <th class="table-header">OS</th>
              <th class="table-header">Location</th>
              <th class="table-header text-right">Files</th>
              <th class="table-header text-right">Data</th>
              <th class="table-header">Last Seen</th>
              <th class="table-header">Status</th>
            </tr>
          </thead>
          <tbody id="recentSystemsBody" class="divide-y divide-gray-800">
            <!-- Populated by SSE or fetch -->
          </tbody>
        </table>
      </div>
    </article>
  `;

  // Initialize charts
  initOverviewCharts(stats);
  loadRecentSystems();
}

function initOverviewCharts(stats) {
  // Daily Activity Chart
  destroyChart('overviewDailyChart');
  const dailyCtx = $('#overviewDailyChart').getContext('2d');
  const dailyData = stats.daily || [];
  State.charts.overviewDailyChart = new Chart(dailyCtx, {
    type: 'bar',
    data: {
      labels: dailyData.map(d => d.date.split('-').slice(1).join('-')),
      datasets: [
        {
          label: 'Uploads',
          data: dailyData.map(d => d.uploads),
          backgroundColor: chartColors.primaryLight,
          borderColor: chartColors.primary,
          borderWidth: 1,
          borderRadius: 4,
          yAxisID: 'y'
        },
        {
          label: 'MB Exfiltrated',
          data: dailyData.map(d => (d.bytes / 1024 / 1024).toFixed(2)),
          backgroundColor: 'transparent',
          borderColor: chartColors.amber,
          borderWidth: 2,
          borderRadius: 4,
          type: 'line',
          tension: 0.4,
          pointBackgroundColor: chartColors.amber,
          pointRadius: 4,
          pointHoverRadius: 6,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'top', labels: { boxWidth: 12, pointStyle: 'circle' } } },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 7 } },
        y: { type: 'linear', position: 'left', grid: { color: '#2d2d2d' }, beginAtZero: true },
        y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, beginAtZero: true }
      }
    }
  });

  // Extensions Treemap
  destroyChart('overviewExtTreemap');
  const extCtx = $('#overviewExtTreemap').getContext('2d');
  const extData = stats.topExtensions || {};
  const extEntries = Object.entries(extData).sort((a, b) => b[1] - a[1]).slice(0, 20);
  State.charts.overviewExtTreemap = new Chart(extCtx, {
    type: 'treemap',
    data: {
      datasets: [{
        label: 'File Extensions',
        tree: { children: extEntries.map(([ext, count], i) => ({ v: count, label: `.${ext}`, color: [chartColors.primary, chartColors.amber, chartColors.emerald, chartColors.sky, chartColors.violet, chartColors.cyan][i % 6] })) },
        key: 'v',
        groups: ['label'],
        spacing: 2,
        borderWidth: 1,
        borderColor: '#1c1c1c'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { tooltip: { callbacks: { label: ctx => `${ctx.raw.label}: ${ctx.raw.v} files` } } }
    }
  });

  // Status Donut
  destroyChart('overviewStatusChart');
  const statusCtx = $('#overviewStatusChart').getContext('2d');
  State.charts.overviewStatusChart = new Chart(statusCtx, {
    type: 'doughnut',
    data: {
      labels: ['Active', 'Idle', 'Offline'],
      datasets: [{
        data: [0, 0, 0], // Will be updated by SSE
        backgroundColor: [chartColors.emerald, chartColors.amber, '#374151'],
        borderWidth: 0,
        cutout: '70%'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, pointStyle: 'circle', padding: 15 } } },
      cutout: '70%'
    }
  });
}

async function loadRecentSystems() {
  try {
    const data = await api('/systems?limit=10');
    const body = $('#recentSystemsBody');
    body.innerHTML = data.systems.map(sys => `
      <tr class="table-row" onclick="openSystemDetail('${sys.id}')">
        <td class="table-cell font-mono text-chaos-400">${sys.victimId}</td>
        <td class="table-cell">${sys.hostname}</td>
        <td class="table-cell text-gray-400">${sys.os}</td>
        <td class="table-cell">${sys.city}, ${sys.country}</td>
        <td class="table-cell text-right font-mono">${fmtNumber(sys.stats.filesEncrypted)}</td>
        <td class="table-cell text-right font-mono">${fmtBytes(sys.stats.bytesExfiltrated)}</td>
        <td class="table-cell text-gray-400">${timeAgo(sys.lastSeen)}</td>
        <td class="table-cell"><span class="badge ${sys.status === 'active' ? 'badge-active' : sys.status === 'idle' ? 'badge-warning' : 'badge-inactive'}">${sys.status}</span></td>
      </tr>
    `).join('') || '<tr><td colspan="8" class="table-cell text-center text-gray-500 py-8">No systems yet</td></tr>';
  } catch (e) {
    console.error('Load recent systems:', e);
  }
}

async function renderSystems() {
  const content = $('#viewContent');
  content.innerHTML = `
    <div class="flex flex-col gap-4">
      <!-- Toolbar -->
      <div class="card-base flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div class="flex flex-col sm:flex-row gap-3">
          <input type="text" id="sysSearch" placeholder="Search systems..." class="input-base w-full sm:w-64" oninput="filterSystems(this.value)">
          <select id="sysStatusFilter" class="input-base w-auto" onchange="filterSystems()">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="idle">Idle</option>
            <option value="offline">Offline</option>
          </select>
          <select id="sysCampaignFilter" class="input-base w-auto" onchange="filterSystems()">
            <option value="">All Campaigns</option>
            ${State.campaigns.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="flex gap-2">
          <button class="btn-secondary" onclick="exportSystems()">Export CSV</button>
          <button class="btn-primary" onclick="refreshView()">Refresh</button>
        </div>
      </div>

      <!-- Systems Table -->
      <div class="card-base overflow-hidden">
        <div class="scrollbar-thin overflow-x-auto">
          <table class="w-full min-w-[1000px]" id="systemsTable">
            <thead>
              <tr>
                <th class="table-header w-36">Victim ID</th>
                <th class="table-header">Hostname</th>
                <th class="table-header">Username</th>
                <th class="table-header">OS</th>
                <th class="table-header">Location</th>
                <th class="table-header">IP</th>
                <th class="table-header text-right">Files Enc.</th>
                <th class="table-header text-right">Files Exfil</th>
                <th class="table-header text-right">Data Exfil</th>
                <th class="table-header">First Seen</th>
                <th class="table-header">Last Seen</th>
                <th class="table-header">Status</th>
                <th class="table-header">Campaign</th>
                <th class="table-header w-24">Actions</th>
              </tr>
            </thead>
            <tbody id="systemsBody" class="divide-y divide-gray-800">
              <!-- Populated by loadSystemsTable -->
            </tbody>
          </table>
        </div>
        <div class="p-4 border-t border-gray-800 flex items-center justify-between">
          <span id="sysPaginationInfo" class="text-sm text-gray-400">Loading...</span>
          <div class="flex gap-2">
            <button id="sysPrevPage" class="btn-secondary text-sm" onclick="changeSysPage(-1)">Previous</button>
            <button id="sysNextPage" class="btn-secondary text-sm" onclick="changeSysPage(1)">Next</button>
          </div>
        </div>
      </div>
    </div>
  `;
  await loadSystemsTable();
}

let systemsPage = 1;
const systemsPageSize = 25;
let allSystems = [];

async function loadSystemsTable() {
  try {
    const data = await api('/systems?limit=200');
    allSystems = data.systems;
    renderSystemsPage();
  } catch (e) {
    console.error('Load systems:', e);
    $('#systemsBody').innerHTML = '<tr><td colspan="14" class="table-cell text-center text-acc-rose py-8">Failed to load</td></tr>';
  }
}

function filterSystems() {
  const search = $('#sysSearch')?.value?.toLowerCase() || '';
  const status = $('#sysStatusFilter')?.value || '';
  const campaign = $('#sysCampaignFilter')?.value || '';
  
  let filtered = allSystems;
  if (search) filtered = filtered.filter(s => s.victimId.toLowerCase().includes(search) || s.hostname.toLowerCase().includes(search));
  if (status) filtered = filtered.filter(s => s.status === status);
  if (campaign) filtered = filtered.filter(s => s.campaignId === campaign);
  
  systemsPage = 1;
  renderSystemsPage(filtered);
}

function renderSystemsPage(filtered = null) {
  const systems = filtered || allSystems;
  const start = (systemsPage - 1) * systemsPageSize;
  const pageData = systems.slice(start, start + systemsPageSize);
  
  const body = $('#systemsBody');
  body.innerHTML = pageData.map(sys => `
    <tr class="table-row" onclick="openSystemDetail('${sys.id}')">
      <td class="table-cell font-mono text-chaos-400">${sys.victimId}</td>
      <td class="table-cell">${sys.hostname}</td>
      <td class="table-cell text-gray-400">${sys.username}</td>
      <td class="table-cell text-gray-400">${sys.os}</td>
      <td class="table-cell">${sys.city}, ${sys.country}</td>
      <td class="table-cell font-mono text-xs">${sys.ip}</td>
      <td class="table-cell text-right font-mono">${fmtNumber(sys.stats.filesEncrypted)}</td>
      <td class="table-cell text-right font-mono">${fmtNumber(sys.stats.filesExfiltrated)}</td>
      <td class="table-cell text-right font-mono">${fmtBytes(sys.stats.bytesExfiltrated)}</td>
      <td class="table-cell text-gray-400">${fmtDate(sys.firstSeen)}</td>
      <td class="table-cell text-gray-400">${fmtDate(sys.lastSeen)}</td>
      <td class="table-cell"><span class="badge ${sys.status === 'active' ? 'badge-active' : sys.status === 'idle' ? 'badge-warning' : 'badge-inactive'}">${sys.status}</span></td>
      <td class="table-cell text-gray-400">${sys.campaignName || 'N/A'}</td>
      <td class="table-cell">
        <div class="flex items-center gap-1">
          <button class="btn-ghost p-1.5 text-xs" onclick="event.stopPropagation(); openSystemDetail('${sys.id}')">View</button>
          <button class="btn-ghost p-1.5 text-xs text-acc-rose" onclick="event.stopPropagation(); deleteSystem('${sys.id}')">Del</button>
        </div>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="14" class="table-cell text-center text-gray-500 py-8">No systems match</td></tr>';

  $('#sysPaginationInfo').textContent = `Showing ${start + 1}-${Math.min(start + systemsPageSize, systems.length)} of ${systems.length}`;
  $('#sysPrevPage').disabled = systemsPage === 1;
  $('#sysNextPage').disabled = start + systemsPageSize >= systems.length;
}

function changeSysPage(delta) {
  systemsPage += delta;
  renderSystemsPage();
}

async function renderCampaigns() {
  const content = $('#viewContent');
  await loadCampaigns();
  
  content.innerHTML = `
    <div class="flex flex-col gap-4">
      <!-- Toolbar -->
      <div class="card-base flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h3 class="text-lg font-semibold">Campaigns & Keys</h3>
        <button class="btn-primary" onclick="openCampaignModal()">+ Create Campaign</button>
      </div>

      <!-- Campaigns Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="campaignsGrid">
        ${State.campaigns.map(c => campaignCard(c)).join('') || '<div class="col-span-full card-base text-center py-12 text-gray-500">No campaigns yet. Click "Create Campaign" to start.</div>'}
      </div>
    </div>
  `;
}

function campaignCard(c) {
  return `
    <article class="card-base glass-hover relative overflow-hidden group">
      <div class="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-chaos-500/10 to-transparent rounded-full blur-2xl"></div>
      <div class="relative z-10">
        <div class="flex items-start justify-between mb-4">
          <div>
            <h4 class="font-semibold text-white">${c.name}</h4>
            <p class="text-xs text-gray-500 font-mono">${c.id}</p>
          </div>
          <span class="badge ${c.status === 'active' ? 'badge-active' : 'badge-inactive'}">${c.status}</span>
        </div>
        
        <div class="space-y-3 mb-4">
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div class="bg-surface-900/50 rounded-lg p-2"><p class="text-gray-500">Infections</p><p class="font-mono text-white font-semibold">${fmtNumber(c.stats?.totalInfections)}</p></div>
            <div class="bg-surface-900/50 rounded-lg p-2"><p class="text-gray-500">Files</p><p class="font-mono text-white font-semibold">${fmtNumber(c.stats?.totalFiles)}</p></div>
            <div class="bg-surface-900/50 rounded-lg p-2"><p class="text-gray-500">Data</p><p class="font-mono text-white font-semibold">${fmtBytes(c.stats?.totalBytes)}</p></div>
            <div class="bg-surface-900/50 rounded-lg p-2"><p class="text-gray-500">Systems</p><p class="font-mono text-white font-semibold">${c.systemCount || 0}</p></div>
          </div>
        </div>

        <div class="pt-3 border-t border-gray-800">
          <p class="text-xs text-gray-500 mb-2">API Key</p>
          <div class="flex items-center gap-2">
            <code class="font-mono text-xs bg-surface-900/50 px-2 py-1 rounded flex-1 break-all" id="key_${c.id}">${c.apiKey}</code>
            <button class="btn-ghost p-1.5" onclick="copyKey('${c.id}')" title="Copy"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg></button>
            <button class="btn-ghost p-1.5" onclick="regenerateKey('${c.id}')" title="Regenerate"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg></button>
          </div>
        </div>

        <div class="flex gap-2 mt-4">
          <button class="btn-secondary flex-1 text-sm" onclick="openCampaignDetail('${c.id}')">Details</button>
          <button class="btn-secondary flex-1 text-sm" onclick="showCampaignSystems('${c.id}')">Systems</button>
          <button class="btn-ghost flex-1 text-sm text-acc-rose" onclick="deleteCampaign('${c.id}')">Delete</button>
        </div>
      </div>
    </article>
  `;
}

async function loadCampaigns() {
  try {
    const data = await api('/campaigns');
    State.campaigns = data.campaigns || [];
    // Update campaign filter in systems view
    const filter = $('#sysCampaignFilter');
    if (filter) filter.innerHTML = '<option value="">All Campaigns</option>' + State.campaigns.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    // Update campaign selector in sidebar
    const selector = $('#campaignSelect');
    if (selector) selector.innerHTML = '<option value="">Select campaign...</option>' + State.campaigns.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  } catch (e) {
    console.error('Load campaigns:', e);
  }
}

async function renderAnalytics() {
  const content = $('#viewContent');
  const stats = await api('/stats?range=30d');
  
  content.innerHTML = `
    <div class="space-y-6">
      <!-- Time Series -->
      <article class="card-base">
        <h3 class="text-lg font-semibold mb-4">Exfiltration Volume Over Time</h3>
        <div class="chart-container-lg">
          <canvas id="analyticsVolumeChart"></canvas>
        </div>
      </article>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- Extensions Breakdown -->
        <article class="card-base">
          <h3 class="text-lg font-semibold mb-4">File Extension Distribution</h3>
          <div class="chart-container-lg">
            <canvas id="analyticsExtChart"></canvas>
          </div>
        </article>

        <!-- Hourly Heatmap -->
        <article class="card-base">
          <h3 class="text-lg font-semibold mb-4">Activity Heatmap (Hour vs Day)</h3>
          <div class="chart-container-lg">
            <canvas id="analyticsHeatmapChart"></canvas>
          </div>
        </article>
      </div>

      <!-- Campaign Comparison -->
      <article class="card-base">
        <h3 class="text-lg font-semibold mb-4">Campaign Comparison</h3>
        <div class="chart-container">
          <canvas id="analyticsCampaignChart"></canvas>
        </div>
      </article>
    </div>
  `;

  initAnalyticsCharts(stats);
}

function initAnalyticsCharts(stats) {
  const daily = stats.daily || [];
  
  // Volume Chart
  destroyChart('analyticsVolumeChart');
  const volCtx = $('#analyticsVolumeChart').getContext('2d');
  State.charts.analyticsVolumeChart = new Chart(volCtx, {
    type: 'line',
    data: {
      labels: daily.map(d => d.date.split('-').slice(1).join('-')),
      datasets: [
        {
          label: 'Files',
          data: daily.map(d => d.uploads),
          borderColor: chartColors.sky,
          backgroundColor: chartColors.skyLight,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 5,
          yAxisID: 'y'
        },
        {
          label: 'MB',
          data: daily.map(d => (d.bytes / 1024 / 1024).toFixed(2)),
          borderColor: chartColors.amber,
          backgroundColor: chartColors.amberLight,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 5,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'top' } },
      scales: {
        x: { grid: { color: '#2d2d2d' } },
        y: { type: 'linear', position: 'left', grid: { color: '#2d2d2d' }, beginAtZero: true },
        y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, beginAtZero: true }
      }
    }
  });

  // Extensions Chart
  destroyChart('analyticsExtChart');
  const extCtx = $('#analyticsExtChart').getContext('2d');
  const extData = stats.topExtensions || {};
  const extEntries = Object.entries(extData).sort((a, b) => b[1] - a[1]).slice(0, 15);
  State.charts.analyticsExtChart = new Chart(extCtx, {
    type: 'bar',
    data: {
      labels: extEntries.map(e => '.' + e[0]),
      datasets: [{
        label: 'Files',
        data: extEntries.map(e => e[1]),
        backgroundColor: extEntries.map((_, i) => [chartColors.primary, chartColors.emerald, chartColors.sky, chartColors.amber, chartColors.violet, chartColors.cyan, chartColors.rose][i % 7]),
        borderRadius: 4,
        indexAxis: 'y'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: { x: { grid: { color: '#2d2d2d' }, beginAtZero: true }, y: { grid: { display: false } } }
    }
  });

  // Heatmap (simulated - would need hourly data)
  destroyChart('analyticsHeatmapChart');
  const hmCtx = $('#analyticsHeatmapChart').getContext('2d');
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const hmData = hours.map(h => days.map(d => Math.random() * 100)); // Placeholder
  State.charts.analyticsHeatmapChart = new Chart(hmCtx, {
    type: 'matrix',
    data: {
      datasets: [{
        label: 'Activity',
        data: hmData.flatMap((row, h) => row.map((v, d) => ({ x: d, y: h, v }))),
        width: ({ chart }) => (chart.width / 7) * 0.9,
        height: ({ chart }) => (chart.height / 24) * 0.9,
        borderWidth: 1,
        borderColor: '#1c1c1c'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${days[ctx.raw.x]} ${ctx.raw.y}:00 - ${ctx.raw.v.toFixed(0)}%` } } },
      scales: {
        x: { type: 'category', labels: days, grid: { display: false }, ticks: { color: '#9ca3af' } },
        y: { type: 'category', labels: hours.map(h => `${h}:00`), reverse: true, grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 9 } } }
      }
    }
  });

  // Campaign Comparison
  destroyChart('analyticsCampaignChart');
  const campCtx = $('#analyticsCampaignChart').getContext('2d');
  const topCampaigns = State.campaigns.slice(0, 8);
  State.charts.analyticsCampaignChart = new Chart(campCtx, {
    type: 'radar',
    data: {
      labels: ['Infections', 'Files', 'Data (GB)', 'Active Systems', 'Avg Files/Inf', 'Duration'],
      datasets: topCampaigns.map((c, i) => ({
        label: c.name,
        data: [
          c.stats?.totalInfections || 0,
          (c.stats?.totalFiles || 0) / 10,
          (c.stats?.totalBytes || 0) / 1e9 * 100,
          c.systemCount || 0,
          c.stats?.avgFilesPerInfection || 0,
          50 // placeholder
        ],
        borderColor: [chartColors.primary, chartColors.emerald, chartColors.sky, chartColors.amber, chartColors.violet, chartColors.cyan, chartColors.rose][i % 7],
        backgroundColor: [chartColors.primary, chartColors.emerald, chartColors.sky, chartColors.amber, chartColors.violet, chartColors.cyan, chartColors.rose][i % 7] + '33',
        pointBackgroundColor: [chartColors.primary, chartColors.emerald, chartColors.sky, chartColors.amber, chartColors.violet, chartColors.cyan, chartColors.rose][i % 7],
        borderWidth: 2
      }))
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: { r: { grid: { color: '#2d2d2d' }, angleLines: { color: '#2d2d2d' }, pointLabels: { color: '#9ca3af' }, suggestedMin: 0 } }
    }
  });
}

async function renderGeo() {
  const content = $('#viewContent');
  const systems = await api('/systems?limit=500');
  
  content.innerHTML = `
    <div class="space-y-6">
      <article class="card-base">
        <h3 class="text-lg font-semibold mb-4">Geographic Distribution</h3>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div class="lg:col-span-2">
            <div class="chart-container-lg h-96">
              <canvas id="geoMapChart"></canvas>
            </div>
          </div>
          <div>
            <h4 class="font-medium mb-3">Top Countries</h4>
            <div id="geoCountryList" class="space-y-2 max-h-96 overflow-y-auto scrollbar-thin"></div>
          </div>
        </div>
      </article>

      <article class="card-base">
        <h3 class="text-lg font-semibold mb-4">City-Level Detail</h3>
        <div class="scrollbar-thin overflow-x-auto">
          <table class="w-full min-w-[800px]">
            <thead>
              <tr>
                <th class="table-header">City</th>
                <th class="table-header">Country</th>
                <th class="table-header">Systems</th>
                <th class="table-header text-right">Files</th>
                <th class="table-header text-right">Data</th>
                <th class="table-header">ISP</th>
              </tr>
            </thead>
            <tbody id="geoCityBody" class="divide-y divide-gray-800"></tbody>
          </table>
        </div>
      </article>
    </div>
  `;

  initGeoCharts(systems.systems);
}

function initGeoCharts(systems) {
  // Aggregate by country
  const countryStats = {};
  const cityStats = {};
  
  systems.forEach(sys => {
    const country = sys.country || 'Unknown';
    const city = `${sys.city}, ${sys.country}` || 'Unknown';
    
    countryStats[country] = (countryStats[country] || 0) + 1;
    cityStats[city] = (cityStats[city] || 0) + 1;
  });

  // Country list
  const countryList = $('#geoCountryList');
  const sortedCountries = Object.entries(countryStats).sort((a, b) => b[1] - a[1]);
  countryList.innerHTML = sortedCountries.slice(0, 20).map(([country, count], i) => `
    <div class="flex items-center gap-3 p-2 bg-surface-900/50 rounded-lg">
      <span class="font-mono text-chaos-400 w-6">${i + 1}.</span>
      <span class="flex-1 text-sm">${country}</span>
      <span class="font-mono text-white">${count}</span>
    </div>
  `).join('');

  // City table
  const cityBody = $('#geoCityBody');
  const sortedCities = Object.entries(cityStats).sort((a, b) => b[1] - a[1]);
  cityBody.innerHTML = sortedCities.slice(0, 50).map(([city, count]) => {
    const sys = systems.find(s => `${s.city}, ${s.country}` === city);
    return `
      <tr class="table-row">
        <td class="table-cell">${sys?.city || city.split(',')[0]}</td>
        <td class="table-cell">${sys?.country || city.split(',')[1]?.trim()}</td>
        <td class="table-cell font-mono">${count}</td>
        <td class="table-cell text-right font-mono">${fmtNumber(sys?.stats?.filesEncrypted)}</td>
        <td class="table-cell text-right font-mono">${fmtBytes(sys?.stats?.bytesExfiltrated)}</td>
        <td class="table-cell text-gray-400 text-sm">${sys?.isp || 'Unknown'}</td>
      </tr>
    `;
  }).join('');

  // World map placeholder (would use a real map lib like leaflet)
  destroyChart('geoMapChart');
  const mapCtx = $('#geoMapChart').getContext('2d');
  State.charts.geoMapChart = new Chart(mapCtx, {
    type: 'bar',
    data: {
      labels: sortedCountries.slice(0, 10).map(c => c[0]),
      datasets: [{
        label: 'Infections',
        data: sortedCountries.slice(0, 10).map(c => c[1]),
        backgroundColor: chartColors.primaryLight,
        borderColor: chartColors.primary,
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: { x: { grid: { color: '#2d2d2d' }, beginAtZero: true }, y: { grid: { display: false } } }
    }
  });
}

async function renderTimeline() {
  const content = $('#viewContent');
  
  content.innerHTML = `
    <div class="space-y-6">
      <article class="card-base">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold">Infection Timeline</h3>
          <div class="flex gap-2">
            <select id="tlGranularity" class="input-base w-auto" onchange="refreshTimeline()">
              <option value="hour">Hourly</option>
              <option value="day" selected>Daily</option>
              <option value="week">Weekly</option>
            </select>
          </div>
        </div>
        <div class="chart-container-lg">
          <canvas id="timelineChart"></canvas>
        </div>
      </article>

      <article class="card-base">
        <h3 class="text-lg font-semibold mb-4">Event Stream</h3>
        <div id="timelineEvents" class="space-y-3 max-h-96 overflow-y-auto scrollbar-thin">
          <!-- Populated by SSE -->
        </div>
      </article>
    </div>
  `;

  initTimelineChart();
  connectTimelineSSE();
}

function initTimelineChart() {
  destroyChart('timelineChart');
  const ctx = $('#timelineChart').getContext('2d');
  State.charts.timelineChart = new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets: [
      { label: 'New Infections', data: [], borderColor: chartColors.emerald, backgroundColor: chartColors.emeraldLight, fill: true, tension: 0.3 },
      { label: 'Files Exfiltrated', data: [], borderColor: chartColors.sky, backgroundColor: chartColors.skyLight, fill: true, tension: 0.3, yAxisID: 'y1' },
      { label: 'Data (MB)', data: [], borderColor: chartColors.amber, backgroundColor: chartColors.amberLight, fill: true, tension: 0.3, yAxisID: 'y1' }
    ]},
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'top' } },
      scales: {
        x: { grid: { color: '#2d2d2d' }, type: 'time', time: { unit: 'hour' } },
        y: { type: 'linear', position: 'left', grid: { color: '#2d2d2d' }, beginAtZero: true },
        y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, beginAtZero: true }
      }
    }
  });
}

function connectTimelineSSE() {
  // Would connect to SSE for real-time events
  // For now, simulate
  setTimeout(() => addTimelineEvent('System infected', 'sys_abc123', 'active'), 1000);
  setTimeout(() => addTimelineEvent('Files exfiltrated', 'sys_abc123', 'info'), 2000);
  setTimeout(() => addTimelineEvent('Ransom note dropped', 'sys_abc123', 'warning'), 3000);
}

function addTimelineEvent(message, systemId, type) {
  const container = $('#timelineEvents');
  const colors = { active: 'border-acc-emerald', info: 'border-acc-sky', warning: 'border-acc-amber', danger: 'border-acc-rose' };
  const icons = { active: 'circle', info: 'download', warning: 'file-text', danger: 'alert-triangle' };
  const event = document.createElement('div');
  event.className = `flex items-start gap-3 p-3 bg-surface-900/50 rounded-xl border ${colors[type] || 'border-gray-700'} animate-fade-in`;
  event.innerHTML = `
    <div class="w-8 h-8 rounded-full bg-surface-800 flex items-center justify-center flex-shrink-0">
      <svg class="w-4 h-4 text-chaos-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
    </div>
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium text-white">${message}</p>
      <p class="text-xs text-gray-500 font-mono">${systemId} • ${timeAgo(new Date().toISOString())}</p>
    </div>
  `;
  container.prepend(event);
  // Keep only last 50
  while (container.children.length > 50) container.lastChild.remove();
}

async function renderFiles() {
  const content = $('#viewContent');
  
  content.innerHTML = `
    <div class="flex flex-col gap-4">
      <div class="card-base flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h3 class="text-lg font-semibold">File Explorer</h3>
        <div class="flex gap-2">
          <input type="text" id="fileSearch" placeholder="Search files..." class="input-base w-64" oninput="filterFiles(this.value)">
          <select id="fileExtFilter" class="input-base w-auto" onchange="filterFiles()">
            <option value="">All Extensions</option>
          </select>
        </div>
      </div>

      <div class="card-base overflow-hidden">
        <div class="scrollbar-thin overflow-x-auto">
          <table class="w-full min-w-[1000px]">
            <thead>
              <tr>
                <th class="table-header">File Name</th>
                <th class="table-header">System</th>
                <th class="table-header">Extension</th>
                <th class="table-header text-right">Size</th>
                <th class="table-header">Campaign</th>
                <th class="table-header">Uploaded</th>
                <th class="table-header">Status</th>
              </tr>
            </thead>
            <tbody id="filesBody" class="divide-y divide-gray-800">
              <tr><td colspan="7" class="table-cell text-center text-gray-500 py-8">Select a system or campaign to browse files</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ============ CAMPAIGN MANAGEMENT ============
function openCampaignModal(campaign = null) {
  const isEdit = !!campaign;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-panel">
      <div class="p-5 border-b border-gray-700 flex items-center justify-between">
        <h3 class="text-lg font-semibold">${isEdit ? 'Edit Campaign' : 'Create Campaign'}</h3>
        <button class="text-gray-400 hover:text-white text-2xl leading-none" onclick="this.closest('.modal-overlay').remove()">&times;</button>
      </div>
      <div class="p-5 overflow-y-auto max-h-[60vh]">
        <form id="campaignForm" class="space-y-4">
          <div>
            <label class="block text-xs text-gray-400 mb-1">Campaign Name</label>
            <input type="text" name="name" class="input-base" value="${campaign?.name || ''}" required placeholder="e.g., Operation Goldmine">
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1">Description</label>
            <textarea name="description" class="input-base h-20" placeholder="Campaign notes...">${campaign?.description || ''}</textarea>
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1">API Key (leave blank to generate)</label>
            <input type="text" name="apiKey" class="input-base font-mono text-sm" value="${campaign?.apiKey || ''}" placeholder="Auto-generated if empty">
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-gray-400 mb-1">RSA Key Size</label>
              <select name="rsaKeySize" class="input-base">
                <option value="2048" ${campaign?.rsaKeySize === 2048 ? 'selected' : ''}>2048</option>
                <option value="4096" ${campaign?.rsaKeySize !== 2048 ? 'selected' : ''}>4096</option>
              </select>
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1">Status</label>
              <select name="status" class="input-base">
                <option value="active" ${campaign?.status === 'active' ? 'selected' : ''}>Active</option>
                <option value="paused" ${campaign?.status === 'paused' ? 'selected' : ''}>Paused</option>
                <option value="archived" ${campaign?.status === 'archived' ? 'selected' : ''}>Archived</option>
              </select>
            </div>
          </div>
        </form>
      </div>
      <div class="p-5 border-t border-gray-700 flex justify-end gap-3">
        <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button class="btn-primary" onclick="saveCampaign('${campaign?.id || ''}')">${isEdit ? 'Save Changes' : 'Create Campaign'}</button>
      </div>
    </div>
  `;
  $('#modalRoot').appendChild(modal);
  modal.querySelector('input[name="name"]').focus();
}

async function saveCampaign(id) {
  const form = $('#campaignForm');
  const data = Object.fromEntries(new FormData(form).entries());
  data.status = data.status || 'active';
  if (data.rsaKeySize) data.rsaKeySize = parseInt(data.rsaKeySize);

  try {
    if (id) {
      await api('/campaigns', { method: 'PUT', body: JSON.stringify({ id, ...data }) });
      showToast('Campaign updated', 'success');
    } else {
      await api('/campaigns', { method: 'POST', body: JSON.stringify(data) });
      showToast('Campaign created', 'success');
    }
    $('.modal-overlay').remove();
    await loadCampaigns();
    if (State.currentView === 'campaigns') renderCampaigns();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function deleteCampaign(id) {
  if (!confirm('Delete this campaign and all associated data?')) return;
  try {
    await api('/campaigns?id=' + id, { method: 'DELETE' });
    showToast('Campaign deleted', 'success');
    await loadCampaigns();
    if (State.currentView === 'campaigns') renderCampaigns();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function copyKey(id) {
  const key = $(`#key_${id}`)?.textContent;
  if (key) {
    navigator.clipboard.writeText(key);
    showToast('API Key copied', 'success');
  }
}

async function regenerateKey(id) {
  const newKey = `ck_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 10)}`;
  try {
    await api('/campaigns', { method: 'PUT', body: JSON.stringify({ id, apiKey: newKey }) });
    showToast('API Key regenerated', 'success');
    await loadCampaigns();
    if (State.currentView === 'campaigns') renderCampaigns();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function openCampaignDetail(id) {
  const campaign = State.campaigns.find(c => c.id === id);
  if (!campaign) return;
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-panel max-w-2xl">
      <div class="p-5 border-b border-gray-700 flex items-center justify-between">
        <h3 class="text-lg font-semibold">${campaign.name}</h3>
        <button class="text-gray-400 hover:text-white text-2xl leading-none" onclick="this.closest('.modal-overlay').remove()">&times;</button>
      </div>
      <div class="p-5 overflow-y-auto max-h-[70vh] space-y-5">
        <div class="grid grid-cols-2 gap-4">
          ${[
            ['Campaign ID', campaign.id, true],
            ['API Key', campaign.apiKey, true],
            ['RSA Key Size', campaign.rsaKeySize + ' bits', false],
            ['Status', `<span class="badge ${campaign.status === 'active' ? 'badge-active' : 'badge-inactive'}">${campaign.status}</span>`, false],
            ['Created', fmtDate(campaign.createdAt), false],
            ['Updated', fmtDate(campaign.updatedAt), false],
            ['Total Infections', fmtNumber(campaign.stats?.totalInfections), false],
            ['Total Files', fmtNumber(campaign.stats?.totalFiles), false],
            ['Total Data', fmtBytes(campaign.stats?.totalBytes), false],
            ['Systems', campaign.systemCount || 0, false],
            ['Last Activity', timeAgo(campaign.stats?.lastActivity), false]
          ].map(([label, value, mono]) => `
            <div class="bg-surface-900/50 rounded-lg p-4">
              <p class="text-xs text-gray-500 uppercase tracking-wider">${label}</p>
              <p class="font-mono text-sm text-white break-all ${mono ? '' : ''}">${value}</p>
            </div>
          `).join('')}
        </div>
        <div class="flex gap-2">
          <button class="btn-secondary flex-1" onclick="openCampaignModal(campaigns.find(c => c.id === '${id}'))">Edit</button>
          <button class="btn-ghost flex-1 text-acc-rose" onclick="deleteCampaign('${id}')">Delete</button>
        </div>
      </div>
    </div>
  `;
  $('#modalRoot').appendChild(modal);
}

function showCampaignSystems(id) {
  State.currentCampaign = id;
  showView('systems');
  $('#sysCampaignFilter').value = id;
  filterSystems();
}

function switchCampaign(id) {
  State.currentCampaign = id || null;
  refreshView();
}

// ============ SYSTEM DETAIL ============
function openSystemDetail(id) {
  // Fetch full details
  api(`/systems?id=${id}`).then(sys => {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-panel max-w-5xl">
        <div class="p-5 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold">${sys.hostname}</h3>
            <p class="text-sm text-gray-400 font-mono">${sys.victimId} • ${sys.id}</p>
          </div>
          <button class="text-gray-400 hover:text-white text-2xl leading-none" onclick="this.closest('.modal-overlay').remove()">&times;</button>
        </div>
        <div class="p-5 overflow-y-auto max-h-[75vh] space-y-6">
          <!-- System Info -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            ${[
              ['Victim ID', sys.victimId, true],
              ['Hostname', sys.hostname, false],
              ['Username', sys.username, false],
              ['OS', sys.os, false],
              ['IP Address', sys.ip, true],
              ['Location', `${sys.city}, ${sys.country}`, false],
              ['ISP', sys.isp, false],
              ['Status', `<span class="badge ${sys.status === 'active' ? 'badge-active' : sys.status === 'idle' ? 'badge-warning' : 'badge-inactive'}">${sys.status}</span>`, false],
              ['First Seen', fmtDate(sys.firstSeen), false],
              ['Last Seen', fmtDate(sys.lastSeen), false],
              ['Campaign', sys.campaigns?.map(c => c.name).join(', ') || 'N/A', false],
              ['Tags', sys.tags?.join(', ') || 'None', false]
            ].map(([label, value, mono]) => `
              <div class="bg-surface-900/50 rounded-lg p-4">
                <p class="text-xs text-gray-500 uppercase tracking-wider">${label}</p>
                <p class="${mono ? 'font-mono' : ''} text-sm text-white break-all">${value}</p>
              </div>
            `).join('')}
          </div>

          <!-- Stats -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            ${[
              ['Files Encrypted', fmtNumber(sys.stats?.filesEncrypted), 'acc-rose'],
              ['Files Exfiltrated', fmtNumber(sys.stats?.filesExfiltrated), 'acc-sky'],
              ['Data Exfiltrated', fmtBytes(sys.stats?.bytesExfiltrated), 'chaos'],
              ['Ransom Note', sys.stats?.ransomNoteDropped ? 'Yes' : 'No', sys.stats?.ransomNoteDropped ? 'acc-emerald' : 'acc-rose']
            ].map(([label, value, color]) => `
              <div class="bg-surface-900/50 rounded-lg p-4 border-l-4 border-${color}">
                <p class="text-xs text-gray-500 uppercase tracking-wider">${label}</p>
                <p class="font-mono text-lg text-${color}">${value}</p>
              </div>
            `).join('')}
          </div>

          <!-- Files -->
          <div>
            <h4 class="font-medium mb-3">Exfiltrated Files (Latest 100)</h4>
            <div class="scrollbar-thin overflow-x-auto max-h-64">
              <table class="w-full min-w-[700px]">
                <thead>
                  <tr>
                    <th class="table-header">File Name</th>
                    <th class="table-header">Extension</th>
                    <th class="table-header text-right">Size</th>
                    <th class="table-header">Uploaded</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-800">
                  ${(sys.files || []).slice(0, 100).map(f => `
                    <tr class="table-row">
                      <td class="table-cell font-mono truncate max-w-xs" title="${f.fileName}">${f.fileName}</td>
                      <td class="table-cell text-gray-400 font-mono">.${f.fileExt}</td>
                      <td class="table-cell text-right font-mono">${fmtBytes(f.size)}</td>
                      <td class="table-cell text-gray-400">${fmtDate(f.uploadedAt)}</td>
                    </tr>
                  `).join('') || '<tr><td colspan="4" class="table-cell text-center text-gray-500 py-8">No files</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  $('#modalRoot').appendChild(modal);
}).catch(e => showToast('Failed to load system: ' + e.message, 'error'));
}

async function deleteSystem(id) {
  if (!confirm('Remove this system from tracking?')) return;
  try {
    await api('/systems?id=' + id, { method: 'DELETE' });
    showToast('System removed', 'success');
    if (State.currentView === 'systems') loadSystemsTable();
    refreshView();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function exportSystems() {
  const csv = ['Victim ID,Hostname,Username,OS,IP,Country,City,Status,Files Encrypted,Files Exfiltrated,Bytes Exfiltrated,First Seen,Last Seen,Campaign']
    .concat(allSystems.map(s => `"${s.victimId}","${s.hostname}","${s.username}","${s.os}","${s.ip}","${s.country}","${s.city}","${s.status}",${s.stats.filesEncrypted},${s.stats.filesExfiltrated},${s.stats.bytesExfiltrated},"${s.firstSeen}","${s.lastSeen}","${s.campaignName || ''}"`))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `systems_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Exported CSV', 'success');
}

// ============ AUTH ============
function openAuthModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-panel max-w-md">
      <div class="p-5 border-b border-gray-700 flex items-center justify-between">
        <h3 class="text-lg font-semibold">Authentication</h3>
        <button class="text-gray-400 hover:text-white text-2xl leading-none" onclick="this.closest('.modal-overlay').remove()">&times;</button>
      </div>
      <div class="p-5 space-y-4">
        ${State.auth.valid ? `
          <div class="bg-acc-emeraldDim border border-acc-emerald rounded-lg p-4">
            <p class="text-sm font-medium text-acc-emerald">Authenticated</p>
            <p class="text-xs text-gray-400 mt-1">Role: ${State.auth.role}</p>
            <p class="text-xs text-gray-500 font-mono mt-1">${State.auth.campaignId || 'Master'}</p>
          </div>
          <button class="btn-secondary w-full" onclick="logout()">Sign Out</button>
        ` : `
          <p class="text-sm text-gray-400">Enter your Master API Key or Campaign API Key</p>
          <input type="password" id="authKeyInput" class="input-base font-mono text-sm" placeholder="ck_... or master key" onkeydown="if(event.key==='Enter') verifyAuth()">
          <button class="btn-primary w-full" onclick="verifyAuth()">Verify</button>
        `}
      </div>
    </div>
  `;
  $('#modalRoot').appendChild(modal);
  $('#authKeyInput')?.focus();
}

async function verifyAuth() {
  const key = $('#authKeyInput').value.trim();
  if (!key) return showToast('Enter API key', 'warning');
  
  try {
    const res = await api('/auth/verify', { method: 'POST', body: JSON.stringify({ apiKey: key }) });
    State.auth = res;
    if (res.valid) {
      showToast(`Authenticated as ${res.role}`, 'success');
      $('#authBtn').innerHTML = `<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg><span>${res.role === 'admin' ? 'Admin' : res.campaignName}</span>`;
      $('#authBtn').classList.remove('btn-ghost');
      $('#authBtn').classList.add('btn-secondary');
      if (res.campaignId) {
        State.currentCampaign = res.campaignId;
        $('#campaignSelect').value = res.campaignId;
      }
      $('.modal-overlay').remove();
      refreshView();
    }
  } catch (e) {
    showToast('Invalid API key', 'error');
  }
}

function logout() {
  State.auth = { valid: false, role: null, campaignId: null };
  State.currentCampaign = null;
  $('#campaignSelect').value = '';
  $('#authBtn').innerHTML = `<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg><span>Sign In</span>`;
  $('#authBtn').classList.remove('btn-secondary');
  $('#authBtn').classList.add('btn-ghost');
  $('.modal-overlay').remove();
  showToast('Signed out', 'info');
  refreshView();
}

// ============ REAL-TIME SSE ============
function connectSSE() {
  if (State.sse) State.sse.close();
  
  const params = new URLSearchParams();
  if (State.currentCampaign) params.set('campaignId', State.currentCampaign);
  params.set('types', 'stats,systems,campaigns,files');
  
  State.sse = new EventSource(`${window.__CHAOS_CONFIG__.sseEndpoint}?${params}`);
  
  State.sse.onopen = () => {
    updateConnectionStatus(true);
    console.log('SSE connected');
  };
  
  State.sse.onerror = () => {
    updateConnectionStatus(false);
    console.log('SSE error, reconnecting...');
    setTimeout(connectSSE, 5000);
  };
  
  State.sse.addEventListener('stats', (e) => {
    const data = JSON.parse(e.data);
    updateGlobalStats(data);
  });
  
  State.sse.addEventListener('systems', (e) => {
    const data = JSON.parse(e.data);
    updateSystemsList(data);
  });
  
  State.sse.addEventListener('campaignStats', (e) => {
    const data = JSON.parse(e.data);
    updateCampaignStats(data.campaignId, data.stats);
  });
  
  State.sse.addEventListener('newFile', (e) => {
    const data = JSON.parse(e.data);
    addTimelineEvent(`New file: ${data.fileName}`, data.infectionId, 'info');
  });
  
  State.sse.addEventListener('heartbeat', () => {
    // Connection alive
  });
}

function updateConnectionStatus(connected) {
  const indicator = $('#connIndicator');
  const status = $('#connStatus');
  if (connected) {
    indicator.className = 'w-2.5 h-2.5 rounded-full bg-acc-emerald animate-pulse-slow';
    status.textContent = 'Connected';
    status.className = 'text-xs text-acc-emerald';
  } else {
    indicator.className = 'w-2.5 h-2.5 rounded-full bg-acc-rose';
    status.textContent = 'Disconnected';
    status.className = 'text-xs text-acc-rose';
  }
}

function updateGlobalStats(stats) {
  // Update stat cards
  const infectionsEl = $('#statInfections');
  const filesEl = $('#statFiles');
  const bytesEl = $('#statBytes');
  if (infectionsEl) infectionsEl.textContent = fmtNumber(stats.totalInfections);
  if (filesEl) filesEl.textContent = fmtNumber(stats.totalFiles);
  if (bytesEl) bytesEl.textContent = fmtBytes(stats.totalBytes);
  
  // Update daily chart
  if (State.charts.overviewDailyChart && stats.daily) {
    State.charts.overviewDailyChart.data.labels = stats.daily.map(d => d.date.split('-').slice(1).join('-'));
    State.charts.overviewDailyChart.data.datasets[0].data = stats.daily.map(d => d.uploads);
    State.charts.overviewDailyChart.data.datasets[1].data = stats.daily.map(d => (d.bytes / 1024 / 1024).toFixed(2));
    State.charts.overviewDailyChart.update('none');
  }
}

function updateSystemsList(systems) {
  // Update recent systems in overview
  const body = $('#recentSystemsBody');
  if (body) {
    body.innerHTML = systems.slice(0, 10).map(sys => `
      <tr class="table-row" onclick="openSystemDetail('${sys.id}')">
        <td class="table-cell font-mono text-chaos-400">${sys.victimId}</td>
        <td class="table-cell">${sys.hostname}</td>
        <td class="table-cell text-gray-400">${sys.os}</td>
        <td class="table-cell">${sys.city}, ${sys.country}</td>
        <td class="table-cell text-right font-mono">${fmtNumber(sys.stats.filesEncrypted)}</td>
        <td class="table-cell text-right font-mono">${fmtBytes(sys.stats.bytesExfiltrated)}</td>
        <td class="table-cell text-gray-400">${timeAgo(sys.lastSeen)}</td>
        <td class="table-cell"><span class="badge ${sys.status === 'active' ? 'badge-active' : sys.status === 'idle' ? 'badge-warning' : 'badge-inactive'}">${sys.status}</span></td>
      </tr>
    `).join('');
  }
  
  // Update status chart
  if (State.charts.overviewStatusChart) {
    const counts = { active: 0, idle: 0, offline: 0 };
    systems.forEach(s => counts[s.status] = (counts[s.status] || 0) + 1);
    State.charts.overviewStatusChart.data.datasets[0].data = [counts.active, counts.idle, counts.offline];
    State.charts.overviewStatusChart.update('none');
  }
  
  // Update systems badge
  $('#systemsBadge').textContent = systems.length;
  
  // If on systems view, refresh table
  if (State.currentView === 'systems') {
    allSystems = systems;
    renderSystemsPage();
  }
}

function updateCampaignStats(campaignId, stats) {
  const campaign = State.campaigns.find(c => c.id === campaignId);
  if (campaign) {
    campaign.stats = { ...campaign.stats, ...stats };
    if (State.currentView === 'campaigns') renderCampaigns();
    if (State.currentView === 'overview') {
      // Update campaign performance table
      const row = $(`#campaignPerfBody tr:has(td:contains("${campaign.name}"))`);
      if (row) {
        row.querySelectorAll('.font-mono')[1].textContent = fmtNumber(stats.totalInfections);
        row.querySelectorAll('.font-mono')[2].textContent = fmtNumber(stats.totalFiles);
        row.querySelectorAll('.font-mono')[3].textContent = fmtBytes(stats.totalBytes);
        row.querySelectorAll('.text-gray-400')[0].textContent = timeAgo(stats.lastActivity);
      }
    }
  }
}

// ============ NAVIGATION ============
function showView(view) {
  renderView(view);
  if (window.innerWidth < 1024) toggleSidebar(false);
}

function toggleSidebar(force) {
  const sidebar = $('#sidebar');
  const overlay = $('#sidebarOverlay');
  const isOpen = sidebar.classList.contains('-translate-x-full');
  const shouldOpen = force !== undefined ? force : isOpen;
  
  if (shouldOpen) {
    sidebar.classList.remove('-translate-x-full');
    overlay.classList.remove('hidden');
  } else {
    sidebar.classList.add('-translate-x-full');
    overlay.classList.add('hidden');
  }
}

function refreshView() {
  State.timeRange = $('#timeRange')?.value || '24h';
  renderView(State.currentView);
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', async () => {
  // Load campaigns first
  await loadCampaigns();
  
  // Connect SSE
  connectSSE();
  
  // Initial view
  renderView('overview');
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      $('.modal-overlay')?.remove();
      toggleSidebar(false);
    }
    if (e.key === 'r' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      refreshView();
    }
  });
  
  console.log('Chaos C2 Dashboard initialized');
});

// ============ FILE FILTERING ============
function filterFiles(input) {
  // Placeholder
  console.log('Filter files:', input);
}

function filterSystems(input) {
  // Already implemented above
}