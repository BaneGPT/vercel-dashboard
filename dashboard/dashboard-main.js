// vercel-dashboard/dashboard/dashboard-main.js
// Self-contained Chaos C2 Dashboard - No external module dependencies

// ============================================
// DESIGN SYSTEM (inlined)
// ============================================
const theme = {
  colors: {
    bg: '#050505', bgElevated: '#0d0d0d', surface: '#141414', surfaceHover: '#1c1c1c',
    border: '#2d2d2d', borderLight: '#3d3d3d',
    text: '#ffffff', textMuted: '#9ca3af', textDim: '#6b7280',
    primary: '#d6781e', primaryHover: '#e09542', primaryLight: 'rgba(214,120,30,0.15)',
    success: '#10b981', successLight: 'rgba(16,185,129,0.15)',
    warning: '#f59e0b', warningLight: 'rgba(245,158,11,0.15)',
    danger: '#f43f5e', dangerLight: 'rgba(244,63,94,0.15)',
    info: '#0ea5e9', infoLight: 'rgba(14,165,233,0.15)',
    violet: '#8b5cf6', violetLight: 'rgba(139,92,246,0.15)',
    cyan: '#06b6d4', cyanLight: 'rgba(6,182,212,0.15)',
  },
  spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px', xxl: '48px' },
  radius: { sm: '6px', md: '10px', lg: '14px', xl: '18px', full: '9999px' },
  shadows: { sm: '0 1px 2px rgba(0,0,0,0.3)', md: '0 4px 12px rgba(0,0,0,0.4)', lg: '0 12px 32px rgba(0,0,0,0.5)', glow: '0 0 24px rgba(214,120,30,0.2)' },
  transitions: { fast: '150ms ease', normal: '250ms ease', slow: '350ms ease' },
};

function formatNumber(n) { return (n ?? 0).toLocaleString(); }
function formatCurrency(n) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n ?? 0); }
function formatCompact(n) { if (!n) return '0'; if (n >= 1e9) return (n/1e9).toFixed(1)+'B'; if (n >= 1e6) return (n/1e6).toFixed(1)+'M'; if (n >= 1e3) return (n/1e3).toFixed(1)+'K'; return String(n); }
function cn(...classes) { return classes.filter(Boolean).join(' '); }

// ============================================
// ICONS
// ============================================
const Icons = {
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  server: '<rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c1.26-1.5.5-3.74-2-5z"/><path d="M14.5 7.5c1.5-1.26 2-5 2-5s-3.74.5-5 2c-1.26 1.5-.5 3.74 2 5z"/><line x1="12" y1="19" x2="12" y2="22"/>',
  chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  menu: '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
  chevronDown: '<polyline points="6 9 12 15 18 9"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/>',
  chevronDown2: '<polyline points="6 9 12 15 18 9"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 1 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 1 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 1 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 1 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 1-1.51 1z"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
  bell2: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  chevronDown2: '<polyline points="6 9 12 15 18 9"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  wallet: '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-6"/><path d="M3 19a2 2 0 0 0 2 2h16"/>',
  target2: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  shield2: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  users2: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  rocket2: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c1.26-1.5.5-3.74-2-5z"/><path d="M14.5 7.5c1.5-1.26 2-5 2-5s-3.74.5-5 2c-1.26 1.5-.5 3.74 2 5z"/><line x1="12" y1="19" x2="12" y2="22"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
};

function createIcon(name, size = 20) {
  const svg = Icons[name] || Icons.dashboard;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svg}</svg>`;
}

// ============================================
// UTILITIES
// ============================================
const $ = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
const $$ = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return Array.from(t.content.children); };
const cn = (...c) => c.filter(Boolean).join(' ');
const formatNumber = (n) => (n ?? 0).toLocaleString();
const formatCurrency = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n ?? 0);
const formatCompact = (n) => { if (!n) return '0'; if (n >= 1e9) return (n/1e9).toFixed(1)+'B'; if (n >= 1e6) return (n/1e6).toFixed(1)+'M'; if (n >= 1e3) return (n/1e3).toFixed(1)+'K'; return String(n); };

// ============================================
// SVG ICON HELPER
// ============================================
function icon(name, size = 20) {
  const paths = {
    dashboard: 'M3 3h7v7H3V3zm11 0h7v7h-7V3zm0 11H3v7h7v-7zm11 0h7v-7h-7z',
    server: 'M2 2h20v8H2V2zm0 12h20v8H2v-8zm4 4h.01M6 18h.01M16 6h.01M16 18h.01',
    rocket: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c1.26-1.5.5-3.74-2-5zm10-9c1.5-1.26 2-5 2-5s-3.74.5-5 2c-1.26 1.5-.5 3.74 2 5zM12 19v3',
    chart: 'M18 20V10M12 20V4M6 20v-6',
    bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
    menu: 'M3 12h18M3 6h18M3 18h18',
    chevronDown: 'M6 9l6 6 6-6',
    target: 'M12 22c-5.5 0-10-4.5-10-10S7 2 12 2s10 4.5 10 10-4.5 10-10 10zm0-8a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm0-10a4 4 0 1 1 0 8 4 4 0 0 1 0-8z',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    rocket2: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c1.26-1.5.5-3.74-2-5zm10-9c1.5-1.26 2-5 2-5s-3.74.5-5 2c-1.26 1.5-.5 3.74 2 5zM12 19v3',
    shield2: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    rocket2b: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c1.26-1.5.5-3.74-2-5zm10-9c1.5-1.26 2-5 2-5s-3.74.5-5 2c-1.26 1.5-.5 3.74 2 5zM12 19v3',
    lock: 'M3 11h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-11zM7 11V7a5 5 0 0 1 10 0v4',
    x: 'M18 6L6 18M6 6l12 12',
    check: 'M20 6L9 17l-5-5',
    plus: 'M12 5v14M5 12h14',
    search: 'M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z',
  };
  const path = paths[name] || paths.dashboard;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
}

// ============================================
// COMPONENT FACTORY
// ============================================
const $ = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
const $$ = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return Array.from(t.content.children); };

// ============================================
// UTILITIES
// ============================================
const formatNumber = (n) => (n ?? 0).toLocaleString();
const formatCurrency = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n ?? 0);
const formatCompact = (n) => { if (!n) return '0'; if (n >= 1e9) return (n/1e9).toFixed(1)+'B'; if (n >= 1e6) return (n/1e6).toFixed(1)+'M'; if (n >= 1e3) return (n/1e3).toFixed(1)+'K'; return String(n); };
const timeAgo = (iso) => { if (!iso) return '—'; const d = Date.now() - new Date(iso).getTime(); const m = Math.floor(d/60000), h = Math.floor(d/3600000), dy = Math.floor(d/86400000); if (m < 1) return 'Just now'; if (m < 60) return m+'m ago'; if (h < 24) return h+'h ago'; return dy+'d ago'; };

// ============================================
// ICON HELPER
// ============================================
function ic(name, size = 20) {
  const paths = {
    dashboard: 'M3 3h7v7H3V3zm11 0h7v7h-7V3zm0 11H3v7h7v-7zm11 0h7v-7h-7z',
    server: 'M2 2h20v8H2V2zm0 12h20v8H2v-8zm4 4h.01M6 18h.01M16 6h.01M16 18h.01',
    rocket: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c1.26-1.5.5-3.74-2-5zm10-9c1.5-1.26 2-5 2-5s-3.74.5-5 2c-1.26 1.5-.5 3.74 2 5zM12 19v3',
    chart: 'M18 20V10M12 20V4M6 20v-6',
    bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
    menu: 'M3 12h18M3 6h18M3 18h18',
    chevronDown: 'M6 9l6 6 6-6',
    target: 'M12 22c-5.5 0-10-4.5-10-10S7 2 12 2s10 4.5 10 10-4.5 10-10 10zm0-8a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm0-10a4 4 0 1 1 0 8 4 4 0 0 1 0-8z',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    rocket2: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c1.26-1.5.5-3.74-2-5zm10-9c1.5-1.26 2-5 2-5s-3.74.5-5 2c-1.26 1.5-.5 3.74 2 5zM12 19v3',
    shield2: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    rocket2b: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c1.26-1.5.5-3.74-2-5zm10-9c1.5-1.26 2-5 2-5s-3.74.5-5 2c-1.26 1.5-.5 3.74 2 5zM12 19v3',
    lock: 'M3 11h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-11zM7 11V7a5 5 0 0 1 10 0v4',
    x: 'M18 6L6 18M6 6l12 12',
    check: 'M20 6L9 17l-5-5',
    plus: 'M12 5v14M5 12h14',
    search: 'M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z',
    activity: 'M22 12H18M15 21V12M9 3v9M6 12H2',
    wallet: 'M21 12V7H5a2 2 0 0 1 0-4h14v4M3 5v14a2 2 0 0 0 2 2h16v-6M3 19a2 2 0 0 0 2 2h16',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
    activity2: 'M22 12H18M15 21V12M9 3v9M6 12H2',
    shield3: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    target2: 'M12 22c-5.5 0-10-4.5-10-10S7 2 12 2s10 4.5 10 10-4.5 10-10 10zm0-8a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm0-10a4 4 0 1 1 0 8 4 4 0 0 1 0-8z',
    shield4: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    users2: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    rocket2c: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c1.26-1.5.5-3.74-2-5zm10-9c1.5-1.26 2-5 2-5s-3.74.5-5 2c-1.26 1.5-.5 3.74 2 5zM12 19v3',
    lock2: 'M3 11h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-11zM7 11V7a5 5 0 0 1 10 0v4',
    x2: 'M18 6L6 18M6 6l12 12',
    check2: 'M20 6L9 17l-5-5',
    plus2: 'M12 5v14M5 12h14',
    search2: 'M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z',
  };
  const path = paths[name] || paths.dashboard;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
}

// ============================================
// CSS INJECTION
// ============================================
const STYLES = `
/* ===== DESIGN SYSTEM ===== */
:root {
  --bg: #050505; --bg-elevated: #0d0d0d; --surface: #141414; --surface-hover: #1c1c1c;
  --border: #2d2d2d; --border-light: #3d3d3d;
  --text: #ffffff; --text-muted: #9ca3af; --text-dim: #6b7280;
  --primary: #d6781e; --primary-hover: #e09542; --primary-light: rgba(214,120,30,0.15);
  --success: #10b981; --success-light: rgba(16,185,129,0.15);
  --warning: #f59e0b; --warning-light: rgba(245,158,11,0.15);
  --danger: #f43f5e; --danger-light: rgba(244,63,94,0.15);
  --info: #0ea5e9; --info-light: rgba(14,165,233,0.15);
  --violet: #8b5cf6; --violet-light: rgba(139,92,246,0.15);
  --cyan: #06b6d4; --cyan-light: rgba(6,182,212,0.15);
  --radius-sm: 6px; --radius-md: 10px; --radius-lg: 14px; --radius-xl: 18px; --radius-full: 9999px;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.3); --shadow-md: 0 4px 12px rgba(0,0,0,0.4); --shadow-lg: 0 12px 32px rgba(0,0,0,0.5);
  --shadow-glow: 0 0 24px rgba(214,120,30,0.2);
  --transition-fast: 150ms ease; --transition-normal: 250ms ease; --transition-slow: 350ms ease;
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
html { font-size: 14px; -webkit-font-smoothing: antialiased; }
body { font-family: var(--font-sans, 'Inter', sans-serif); background: var(--bg); color: var(--text); line-height: 1.6; min-height: 100vh; }
h1,h2,h3,h4,h5,h6 { font-weight: 600; line-height: 1.3; letter-spacing: -0.02em; }
.text-muted { color: var(--text-muted); } .text-dim { color: #6b7280; }
.text-primary { color: #d6781e; } .text-success { color: #10b981; } .text-warning { color: #f59e0b; } .text-danger { color: #f43f5e; } .text-info { color: #0ea5e9; }
.font-mono { font-family: 'JetBrains Mono', 'Fira Code', monospace; }

/* Layout */
.app-layout { display: grid; grid-template-columns: 280px 1fr; min-height: 100vh; }
.sidebar { background: #0d0d0d; border-right: 1px solid #2d2d2d; padding: 0; display: flex; flex-direction: column; position: fixed; left: 0; top: 0; bottom: 0; z-index: 100; width: 280px; transition: transform 250ms ease; }
.sidebar-header { padding: 20px; border-bottom: 1px solid #2d2d2d; }
.sidebar-nav { flex: 1; padding: 12px; overflow-y: auto; }
.sidebar-link { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; color: #9ca3af; text-decoration: none; transition: all 150ms ease; margin-bottom: 4px; }
.sidebar-link:hover { background: #1c1c1c; color: #fff; }
.sidebar-link-active { background: rgba(214,120,30,0.15); color: #d6781e; border-left: 3px solid #d6781e; }
.sidebar-footer { padding: 8px; }
.sidebar-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 99; }
.sidebar.open { transform: translateX(0); }
.sidebar-overlay.open { display: block; }

.main-content { grid-column: 2; display: flex; flex-direction: column; min-height: 100vh; }
.topbar { background: #0d0d0d; border-bottom: 1px solid #2d2d2d; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 50; }
.page-content { flex: 1; padding: 24px; overflow-y: auto; }

/* Buttons */
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 8px 16px; border-radius: 10px; font-size: 0.8125rem; font-weight: 500; line-height: 1.5; border: 1px solid transparent; cursor: pointer; transition: all 150ms ease; white-space: nowrap; text-decoration: none; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-sm { padding: 4px 10px; font-size: 0.6875rem; }
.btn-lg { padding: 12px 24px; font-size: 0.9375rem; }
.btn-icon { padding: 8px; }
.btn-primary { background: #d6781e; color: #050505; border-color: #d6781e; }
.btn-primary:hover:not(:disabled) { background: #e09542; box-shadow: 0 0 24px rgba(214,120,30,0.2); }
.btn-secondary { background: #1c1c1c; color: #fff; border-color: #2d2d2d; }
.btn-secondary:hover:not(:disabled) { background: #242424; border-color: #3d3d3d; }
.btn-ghost { background: transparent; color: #9ca3af; border-color: transparent; }
.btn-ghost:hover:not(:disabled) { background: #1c1c1c; color: #fff; }
.btn-danger { background: rgba(244,63,94,0.15); color: #f43f5e; border-color: #f43f5e; }
.btn-danger:hover:not(:disabled) { background: #f43f5e; color: #fff; box-shadow: 0 0 16px rgba(244,63,94,0.15); }
.btn-success { background: rgba(16,185,129,0.15); color: #10b981; border-color: #10b981; }
.btn-success:hover:not(:disabled) { background: #10b981; color: #050505; }

/* Card */
.card { background: #141414; border: 1px solid #2d2d2d; border-radius: 14px; padding: 24px; transition: all 250ms ease; }
.card:hover { border-color: #3d3d3d; }
.card-elevated { box-shadow: 0 4px 12px rgba(0,0,0,0.4); }
.card-interactive { cursor: pointer; }
.card-interactive:hover { border-color: #d6781e; box-shadow: 0 0 24px rgba(214,120,30,0.2); transform: translateY(-2px); }

/* Input */
.input { width: 100%; background: #050505; color: #fff; border: 1px solid #2d2d2d; border-radius: 10px; padding: 8px 16px; font-size: 0.8125rem; font-family: inherit; transition: all 150ms ease; }
.input::placeholder { color: #6b7280; }
.input:focus { outline: none; border-color: #d6781e; box-shadow: 0 0 0 3px rgba(214,120,30,0.15); }

/* Badge */
.badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 10px; border-radius: 9999px; font-size: 0.625rem; font-weight: 600; letter-spacing: 0.02em; text-transform: uppercase; }
.badge-primary { background: rgba(214,120,30,0.15); color: #d6781e; }
.badge-success { background: rgba(16,185,129,0.15); color: #10b981; }
.badge-warning { background: rgba(245,158,11,0.15); color: #f59e0b; }
.badge-danger { background: rgba(244,63,94,0.15); color: #f43f5e; }
.badge-info { background: rgba(14,165,233,0.15); color: #0ea5e9; }
.badge-violet { background: rgba(139,92,246,0.15); color: #8b5cf6; }

/* Avatar */
.avatar { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 9999px; background: linear-gradient(135deg, #d6781e, #e09542); color: #050505; font-weight: 700; font-size: 0.8125rem; flex-shrink: 0; }
.avatar-sm { width: 32px; height: 32px; font-size: 0.6875rem; }

/* Table */
.table-wrap { overflow-x: auto; border-radius: 14px; border: 1px solid #2d2d2d; }
.table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
.table th { text-align: left; padding: 12px 24px; font-size: 0.625rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; background: #050505; border-bottom: 1px solid #2d2d2d; }
.table td { padding: 12px 24px; border-bottom: 1px solid #2d2d2d; color: #fff; }
.table tr:last-child td { border-bottom: none; }
.table-row-hover tbody tr { transition: background 150ms ease; }
.table-row-hover tbody tr:hover { background: #1c1c1c; }

/* Chart */
.chart-container { position: relative; width: 100%; height: 300px; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; padding: 24px; z-index: 1000; opacity: 0; visibility: hidden; transition: all 250ms ease; }
.modal-overlay.open { opacity: 1; visibility: visible; }
.modal { background: #141414; border: 1px solid #2d2d2d; border-radius: 18px; max-width: 560px; width: 100%; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; transform: scale(0.95); transition: transform 250ms ease; }
.modal-overlay.open .modal { transform: scale(1); }
.modal-header { padding: 24px; border-bottom: 1px solid #2d2d2d; display: flex; justify-content: space-between; align-items: center; }
.modal-title { font-size: 1.0625rem; font-weight: 600; }
.modal-close { background: none; border: none; color: #9ca3af; cursor: pointer; padding: 8px; border-radius: 6px; }
.modal-close:hover { color: #fff; background: #1c1c1c; }
.modal-body { padding: 24px; overflow-y: auto; flex: 1; }
.modal-footer { padding: 24px; border-top: 1px solid #2d2d2d; display: flex; justify-content: flex-end; gap: 8px; }

/* Toast */
.toast-container { position: fixed; bottom: 32px; right: 32px; z-index: 2000; display: flex; flex-direction: column; gap: 8px; }
.toast { display: flex; align-items: center; gap: 8px; padding: 12px 20px; background: #141414; border: 1px solid #2d2d2d; border-radius: 14px; box-shadow: 0 12px 32px rgba(0,0,0,0.5); animation: slideIn 0.3s ease; max-width: 400px; }
.toast-success { border-left: 3px solid #10b981; }
.toast-warning { border-left: 3px solid #f59e0b; }
.toast-danger { border-left: 3px solid #f43f5e; }
.toast-info { border-left: 3px solid #0ea5e9; }
@keyframes slideIn { from { opacity: 0; transform: translateX(100%); } to { opacity: 1; transform: translateX(0); } }

/* Dropdown */
.dropdown { position: relative; display: inline-block; }
.dropdown-menu { position: absolute; top: 100%; right: 0; margin-top: 8px; background: #141414; border: 1px solid #2d2d2d; border-radius: 14px; box-shadow: 0 12px 32px rgba(0,0,0,0.5); min-width: 200px; opacity: 0; visibility: hidden; transform: translateY(-8px); transition: all 150ms ease; z-index: 100; padding: 8px; }
.dropdown.open .dropdown-menu { opacity: 1; visibility: visible; transform: translateY(0); }
.dropdown-item { display: flex; align-items: center; gap: 8px; padding: 8px 16px; color: #fff; border-radius: 10px; cursor: pointer; font-size: 0.8125rem; transition: background 150ms ease; white-space: nowrap; }
.dropdown-item:hover { background: #1c1c1c; }
.dropdown-divider { height: 1px; background: #2d2d2d; margin: 8px 0; }

/* Tabs */
.tabs { display: flex; border-bottom: 1px solid #2d2d2d; gap: 8px; }
.tab { padding: 8px 16px; font-size: 0.8125rem; font-weight: 500; color: #9ca3af; border-radius: 10px 10px 0 0; cursor: pointer; transition: all 150ms ease; border: 1px solid transparent; border-bottom: none; margin-bottom: -1px; }
.tab:hover { color: #fff; }
.tab.active { color: #d6781e; background: #050505; border-color: #2d2d2d; border-bottom-color: #050505; }

/* Scrollbar */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: #050505; }
::-webkit-scrollbar-thumb { background: #3d3d3d; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #6b7280; }

/* Animations */
@keyframes slideIn { from { opacity: 0; transform: translateX(100%); } to { opacity: 1; transform: translateX(0); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.animate-fade-in { animation: fadeIn 0.4s ease-out; }
.animate-spin { animation: spin 1s linear infinite; }
.animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }

/* Layout */
.app-layout { display: grid; grid-template-columns: 280px 1fr; min-height: 100vh; }
.sidebar { background: #0d0d0d; border-right: 1px solid #2d2d2d; padding: 0; display: flex; flex-direction: column; position: fixed; left: 0; top: 0; bottom: 0; z-index: 100; width: 280px; transition: transform 250ms ease; }
.sidebar-header { padding: 20px; border-bottom: 1px solid #2d2d2d; }
.sidebar-nav { flex: 1; padding: 12px; overflow-y: auto; }
.sidebar-link { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; color: #9ca3af; text-decoration: none; transition: all 150ms ease; margin-bottom: 4px; }
.sidebar-link:hover { background: #1c1c1c; color: #fff; }
.sidebar-link-active { background: rgba(214,120,30,0.15); color: #d6781e; border-left: 3px solid #d6781e; }
.sidebar-footer { padding: 8px; }
.sidebar-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 99; }
.sidebar.open { transform: translateX(0); }
.sidebar-overlay.open { display: block; }

.main-content { grid-column: 2; display: flex; flex-direction: column; min-height: 100vh; }
.topbar { background: #0d0d0d; border-bottom: 1px solid #2d2d2d; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 50; }
.page-content { flex: 1; padding: 24px; overflow-y: auto; }

/* Dropdown */
.dropdown { position: relative; display: inline-block; }
.dropdown-menu { position: absolute; top: 100%; right: 0; margin-top: 8px; background: #141414; border: 1px solid #2d2d2d; border-radius: 14px; box-shadow: 0 12px 32px rgba(0,0,0,0.5); min-width: 200px; opacity: 0; visibility: hidden; transform: translateY(-8px); transition: all 150ms ease; z-index: 100; padding: 8px; }
.dropdown.open .dropdown-menu { opacity: 1; visibility: visible; transform: translateY(0); }
.dropdown-item { display: flex; align-items: center; gap: 8px; padding: 8px 16px; color: #fff; border-radius: 10px; cursor: pointer; font-size: 0.8125rem; transition: background 150ms ease; white-space: nowrap; }
.dropdown-item:hover { background: #1c1c1c; }
.dropdown-divider { height: 1px; background: #2d2d2d; margin: 8px 0; }

/* Responsive */
@media (max-width: 1024px) {
  .sidebar { transform: translateX(-100%); }
  .sidebar.open { transform: translateX(0); }
  .sidebar-overlay.open { display: block; }
  .main-content { grid-column: 1; }
}

.fade-in { animation: fadeIn 0.4s ease-out; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideIn { from { opacity: 0; transform: translateX(100%); } to { opacity: 1; transform: translateX(0); } }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.animate-fade-in { animation: fadeIn 0.4s ease-out; }
.animate-spin { animation: spin 1s linear infinite; }
.animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
`;

// ============================================
// ICON HELPER
// ============================================
function ic(name, size = 20) {
  const paths = {
    dashboard: 'M3 3h7v7H3V3zm11 0h7v7h-7V3zm0 11H3v7h7v-7zm11 0h7v-7h-7z',
    server: 'M2 2h20v8H2V2zm0 12h20v8H2v-8zm4 4h.01M6 18h.01M16 6h.01M16 18h.01',
    rocket: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c1.26-1.5.5-3.74-2-5zm10-9c1.5-1.26 2-5 2-5s-3.74.5-5 2c-1.26 1.5-.5-3.74 2 5zM12 19v3',
    chart: 'M18 20V10M12 20V4M6 20v-6',
    bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
    menu: 'M3 12h18M3 6h18M3 18h18',
    chevronDown: 'M6 9l6 6 6-6',
    target: 'M12 22c-5.5 0-10-4.5-10-10S7 2 12 2s10 4.5 10 10-4.5 10-10 10zm0-8a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm0-10a4 4 0 1 1 0 8 4 4 0 0 1 0-8z',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    rocket2: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c1.26-1.5.5-3.74-2-5zm10-9c1.5-1.26 2-5 2-5s-3.74.5-5 2c-1.26 1.5-.5 3.74 2 5zM12 19v3',
    shield2: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    rocket2b: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c1.26-1.5.5-3.74-2-5zm10-9c1.5-1.26 2-5 2-5s-3.74.5-5 2c-1.26 1.5-.5 3.74 2 5zM12 19v3',
    lock: 'M3 11h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-11zM7 11V7a5 5 0 0 1 10 0v4',
    x: 'M18 6L6 18M6 6l12 12',
    check: 'M20 6L9 17l-5-5',
    plus: 'M12 5v14M5 12h14',
    search: 'M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z',
  };
  const path = paths[name] || paths.dashboard;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
}

// ============================================
// UTILITIES
// ============================================
const formatNumber = (n) => (n ?? 0).toLocaleString();
const formatCurrency = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n ?? 0);
const formatCompact = (n) => { if (!n) return '0'; if (n >= 1e9) return (n/1e9).toFixed(1)+'B'; if (n >= 1e6) return (n/1e6).toFixed(1)+'M'; if (n >= 1e3) return (n/1e3).toFixed(1)+'K'; return String(n); };
const timeAgo = (iso) => { if (!iso) return '—'; const d = Date.now() - new Date(iso).getTime(); const m = Math.floor(d/60000), h = Math.floor(d/3600000), dy = Math.floor(d/86400000); if (m < 1) return 'Just now'; if (m < 60) return m+'m ago'; if (h < 24) return h+'h ago'; return dy+'d ago'; };

// ============================================
// STATE
// ============================================
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

// ============================================
// ICON HELPER
// ============================================
function ic(name, size = 20) {
  const paths = {
    dashboard: 'M3 3h7v7H3V3zm11 0h7v7h-7V3zm0 11H3v7h7v-7zm11 0h7v-7h-7z',
    server: 'M2 2h20v8H2V2zm0 12h20v8H2v-8zm4 4h.01M6 18h.01M16 6h.01M16 18h.01',
    rocket: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c1.26-1.5.5-3.74-2-5zm10-9c1.5-1.26 2-5 2-5s-3.74.5-5 2c-1.26 1.5-.5-3.74 2 5zM12 19v3',
    chart: 'M18 20V10M12 20V4M6 20v-6',
    bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
    menu: 'M3 12h18M3 6h18M3 18h18',
    chevronDown: 'M6 9l6 6 6-6',
    target: 'M12 22c-5.5 0-10-4.5-10-10S7 2 12 2s10 4.5 10 10-4.5 10-10 10zm0-8a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm0-10a4 4 0 1 1 0 8 4 4 0 0 1 0-8z',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    rocket2: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c1.26-1.5.5-3.74-2-5zm10-9c1.5-1.26 2-5 2-5s-3.74.5-5 2c-1.26 1.5-.5-3.74 2 5zM12 19v3',
    shield2: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    rocket2b: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c1.26-1.5.5-3.74-2-5zm10-9c1.5-1.26 2-5 2-5s-3.74.5-5 2c-1.26 1.5-.5-3.74 2 5zM12 19v3',
    lock: 'M3 11h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-11zM7 11V7a5 5 0 0 1 10 0v4',
    x: 'M18 6L6 18M6 6l12 12',
    check: 'M20 6L9 17l-5-5',
    plus: 'M12 5v14M5 12h14',
    search: 'M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z',
    activity: 'M22 12H18M15 21V12M9 3v9M6 12H2',
    wallet: 'M21 12V7H5a2 2 0 0 1 0-4h14v4M3 5v14a2 2 0 0 0 2 2h16v-6M3 19a2 2 0 0 0 2 2h16',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  };
  const path = paths[name] || paths.dashboard;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
}

// ============================================
// COMPONENT BUILDERS
// ============================================
function StatCard({ label, value, trend, icon, color = 'primary' }) {
  const colors = { primary: '#d6781e', success: '#10b981', warning: '#f59e0b', danger: '#f43f5e', info: '#0ea5e9', violet: '#8b5cf6' };
  const clr = colors[color] || colors.primary;
  return `
    <div class="card stat-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <p style="font-size:0.6875rem;text-transform:uppercase;letter-spacing:0.05em;color:#9ca3af;">${label}</p>
          <p style="font-family:'JetBrains Mono',monospace;font-size:2rem;font-weight:700;margin-top:4px;">${value}</p>
          ${trend ? `<p style="font-size:0.8125rem;margin-top:8px;display:flex;align-items:center;gap:4px;color:${trend.up ? '#10b981' : '#f43f5e'};"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> ${trend.value}</p>` : ''}
        </div>
        <div style="width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,${colors[color]},${colors[color]});">${ic(icon, 24)}</div>
      </div>
    </div>
  `;
}

function ChartCard({ title, subtitle, canvasId, height = 300 }) {
  return `
    <div class="card card-elevated">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
        <div>
          <h3 style="font-size:1.0625rem;font-weight:600;">${title}</h3>
          ${subtitle ? `<p style="font-size:0.8125rem;color:#9ca3af;">${subtitle}</p>` : ''}
        </div>
      </div>
      <div style="position:relative;width:100%;height:${height}px;"><canvas id="${canvasId}"></canvas></div>
    </div>
  `;
}

function SidebarLink({ id, icon, label, active, badge }) {
  return `<a href="#" class="sidebar-link ${active ? 'sidebar-link-active' : ''}" onclick="navigate('${id}');return false;">${ic(icon, 20)}<span>${label}</span>${badge ? `<span class="badge badge-info">${badge}</span>` : ''}</a>`;
}

// ============================================
// CHART DEFAULTS
// ============================================
const chartDefaults = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1c1c1c', borderColor: '#2d2d2d', borderWidth: 1, padding: 12, titleFont: { size: 13 }, bodyFont: { size: 12, family: 'JetBrains Mono' } } },
  scales: { x: { grid: { color: '#2d2d2d', drawBorder: false }, ticks: { color: '#6b7280', maxTicksLimit: 8 } }, y: { grid: { color: '#2d2d2d', drawBorder: false }, ticks: { color: '#6b7280', callback: v => v >= 1000 ? (v/1000).toFixed(1)+'k' : v } } },
  interaction: { mode: 'index', intersect: false },
};

function gradient(ctx, color) { const grad = ctx.createLinearGradient(0,0,0,300); grad.addColorStop(0, color+'40'); grad.addColorStop(1, color+'00'); return grad; }

// ============================================
// STATE
// ============================================
const state = {
  currentView: 'dashboard',
  sidebarOpen: false,
  user: { name: 'Operator', role: 'Administrator', avatar: 'OP' },
  sseClient: null,
  charts: {},
  data: {
    stats: { activeCampaigns: 12, totalInfections: 147328, totalExfiltrated: 487.3, activeSessions: 342, revenue24h: 47200, conversionRate: 2.3, avgRansom: 47200, threatLevel: 'HIGH' },
    campaigns: [], systems: [], recentActivity: [],
  }
};

// ============================================
// SSE CLIENT
// ============================================
class SSEClient {
  constructor(options = {}) {
    this.url = options.url || '/api/realtime/events';
    this.onMessage = options.onMessage || (() => {});
    this.onConnect = options.onConnect || (() => {});
    this.onDisconnect = options.onDisconnect || (() => {});
    this.onError = options.onError || (() => {});
    this.eventSource = null;
    this.retryCount = 0;
    this.maxRetries = 10;
    this.isConnected = false;
  }
  connect() {
    if (this.eventSource) return;
    try {
      this.eventSource = new EventSource(this.url);
      this.eventSource.onopen = () => { this.isConnected = true; this.retryCount = 0; this.onConnect(); };
      this.eventSource.onmessage = (e) => { try { this.onMessage(JSON.parse(e.data)); } catch {} };
      this.eventSource.onerror = () => { this.isConnected = false; this.onError(); this.scheduleReconnect(); };
    } catch (e) { this.scheduleReconnect(); }
  }
  scheduleReconnect() { if (this.retryCount >= this.maxRetries) return; this.retryCount++; setTimeout(() => { if (!this.isConnected) this.connect(); }, Math.min(3000 * Math.pow(1.5, this.retryCount - 1), 30000)); }
  disconnect() { if (this.eventSource) { this.eventSource.close(); this.eventSource = null; } this.isConnected = false; this.onDisconnect(); }
}

// ============================================
// RENDER FUNCTIONS
// ============================================
function ic(name, size = 20) {
  const paths = { dashboard: 'M3 3h7v7H3V3zm11 0h7v7h-7V3zm0 11H3v7h7v-7zm11 0h7v-7h-7z', server: 'M2 2h20v8H2V2zm0 12h20v8H2v-8zm4 4h.01M6 18h.01M16 6h.01M16 18h.01', rocket: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c1.26-1.5.5-3.74-2-5zm10-9c1.5-1.26 2-5 2-5s-3.74.5-5 2c-1.26 1.5-.5-3.74 2 5zM12 19v3', chart: 'M18 20V10M12 20V4M6 20v-6', bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0', menu: 'M3 12h18M3 6h18M3 18h18', chevronDown: 'M6 9l6 6 6-6', target: 'M12 22c-5.5 0-10-4.5-10-10S7 2 12 2s10 4.5 10 10-4.5 10-10 10zm0-8a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm0-10a4 4 0 1 1 0 8 4 4 0 0 1 0-8z', shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', rocket2: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c1.26-1.5.5-3.74-2-5zm10-9c1.5-1.26 2-5 2-5s-3.74.5-5 2c-1.26 1.5-.5-3.74 2 5zM12 19v3', shield2: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75', lock: 'M3 11h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-11zM7 11V7a5 5 0 0 1 10 0v4', x: 'M18 6L6 18M6 6l12 12', check: 'M20 6L9 17l-5-5', plus: 'M12 5v14M5 12h14', search: 'M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z', activity: 'M22 12H18M15 21V12M9 3v9M6 12H2', wallet: 'M21 12V7H5a2 2 0 0 1 0-4h14v4M3 5v14a2 2 0 0 0 2 2h16v-6M3 19a2 2 0 0 0 2 2h16', download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3', activity2: 'M22 12H18M15 21V12M9 3v9M6 12H2' };
  const path = paths[name] || paths.dashboard;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
}

function formatNumber(n) { return (n ?? 0).toLocaleString(); }
const formatCurrency = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n ?? 0);
const formatCompact = (n) => { if (!n) return '0'; if (n >= 1e9) return (n/1e9).toFixed(1)+'B'; if (n >= 1e6) return (n/1e6).toFixed(1)+'M'; if (n >= 1e3) return (n/1e3).toFixed(1)+'K'; return String(n); };

function ic(name, size = 20) {
  const paths = { dashboard: 'M3 3h7v7H3V3zm11 0h7v7h-7V3zm0 11H3v7h7v-7zm11 0h7v-7h-7z', server: 'M2 2h20v8H2V2zm0 12h20v8H2v-8zm4 4h.01M6 18h.01M16 6h.01M16 18h.01', rocket: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c1.26-1.5.5-3.74-2-5zm10-9c1.5-1.26 2-5 2-5s-3.74.5-5 2c-1.26 1.5-.5-3.74 2 5zM12 19v3', chart: 'M18 20V10M12 20V4M6 20v-6', bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0', menu: 'M3 12h18M3 6h18M3 18h18', chevronDown: 'M6 9l6 6 6-6', target: 'M12 22c-5.5 0-10-4.5-10-10S7 2 12 2s10 4.5 10 10-4.5 10-10 10zm0-8a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm0-10a4 4 0 1 1 0 8 4 4 0 0 1 0-8z', shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', rocket2: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c1.26-1.5.5-3.74-2-5zm10-9c1.5-1.26 2-5 2-5s-3.74.5-5 2c-1.26 1.5-.5-3.74 2 5zM12 19v3', shield2: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75', lock: 'M3 11h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-11zM7 11V7a5 5 0 0 1 10 0v4', x: 'M18 6L6 18M6 6l12 12', check: 'M20 6L9 17l-5-5', plus: 'M12 5v14M5 12h14', search: 'M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z', activity: 'M22 12H18M15 21V12M9 3v9M6 12H2', wallet: 'M21 12V7H5a2 2 0 0 1 0-4h14v4M3 5v14a2 2 0 0 0 2 2h16v-6M3 19a2 2 0 0 0 2 2h16', download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3', activity2: 'M22 12H18M15 21V12M9 3v9M6 12H2' };
  const path = paths[name] || paths.dashboard;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
}

// ============================================
// RENDER FUNCTIONS
// ============================================
function renderApp() {
  document.getElementById('app').innerHTML = `
    <style>${STYLES}</style>
    <div class="app-layout">
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
          <div style="display:flex;align-items:center;gap:12px;">
            <div class="avatar" style="background:linear-gradient(135deg,#d6781e,#e09542);">${ic('target', 24)}</div>
            <div><h2 style="font-size:1.25rem;font-weight:700;">Chaos C2</h2><p style="font-size:0.75rem;color:#9ca3af;">v3.2.1 • Live</p></div>
          </div>
        </div>
        <nav class="sidebar-nav" id="sidebar-nav"></nav>
        <div class="sidebar-footer">
          <div style="display:flex;align-items:center;gap:12px;padding:16px;border-top:1px solid #2d2d2d;">
            <div class="w-2 h-2 rounded-full bg-success" id="conn-indicator"></div>
            <div><p style="font-size:0.6875rem;font-weight:500;color:#9ca3af;">Connection</p><p id="conn-status" style="font-size:0.6875rem;color:#9ca3af;">Connecting...</p></div>
          </div>
        </div>
      </aside>
      <div class="sidebar-overlay" id="sidebar-overlay" onclick="toggleSidebar()"></div>
      <main class="main-content">
        <header class="topbar">
          <div style="display:flex;align-items:center;gap:16px;"><button class="btn btn-ghost btn-icon" onclick="toggleSidebar()" aria-label="Menu">${ic('menu', 24)}</button><h1 id="page-title" style="font-size:1.5rem;font-weight:700;">Dashboard</h1></div>
          <div style="display:flex;align-items:center;gap:12px;">
            <div class="dropdown"><button class="btn btn-ghost btn-icon" onclick="toggleDropdown('notif-dropdown')">${ic('bell', 22)}</button><div class="dropdown-menu" id="notif-dropdown" style="width:360px;right:0;"><div style="padding:12px;border-bottom:1px solid #2d2d2d;"><h4 style="font-size:0.8125rem;font-weight:600;">Notifications</h4></div><div class="max-h-96 overflow-auto" id="notifications-list"></div><div style="padding:12px;border-top:1px solid #2d2d2d;"><button class="btn btn-ghost btn-sm" style="width:100%">View All</button></div></div></div>
            <div class="dropdown"><button class="btn btn-ghost" onclick="toggleDropdown('user-dropdown')" style="gap:8px;"><div class="avatar avatar-sm" style="background:linear-gradient(135deg,#d6781e,#e09542);">${state.user.avatar}</div><span style="font-size:0.8125rem;font-weight:500;">${state.user.name}</span>${ic('chevronDown', 16)}</button><div class="dropdown-menu" id="user-dropdown" style="right:0;min-width:200px;"><div style="padding:12px;border-bottom:1px solid #2d2d2d;"><p style="font-weight:600;">${state.user.name}</p><p style="font-size:0.75rem;color:#9ca3af;">${state.user.role}</p></div><div class="dropdown-item" onclick="navigate('settings')">${ic('settings',16)} Settings</div><div style="height:1px;background:#2d2d2d;margin:8px 0;"></div><div class="dropdown-item" style="color:#f43f5e;" onclick="logout()">${ic('lock',16)} Logout</div></div></div>
          </div>
        </header>
        <div class="page-content" id="page-content"></div>
      </main>
    </div>
    <div id="modals-container"></div>
  `;
  document.getElementById('design-system-styles').textContent = STYLES;
}

function renderSidebar() {
  const items = [
    { id: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
    { id: 'campaigns', icon: 'rocket', label: 'Campaigns', badge: '12' },
    { id: 'systems', icon: 'server', label: 'Systems', badge: '342' },
    { id: 'affiliates', icon: 'users', label: 'Affiliates', badge: '87' },
    { id: 'negotiations', icon: 'activity', label: 'Negotiations', badge: '23' },
    { id: 'analytics', icon: 'chart', label: 'Analytics' },
    { id: 'settings', icon: 'settings', label: 'Settings' },
  ];
  document.getElementById('sidebar-nav').innerHTML = items.map(item => `
    <a href="#" class="sidebar-link ${state.currentView === item.id ? 'sidebar-link-active' : ''}" onclick="navigate('${item.id}');return false;">${ic(item.icon, 20)}<span>${item.label}</span>${item.badge ? `<span class="badge badge-info">${item.badge}</span>` : ''}</a>
  `).join('');
}

function StatCard({ label, value, trend, icon, color = 'primary' }) {
  const colors = { primary: '#d6781e', success: '#10b981', warning: '#f59e0b', danger: '#f43f5e', info: '#0ea5e9', violet: '#8b5cf6' };
  const clr = colors[color] || colors.primary;
  return `
    <div class="card stat-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <p style="font-size:0.6875rem;text-transform:uppercase;letter-spacing:0.05em;color:#9ca3af;">${label}</p>
          <p style="font-family:'JetBrains Mono',monospace;font-size:2rem;font-weight:700;margin-top:4px;">${value}</p>
          ${trend ? `<p style="font-size:0.8125rem;margin-top:8px;display:flex;align-items:center;gap:4px;color:${trend.up ? '#10b981' : '#f43f5e'};"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> ${trend.value}</p>` : ''}
        </div>
        <div style="width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,${colors[color]},${colors[color]});">${ic(icon, 24)}</div>
      </div>
    </div>
  `;
}

function ChartCard({ title, subtitle, canvasId, height = 300 }) {
  return `<div class="card card-elevated"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;"><div><h3 style="font-size:1.0625rem;font-weight:600;">${title}</h3>${subtitle ? `<p style="font-size:0.8125rem;color:#9ca3af;">${subtitle}</p>` : ''}</div></div><div style="position:relative;width:100%;height:${height}px;"><canvas id="${canvasId}"></canvas></div></div>`;
}

function renderDashboard() {
  const s = state.data.stats;
  return `
    <div class="fade-in">
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:24px;margin-bottom:32px;">
        ${StatCard({ label: 'Active Campaigns', value: s.activeCampaigns, trend: { up: true, value: '+3 this week' }, icon: 'rocket', color: 'primary' })}
        ${StatCard({ label: 'Total Infections', value: (s.totalInfections/1000).toFixed(1)+'K', trend: { up: true, value: '+12.5%' }, icon: 'server', color: 'info' })}
        ${StatCard({ label: 'Data Exfiltrated', value: s.totalExfiltrated + ' TB', trend: { up: true, value: '+8.2%' }, icon: 'download', color: 'success' })}
        ${StatCard({ label: 'Active Sessions', value: s.activeSessions, trend: { up: true, value: '+12' }, icon: 'activity', color: 'warning' })}
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:24px;margin-bottom:32px;">
        ${StatCard({ label: 'Revenue (24h)', value: '$' + (s.revenue24h/1000).toFixed(1)+'K', trend: { up: true, value: '+18.5%' }, icon: 'wallet', color: 'success' })}
        ${StatCard({ label: 'Conversion Rate', value: s.conversionRate + '%', trend: { up: false, value: '-0.3%' }, icon: 'target', color: 'violet' })}
        ${StatCard({ label: 'Avg Ransom', value: '$' + (s.avgRansom/1000).toFixed(1)+'K', trend: { up: true, value: '+5.2%' }, icon: 'target', color: 'violet' })}
        ${StatCard({ label: 'Threat Level', value: s.threatLevel, trend: null, icon: 'shield', color: 'danger' })}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px;">
        ${ChartCard({ title: 'Infections (24h)', subtitle: 'Real-time infection rate', canvasId: 'infections-chart', height: 300 })}
        ${ChartCard({ title: 'Revenue (7d)', subtitle: 'Daily revenue tracking', canvasId: 'revenue-chart', height: 300 })}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px;">
        ${ChartCard({ title: 'Geographic Distribution', subtitle: 'Top countries by infections', canvasId: 'geo-chart', height: 300 })}
        ${ChartCard({ title: 'Ransom Amount Distribution', subtitle: 'Distribution of ransom demands', canvasId: 'ransom-chart', height: 300 })}
      </div>
      <div class="card card-elevated"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;"><h3 style="font-size:1.0625rem;font-weight:600;">Recent Activity</h3><button class="btn btn-ghost btn-sm">View All</button></div><div id="activity-list" style="max-height:400px;overflow:auto;"></div></div>
    </div>
  `;
}

function renderCampaigns() { return `<div class="fade-in"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;"><h2 style="font-size:1.5rem;font-weight:700;">Campaigns</h2><button class="btn btn-primary" onclick="openCreateCampaignModal()">${ic('plus', 18)} New Campaign</button></div><div id="campaigns-table"></div></div>`; }
function renderSystems() { return `<div class="fade-in"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;"><h2 style="font-size:1.5rem;font-weight:700;">Infected Systems</h2><div style="display:flex;gap:8px;"><input type="text" class="input" placeholder="Search systems..." style="width:300px;" id="systems-search"><button class="btn btn-secondary" onclick="renderSystemsTable()">${ic('refresh', 18)} Refresh</button></div></div><div id="systems-table"></div></div>`; }
function renderAffiliates() { return `<div class="fade-in"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;"><h2 style="font-size:1.5rem;font-weight:700;">Affiliates</h2><button class="btn btn-primary" onclick="openCreateAffiliateModal()">${ic('plus', 18)} Add Affiliate</button></div><div id="affiliates-table"></div></div>`; }
function renderNegotiations() { return `<div class="fade-in"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;"><h2 style="font-size:1.5rem;font-weight:700;">Negotiations</h2><span class="badge badge-warning">23 Active</span></div><div id="negotiations-list"></div></div>`; }
function renderAnalytics() { return `<div class="fade-in"><h2 style="font-size:1.5rem;font-weight:700;margin-bottom:24px;">Analytics</h2><div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px;">${ChartCard({ title: 'Infection Timeline', subtitle: '30-day infection trend', canvasId: 'timeline-chart', height: 350 })}${ChartCard({ title: 'OS Distribution', subtitle: 'Operating system breakdown', canvasId: 'os-chart', height: 350 })}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px;">${ChartCard({ title: 'Encryption Types', subtitle: 'Algorithm distribution', canvasId: 'encryption-chart', height: 350 })}${ChartCard({ title: 'Payment Methods', subtitle: 'Crypto payment preferences', canvasId: 'payment-chart', height: 350 })}</div></div>`; }
function renderSettings() { return `<div style="max-width:800px;"><h2 style="font-size:1.5rem;font-weight:700;margin-bottom:24px;">Settings</h2><div class="card"><h3 style="font-size:1.0625rem;font-weight:600;margin-bottom:20px;">Profile</h3><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;"><div><label style="font-size:0.75rem;color:#9ca3af;">Name</label><input class="input" style="margin-top:4px;" value="${state.user.name}"></div><div><label style="font-size:0.75rem;color:#9ca3af;">Role</label><input class="input" style="margin-top:4px;" value="${state.user.role}" disabled></div><div><label style="font-size:0.75rem;color:#9ca3af;">Email</label><input class="input" style="margin-top:4px;" type="email" placeholder="operator@chaosc2.local"></div><div><label style="font-size:0.75rem;color:#9ca3af;">API Key</label><div style="display:flex;gap:8px;"><input class="input" style="flex:1;" value="ck_live_..." disabled><button class="btn btn-secondary btn-sm">Regenerate</button></div></div></div></div><div class="card" style="margin-top:24px;"><h3 style="font-size:1.0625rem;font-weight:600;margin-bottom:20px;">Security</h3><div style="display:flex;align-items:center;justify-content:space-between;padding:16px 0;border-bottom:1px solid #2d2d2d;"><div><p style="font-weight:500;">Two-Factor Authentication</p><p style="font-size:0.8125rem;color:#9ca3af;">Add an extra layer of security</p></div><label style="position:relative;width:48px;height:28px;"><input type="checkbox" checked style="opacity:0;width:0;height:0;"><span style="position:absolute;inset:0;background:#2d2d2d;border-radius:28px;transition:250ms ease;cursor:pointer;"></span></label></div><div style="display:flex;align-items:center;justify-content:space-between;padding:16px 0;border-bottom:1px solid #2d2d2d;"><div><p style="font-weight:500;">Session Timeout</p><p style="font-size:0.8125rem;color:#9ca3af;">Auto-logout after inactivity</p></div><select class="input" style="width:auto;"><option>30 minutes</option><option selected>1 hour</option><option>4 hours</option><option>24 hours</option></select></div><div style="display:flex;align-items:center;justify-content:space-between;padding:16px 0;"><div><p style="font-weight:500;">API Access Logs</p><p style="font-size:0.8125rem;color:#9ca3af;">Log all API requests</p></div><label style="position:relative;width:48px;height:28px;"><input type="checkbox" style="opacity:0;width:0;height:0;"><span style="position:absolute;inset:0;background:#2d2d2d;border-radius:28px;transition:250ms ease;cursor:pointer;"></span></label></div></div><div class="card" style="margin-top:24px;border-color:#f43f5e;"><h3 style="font-size:1.0625rem;font-weight:600;margin-bottom:20px;color:#f43f5e;">Danger Zone</h3><button class="btn btn-danger">Delete Account</button><p style="font-size:0.8125rem;color:#9ca3af;margin-top:12px;">This action is irreversible. All data will be permanently deleted.</p></div></div>`; }

function renderActivity() { return ''; }

// ============================================
// CHART INITIALIZATION
// ============================================
const chartColors = { primary: '#d6781e', success: '#10b981', warning: '#f59e0b', danger: '#f43f5e', info: '#0ea5e9', violet: '#8b5cf6', cyan: '#06b6d4' };
function gradient(ctx, color) { const grad = ctx.createLinearGradient(0,0,0,300); grad.addColorStop(0, color+'40'); grad.addColorStop(1, color+'00'); return grad; }

function initCharts() {
  const c = chartColors;
  // Infections
  new Chart(document.getElementById('infections-chart'), { ...{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1c1c1c', borderColor: '#2d2d2d', borderWidth: 1, padding: 12, titleFont: { size: 13 }, bodyFont: { size: 12, family: 'JetBrains Mono' } } }, scales: { x: { grid: { color: '#2d2d2d', drawBorder: false }, ticks: { color: '#6b7280', maxTicksLimit: 8 } }, y: { grid: { color: '#2d2d2d', drawBorder: false }, ticks: { color: '#6b7280', callback: v => v >= 1000 ? (v/1000).toFixed(1)+'k' : v } } }, interaction: { mode: 'index', intersect: false } }, type: 'line', data: { labels: Array.from({length: 24}, (_, i) => i+':00'), datasets: [{ label: 'Infections', data: Array.from({length: 24}, () => Math.floor(Math.random()*500)+100), borderColor: '#d6781e', backgroundColor: (ctx) => { const g = ctx.chart.ctx.createLinearGradient(0,0,0,300); g.addColorStop(0, '#d6781e40'); g.addColorStop(1, '#d6781e00'); return g; }, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 6 }] } });
  // Revenue
  new Chart(document.getElementById('revenue-chart'), { type: 'bar', data: { labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], datasets: [{ label: 'Revenue', data: [42000,38000,45000,52000,61000,48000,47200], backgroundColor: (ctx) => { const g = ctx.chart.ctx.createLinearGradient(0,0,0,300); g.addColorStop(0, '#10b98140'); g.addColorStop(1, '#10b98100'); return g; }, borderColor: '#10b981', borderWidth: 1, borderRadius: 8 }] } });
  // Geo
  new Chart(document.getElementById('geo-chart'), { type: 'doughnut', data: { labels: ['USA','Germany','UK','France','Canada','Others'], datasets: [{ data: [35,18,12,10,8,17], backgroundColor: ['#d6781e','#0ea5e9','#10b981','#f59e0b','#8b5cf6','#06b6d4'], borderWidth: 0, cutout: '65%' }] }, plugins: { legend: { position: 'right', labels: { boxWidth: 10, pointStyle: 'circle', padding: 20, font: { size: 12 } } } } });
  // Ransom
  new Chart(document.getElementById('ransom-chart'), { type: 'bar', data: { labels: ['<$10K','$10K-$50K','$50K-$100K','$100K-$500K','>$500K'], datasets: [{ label: 'Campaigns', data: [45,32,18,8,3], backgroundColor: (ctx) => { const g = ctx.chart.ctx.createLinearGradient(0,0,0,300); g.addColorStop(0, '#8b5cf640'); g.addColorStop(1, '#8b5cf600'); return g; }, borderColor: '#8b5cf6', borderWidth: 1, borderRadius: 8 }] }, indexAxis: 'y' });
}

function initAnalyticsCharts() {
  new Chart(document.getElementById('timeline-chart'), { type: 'line', data: { labels: Array.from({length: 30}, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (29-i)); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }), datasets: [{ label: 'Infections', data: Array.from({length: 30}, () => Math.floor(Math.random()*1000)+200), borderColor: '#d6781e', backgroundColor: (ctx) => { const g = ctx.chart.ctx.createLinearGradient(0,0,0,300); g.addColorStop(0, '#d6781e40'); g.addColorStop(1, '#d6781e00'); return g; }, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 6 }] } });
  new Chart(document.getElementById('os-chart'), { type: 'doughnut', data: { labels: ['Windows 10','Windows 11','Linux','macOS','Other'], datasets: [{ data: [45,25,15,10,5], backgroundColor: ['#d6781e','#0ea5e9','#10b981','#f59e0b','#8b5cf6'], borderWidth: 0, cutout: '60%' }] }, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, pointStyle: 'circle', padding: 20 } } } });
  new Chart(document.getElementById('encryption-chart'), { type: 'bar', indexAxis: 'y', data: { labels: ['AES-256','ChaCha20','RSA-4096','Hybrid','Custom'], datasets: [{ label: 'Usage', data: [40,25,20,10,5], backgroundColor: (ctx) => { const g = ctx.chart.ctx.createLinearGradient(0,0,0,300); g.addColorStop(0, '#8b5cf640'); g.addColorStop(1, '#8b5cf600'); return g; }, borderColor: '#8b5cf6', borderWidth: 1, borderRadius: 8 }] }, indexAxis: 'y' });
  new Chart(document.getElementById('payment-chart'), { type: 'pie', data: { labels: ['BTC','ETH','USDT','XMR','Other'], datasets: [{ data: [45,25,15,10,5], backgroundColor: ['#d6781e','#0ea5e9','#10b981','#f59e0b','#8b5cf6'], borderWidth: 0 }] }, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, pointStyle: 'circle', padding: 20 } } } });
}

// ============================================
// NAVIGATION
// ============================================
function navigate(view) {
  state.currentView = view;
  const content = document.getElementById('page-content');
  const title = document.getElementById('page-title');
  const titles = { dashboard: 'Dashboard', campaigns: 'Campaigns', systems: 'Systems', affiliates: 'Affiliates', negotiations: 'Negotiations', analytics: 'Analytics', settings: 'Settings' };
  if (title) title.textContent = titles[view] || 'Dashboard';
  
  const renderers = { dashboard: renderDashboard, campaigns: renderCampaigns, systems: renderSystems, affiliates: renderAffiliates, negotiations: renderNegotiations, analytics: renderAnalytics, settings: renderSettings };
  content.innerHTML = renderers[view] ? renderers[view]() : renderDashboard();
  
  document.querySelectorAll('.sidebar-link').forEach(el => { el.classList.toggle('sidebar-link-active', el.getAttribute('onclick')?.includes(view)); });
  
  if (view === 'dashboard') setTimeout(initCharts, 100);
  else if (view === 'analytics') setTimeout(initAnalyticsCharts, 100);
  else if (view === 'campaigns') renderCampaignsTable();
  else if (view === 'systems') renderSystemsTable();
  else if (view === 'affiliates') renderAffiliatesTable();
  else if (view === 'negotiations') renderNegotiationsList();
  
  closeSidebar();
}

function toggleSidebar() { state.sidebarOpen = !state.sidebarOpen; document.getElementById('sidebar').classList.toggle('open', state.sidebarOpen); document.getElementById('sidebar-overlay').classList.toggle('open', state.sidebarOpen); }
function closeSidebar() { state.sidebarOpen = false; document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('open'); }
function toggleDropdown(id) { document.querySelectorAll('.dropdown').forEach(d => { if (d.id !== id) d.classList.remove('open'); }); document.getElementById(id)?.parentElement?.classList.toggle('open'); }
function logout() { if (confirm('Log out?')) window.location.href = '/logout'; }
function openCreateCampaignModal() { alert('Create campaign modal - implement'); }
function openCreateAffiliateModal() { alert('Create affiliate modal - implement'); }
function renderCampaignsTable() { document.getElementById('campaigns-table').innerHTML = '<div class="card"><p style="padding:48px;text-align:center;color:#9ca3af;">Campaigns table - implement</p></div>'; }
function renderSystemsTable() { document.getElementById('systems-table').innerHTML = '<div class="card"><p style="padding:48px;text-align:center;color:#9ca3af;">Systems table - implement</p></div>'; }
function renderAffiliatesTable() { document.getElementById('affiliates-table').innerHTML = '<div class="card"><p style="padding:48px;text-align:center;color:#9ca3af;">Affiliates table - implement</p></div>'; }
function renderNegotiationsList() { document.getElementById('negotiations-list').innerHTML = '<div class="card"><p style="padding:48px;text-align:center;color:#9ca3af;">Negotiations list - implement</p></div>'; }

// ============================================
// SSE
// ============================================
function initSSE() {
  state.sseClient = new SSEClient({
    url: '/api/realtime/events',
    onMessage: (data) => { if (data.type === 'stats') { Object.assign(state.data.stats, data.payload); renderStats(); } },
    onConnect: () => { const i = document.getElementById('conn-indicator'); const s = document.getElementById('conn-status'); if (i) i.className = 'w-2 h-2 rounded-full bg-success'; if (s) s.textContent = 'Live'; },
    onDisconnect: () => { const i = document.getElementById('conn-indicator'); const s = document.getElementById('conn-status'); if (i) i.className = 'w-2 h-2 rounded-full bg-danger'; if (s) s.textContent = 'Disconnected'; },
    onError: (err) => console.warn('SSE error:', err)
  });
  state.sseClient.connect();
}

function renderStats() {
  const s = state.data.stats;
  document.querySelectorAll('.stat-card').forEach((el, i) => {
    const vals = [state.data.stats.activeCampaigns, (state.data.stats.totalInfections/1000).toFixed(1)+'K', state.data.stats.totalExfiltrated+' TB', state.data.stats.activeSessions];
    if (vals[i] !== undefined) el.querySelector('p:nth-of-type(2)').textContent = vals[i];
  });
}

// ============================================
// INIT
// ============================================
function init() {
  renderApp();
  renderSidebar();
  renderSidebar();
  navigate('dashboard');
  initSSE();
  
  // Expose globals
  window.toggleSidebar = () => { state.sidebarOpen = !state.sidebarOpen; document.getElementById('sidebar').classList.toggle('open', state.sidebarOpen); document.getElementById('sidebar-overlay').classList.toggle('open', state.sidebarOpen); };
  window.closeSidebar = () => { state.sidebarOpen = false; document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('open'); };
  window.navigate = navigate;
  window.toggleSidebar = () => { state.sidebarOpen = !state.sidebarOpen; document.getElementById('sidebar').classList.toggle('open', state.sidebarOpen); document.getElementById('sidebar-overlay').classList.toggle('open', state.sidebarOpen); };
  window.toggleDropdown = (id) => { document.querySelectorAll('.dropdown').forEach(d => { if (d.id !== id) d.classList.remove('open'); }); document.getElementById(id)?.parentElement?.classList.toggle('open'); };
  window.logout = () => { if (confirm('Log out?')) window.location.href = '/logout'; };
  window.ic = ic;
  
  document.addEventListener('click', (e) => { if (!e.target.closest('.dropdown')) document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open')); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { document.querySelectorAll('.dropdown, .modal-overlay.open').forEach(el => el.classList.remove('open')); closeSidebar(); } });
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }

// Export for debugging
window.__CHAOS_C2__ = { state, navigate, ic };