// vercel-dashboard/dashboard/shared/design-system.js
// Modern Design System - Shared Components & Utilities

export const theme = {
  colors: {
    // Core
    bg: '#050505',
    bgElevated: '#0d0d0d',
    surface: '#141414',
    surfaceHover: '#1c1c1c',
    border: '#2d2d2d',
    borderLight: '#3d3d3d',
    
    // Text
    text: '#ffffff',
    textMuted: '#9ca3af',
    textDim: '#6b7280',
    
    // Brand
    primary: '#d6781e',
    primaryHover: '#e09542',
    primaryLight: 'rgba(214,120,30,0.15)',
    primaryGlow: 'rgba(214,120,30,0.3)',
    
    // Semantic
    success: '#10b981',
    successLight: 'rgba(16,185,129,0.15)',
    warning: '#f59e0b',
    warningLight: 'rgba(245,158,11,0.15)',
    danger: '#f43f5e',
    dangerLight: 'rgba(244,63,94,0.15)',
    info: '#0ea5e9',
    infoLight: 'rgba(14,165,233,0.15)',
    violet: '#8b5cf6',
    violetLight: 'rgba(139,92,246,0.15)',
    cyan: '#06b6d4',
    cyanLight: 'rgba(6,182,212,0.15)',
    
    // Tier colors
    bronze: '#cd7f32',
    silver: '#c0c0c0',
    gold: '#ffd700',
    platinum: '#e5e4e2',
  },
  
  spacing: {
    xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px', xxl: '48px'
  },
  
  radius: {
    sm: '6px', md: '10px', lg: '14px', xl: '18px', full: '9999px'
  },
  
  shadows: {
    sm: '0 1px 2px rgba(0,0,0,0.3)',
    md: '0 4px 12px rgba(0,0,0,0.4)',
    lg: '0 12px 32px rgba(0,0,0,0.5)',
    glow: '0 0 24px rgba(214,120,30,0.2)',
    glowStrong: '0 0 48px rgba(214,120,30,0.3)',
  },
  
  transitions: {
    fast: '150ms ease',
    normal: '250ms ease',
    slow: '350ms ease',
  },
  
  typography: {
    fontSans: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    fontMono: "'JetBrains Mono', 'Fira Code', monospace",
    scale: {
      xs: '0.7rem', sm: '0.8125rem', base: '0.9375rem', 
      lg: '1.0625rem', xl: '1.25rem', '2xl': '1.5rem', 
      '3xl': '2rem', '4xl': '2.5rem'
    },
    weight: { normal: 400, medium: 500, semibold: 600, bold: 700 }
  },
  
  breakpoints: {
    sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1536px'
  }
};

// CSS Variables Generator
export function generateCSSVariables() {
  const css = [];
  const flatten = (obj, prefix = '') => {
    for (const [key, value] of Object.entries(obj)) {
      const name = prefix + key.replace(/([A-Z])/g, '-$1').toLowerCase();
      if (typeof value === 'object' && value !== null) {
        flatten(value, name + '-');
      } else {
        css.push(`  --${name}: ${value};`);
      }
    }
  };
  flatten(theme);
  return `:root {\n${css.join('\n')}\n}`;
}

// Component Base Styles (as CSS-in-JS strings for injection)
export const componentStyles = `
/* ===== DESIGN SYSTEM ===== */
${generateCSSVariables()}

* { box-sizing: border-box; margin: 0; padding: 0; }
html { font-size: 14px; -webkit-font-smoothing: antialiased; }
body { 
  font-family: var(--typography-font-sans); 
  background: var(--colors-bg); 
  color: var(--colors-text); 
  line-height: 1.6;
  min-height: 100vh;
}

/* Typography */
h1, h2, h3, h4, h5, h6 { font-weight: 600; line-height: 1.3; letter-spacing: -0.02em; }
h1 { font-size: var(--typography-scale-4xl); }
h2 { font-size: var(--typography-scale-3xl); }
h3 { font-size: var(--typography-scale-2xl); }
h4 { font-size: var(--typography-scale-xl); }
h5 { font-size: var(--typography-scale-lg); }
h6 { font-size: var(--typography-scale-base); }

.text-muted { color: var(--colors-text-muted); }
.text-dim { color: var(--colors-text-dim); }
.text-primary { color: var(--colors-primary); }
.text-success { color: var(--colors-success); }
.text-warning { color: var(--colors-warning); }
.text-danger { color: var(--colors-danger); }
.text-info { color: var(--colors-info); }

.font-mono { font-family: var(--typography-font-mono); }

/* Layout */
.container { width: 100%; max-width: 1440px; margin: 0 auto; padding: 0 var(--spacing-lg); }
.grid { display: grid; gap: var(--spacing-lg); }
.grid-2 { grid-template-columns: repeat(2, 1fr); }
.grid-3 { grid-template-columns: repeat(3, 1fr); }
.grid-4 { grid-template-columns: repeat(4, 1fr); }
.flex { display: flex; }
.flex-col { flex-direction: column; }
.items-center { align-items: center; }
.justify-between { justify-content: space-between; }
.gap-sm { gap: var(--spacing-sm); }
.gap-md { gap: var(--spacing-md); }
.gap-lg { gap: var(--spacing-lg); }

/* Responsive */
@media (max-width: 1024px) { .grid-4 { grid-template-columns: repeat(2, 1fr); } .grid-3 { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 640px) { .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; } }

/* ===== COMPONENTS ===== */

/* Button */
.btn { 
  display: inline-flex; align-items: center; justify-content: center; gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md); border-radius: var(--radius-md);
  font-size: var(--typography-scale-sm); font-weight: 500; line-height: 1.5;
  border: 1px solid transparent; cursor: pointer; transition: all var(--transitions-fast);
  white-space: nowrap; text-decoration: none;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-sm { padding: 4px 10px; font-size: 0.6875rem; }
.btn-lg { padding: var(--spacing-md) var(--spacing-xl); font-size: var(--typography-scale-base); }
.btn-icon { padding: var(--spacing-sm); }
.btn-primary { background: var(--colors-primary); color: #050505; border-color: var(--colors-primary); }
.btn-primary:hover:not(:disabled) { background: var(--colors-primary-hover); box-shadow: var(--shadows-glow); }
.btn-secondary { background: var(--colors-surface); color: var(--colors-text); border-color: var(--colors-border); }
.btn-secondary:hover:not(:disabled) { background: var(--colors-surface-hover); border-color: var(--colors-border-light); }
.btn-ghost { background: transparent; color: var(--colors-text-muted); border-color: transparent; }
.btn-ghost:hover:not(:disabled) { background: var(--colors-surface); color: var(--colors-text); }
.btn-danger { background: var(--colors-danger-light); color: var(--colors-danger); border-color: var(--colors-danger); }
.btn-danger:hover:not(:disabled) { background: var(--colors-danger); color: #fff; box-shadow: 0 0 16px var(--colors-danger-light); }
.btn-success { background: var(--colors-success-light); color: var(--colors-success); border-color: var(--colors-success); }
.btn-success:hover:not(:disabled) { background: var(--colors-success); color: #050505; }
.btn-outline { background: transparent; border-color: var(--colors-border); color: var(--colors-text); }
.btn-outline:hover:not(:disabled) { border-color: var(--colors-primary); color: var(--colors-primary); }

/* Card */
.card { 
  background: var(--colors-surface); border: 1px solid var(--colors-border); 
  border-radius: var(--radius-lg); padding: var(--spacing-lg);
  transition: all var(--transitions-normal);
}
.card:hover { border-color: var(--colors-border-light); }
.card-elevated { box-shadow: var(--shadows-md); }
.card-interactive { cursor: pointer; }
.card-interactive:hover { 
  border-color: var(--colors-primary); 
  box-shadow: var(--shadows-glow);
  transform: translateY(-2px);
}

/* Input */
.input { 
  width: 100%; background: var(--colors-bg); color: var(--colors-text);
  border: 1px solid var(--colors-border); border-radius: var(--radius-md);
  padding: var(--spacing-sm) var(--spacing-md); font-size: var(--typography-scale-sm);
  font-family: inherit; transition: all var(--transitions-fast);
}
.input::placeholder { color: var(--colors-text-dim); }
.input:focus { outline: none; border-color: var(--colors-primary); box-shadow: 0 0 0 3px var(--colors-primary-light); }
.input-error { border-color: var(--colors-danger); }
.input-error:focus { box-shadow: 0 0 0 3px var(--colors-danger-light); }
.input-lg { padding: var(--spacing-md) var(--spacing-lg); font-size: var(--typography-scale-base); }

/* Badge */
.badge { 
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 10px; border-radius: var(--radius-full);
  font-size: 0.625rem; font-weight: 600; letter-spacing: 0.02em;
  text-transform: uppercase;
}
.badge-primary { background: var(--colors-primary-light); color: var(--colors-primary); }
.badge-success { background: var(--colors-success-light); color: var(--colors-success); }
.badge-warning { background: var(--colors-warning-light); color: var(--colors-warning); }
.badge-danger { background: var(--colors-danger-light); color: var(--colors-danger); }
.badge-info { background: var(--colors-info-light); color: var(--colors-info); }
.badge-violet { background: var(--colors-violet-light); color: var(--colors-violet); }
.badge-tier-bronze { background: rgba(205,127,50,0.15); color: #cd7f32; }
.badge-tier-silver { background: rgba(192,192,192,0.15); color: #c0c0c0; }
.badge-tier-gold { background: rgba(255,215,0,0.15); color: #ffd700; }
.badge-tier-platinum { background: rgba(229,228,226,0.15); color: #e5e4e2; }
.badge-dot { padding: 0; width: 8px; height: 8px; border-radius: 50%; min-width: 8px; }

/* Avatar */
.avatar { 
  display: inline-flex; align-items: center; justify-content: center;
  width: 40px; height: 40px; border-radius: var(--radius-full);
  background: linear-gradient(135deg, var(--colors-primary), var(--colors-primary-hover));
  color: #050505; font-weight: 700; font-size: var(--typography-scale-sm);
  flex-shrink: 0;
}
.avatar-sm { width: 32px; height: 32px; font-size: 0.6875rem; }
.avatar-lg { width: 56px; height: 56px; font-size: var(--typography-scale-lg); }
.avatar-online::after { 
  content: ''; position: absolute; bottom: 2px; right: 2px; 
  width: 10px; height: 10px; background: var(--colors-success); 
  border: 2px solid var(--colors-bg); border-radius: 50%; 
}
.avatar-group { display: flex; }
.avatar-group .avatar { margin-left: -10px; border: 2px solid var(--colors-bg); }
.avatar-group .avatar:first-child { margin-left: 0; }

/* Table */
.table-wrap { overflow-x: auto; border-radius: var(--radius-lg); border: 1px solid var(--colors-border); }
.table { width: 100%; border-collapse: collapse; font-size: var(--typography-scale-sm); }
.table th { 
  text-align: left; padding: var(--spacing-md) var(--spacing-lg); 
  font-size: 0.625rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--colors-text-dim); background: var(--colors-bg); border-bottom: 1px solid var(--colors-border);
}
.table td { padding: var(--spacing-md) var(--spacing-lg); border-bottom: 1px solid var(--colors-border); color: var(--colors-text); }
.table tr:last-child td { border-bottom: none; }
.table-row-hover tbody tr { transition: background var(--transitions-fast); }
.table-row-hover tbody tr:hover { background: var(--colors-surface-hover); }
.table-striped tbody tr:nth-child(even) { background: rgba(255,255,255,0.02); }

/* Chart Container */
.chart-container { position: relative; width: 100%; }
.chart-container-sm { height: 200px; }
.chart-container-md { height: 300px; }
.chart-container-lg { height: 400px; }

/* Skeleton Loader */
.skeleton { background: linear-gradient(90deg, var(--colors-surface) 25%, var(--colors-surface-hover) 50%, var(--colors-surface) 75%); 
  background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: var(--radius-sm); }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
.skeleton-text { height: 1rem; margin-bottom: var(--spacing-sm); }
.skeleton-title { height: 1.5rem; width: 60%; margin-bottom: var(--spacing-md); }
.skeleton-card { height: 200px; border-radius: var(--radius-lg); }

/* Modal */
.modal-overlay { 
  position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center; padding: var(--spacing-lg);
  z-index: 1000; opacity: 0; visibility: hidden; transition: all var(--transitions-normal);
}
.modal-overlay.open { opacity: 1; visibility: visible; }
.modal { 
  background: var(--colors-surface); border: 1px solid var(--colors-border); 
  border-radius: var(--radius-xl); max-width: 560px; width: 100%; max-height: 90vh;
  display: flex; flex-direction: column; overflow: hidden;
  transform: scale(0.95); transition: transform var(--transitions-normal);
}
.modal-overlay.open .modal { transform: scale(1); }
.modal-header { padding: var(--spacing-lg); border-bottom: 1px solid var(--colors-border); display: flex; justify-content: space-between; align-items: center; }
.modal-title { font-size: var(--typography-scale-lg); font-weight: 600; }
.modal-close { background: none; border: none; color: var(--colors-text-muted); cursor: pointer; padding: var(--spacing-sm); border-radius: var(--radius-sm); }
.modal-close:hover { color: var(--colors-text); background: var(--colors-surface-hover); }
.modal-body { padding: var(--spacing-lg); overflow-y: auto; flex: 1; }
.modal-footer { padding: var(--spacing-lg); border-top: 1px solid var(--colors-border); display: flex; justify-content: flex-end; gap: var(--spacing-sm); }

/* Toast */
.toast-container { position: fixed; bottom: var(--spacing-xl); right: var(--spacing-xl); z-index: 2000; display: flex; flex-direction: column; gap: var(--spacing-sm); }
.toast { 
  display: flex; align-items: center; gap: var(--spacing-sm); padding: var(--spacing-md) var(--spacing-lg);
  background: var(--colors-surface); border: 1px solid var(--colors-border); border-radius: var(--radius-lg);
  box-shadow: var(--shadows-lg); animation: slideIn 0.3s ease; max-width: 400px;
}
.toast-success { border-left: 3px solid var(--colors-success); }
.toast-warning { border-left: 3px solid var(--colors-warning); }
.toast-danger { border-left: 3px solid var(--colors-danger); }
.toast-info { border-left: 3px solid var(--colors-info); }
@keyframes slideIn { from { opacity: 0; transform: translateX(100%); } to { opacity: 1; transform: translateX(0); } }

/* Dropdown */
.dropdown { position: relative; display: inline-block; }
.dropdown-menu { 
  position: absolute; top: 100%; right: 0; margin-top: var(--spacing-sm);
  background: var(--colors-surface); border: 1px solid var(--colors-border); 
  border-radius: var(--radius-lg); box-shadow: var(--shadows-lg); min-width: 200px;
  opacity: 0; visibility: hidden; transform: translateY(-8px); transition: all var(--transitions-fast);
  z-index: 100; padding: var(--spacing-sm);
}
.dropdown.open .dropdown-menu { opacity: 1; visibility: visible; transform: translateY(0); }
.dropdown-item { 
  display: flex; align-items: center; gap: var(--spacing-sm); padding: var(--spacing-sm) var(--spacing-md);
  color: var(--colors-text); border-radius: var(--radius-md); cursor: pointer; font-size: var(--typography-scale-sm);
  transition: background var(--transitions-fast); white-space: nowrap;
}
.dropdown-item:hover { background: var(--colors-surface-hover); }
.dropdown-divider { height: 1px; background: var(--colors-border); margin: var(--spacing-sm) 0; }

/* Tooltip */
.tooltip { position: relative; }
.tooltip::before { 
  content: attr(data-tooltip); position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%);
  background: var(--colors-text); color: var(--colors-bg); padding: 6px 10px; border-radius: var(--radius-sm);
  font-size: 0.6875rem; white-space: nowrap; opacity: 0; visibility: hidden; 
  transition: all var(--transitions-fast); z-index: 100; margin-bottom: 8px;
}
.tooltip:hover::before { opacity: 1; visibility: visible; }

/* Progress */
.progress { height: 6px; background: var(--colors-border); border-radius: var(--radius-full); overflow: hidden; }
.progress-bar { height: 100%; background: var(--colors-primary); border-radius: var(--radius-full); transition: width var(--transitions-slow); }
.progress-success .progress-bar { background: var(--colors-success); }
.progress-warning .progress-bar { background: var(--colors-warning); }
.progress-danger .progress-bar { background: var(--colors-danger); }

/* Tabs */
.tabs { display: flex; border-bottom: 1px solid var(--colors-border); gap: var(--spacing-sm); }
.tab { padding: var(--spacing-sm) var(--spacing-md); font-size: var(--typography-scale-sm); font-weight: 500; color: var(--colors-text-muted); border-radius: var(--radius-md) var(--radius-md) 0 0; cursor: pointer; transition: all var(--transitions-fast); border: 1px solid transparent; border-bottom: none; margin-bottom: -1px; }
.tab:hover { color: var(--colors-text); }
.tab.active { color: var(--colors-primary); background: var(--colors-bg); border-color: var(--colors-border); border-bottom-color: var(--colors-bg); }

/* Scrollbar */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: var(--colors-bg); }
::-webkit-scrollbar-thumb { background: var(--colors-border-light); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: var(--colors-text-dim); }

/* Focus Visible */
:focus-visible { outline: 2px solid var(--colors-primary); outline-offset: 2px; }

/* Animations */
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes bounce { 0%, 100% { transform: translateY(-5%); } 50% { transform: translateY(0); } }
.animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
.animate-spin { animation: spin 1s linear infinite; }
.animate-bounce { animation: bounce 1s infinite; }
.animate-fade-in { animation: fadeIn 0.3s ease-out; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
`;

// Utility Functions
export function formatNumber(n) { return (n ?? 0).toLocaleString(); }
export function formatCurrency(n, c = 'USD') { return new Intl.NumberFormat('en-US', { style: 'currency', currency: c, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n ?? 0); }
export function formatCompact(n) { if (!n) return '0'; if (n >= 1e9) return (n/1e9).toFixed(1)+'B'; if (n >= 1e6) return (n/1e6).toFixed(1)+'M'; if (n >= 1e3) return (n/1e3).toFixed(1)+'K'; return String(n); }
export function formatDate(iso) { return iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'; }
export function formatDateTime(iso) { return iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; }
export function timeAgo(iso) { if (!iso) return '—'; const d = Date.now() - new Date(iso).getTime(); const m = Math.floor(d/60000), h = Math.floor(d/3600000), dy = Math.floor(d/86400000); if (m < 1) return 'Just now'; if (m < 60) return m+'m ago'; if (h < 24) return h+'h ago'; return dy+'d ago'; }
export function cn(...classes) { return classes.filter(Boolean).join(' '); }
export function debounce(fn, ms) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; }
export function throttle(fn, ms) { let last = 0; return (...args) => { const now = Date.now(); if (now - last >= ms) { last = now; fn(...args); } }; }
`;