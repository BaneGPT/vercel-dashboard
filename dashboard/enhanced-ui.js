// Chaos C2 Dashboard - Enhanced UI & Charts Module
// Additional visualizations, themes, and interactive components

const EnhancedUI = {
  // ============================================================
  // ADDITIONAL CHART TYPES
  // ============================================================
  
  charts: {
    // Infection Timeline - Gantt-style visualization
    infectionTimeline: function(ctx, data) {
      return new Chart(ctx, {
        type: 'bar',
        data: {
          labels: data.map(d => d.victimId),
          datasets: [{
            label: 'Encryption Duration (min)',
            data: data.map(d => d.duration || Math.random() * 60),
            backgroundColor: (ctx) => {
              const value = ctx.raw;
              return value > 30 ? 'rgba(244,63,94,0.8)' : 
                     value > 15 ? 'rgba(245,158,11,0.8)' : 
                     'rgba(16,185,129,0.8)';
            },
            borderRadius: 4,
            maxBarThickness: 30
          }, {
            label: 'Files Encrypted',
            data: data.map(d => d.filesEncrypted || 0),
            type: 'line',
            borderColor: '#d6781e',
            backgroundColor: 'rgba(214,120,30,0.15)',
            yAxisID: 'y1',
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#d6781e'
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { 
              grid: { color: '#2d2d2d' },
              title: { display: true, text: 'Minutes', color: '#9ca3af' }
            },
            y1: { 
              type: 'linear', 
              position: 'right', 
              grid: { drawOnChartArea: false },
              title: { display: true, text: 'Files', color: '#9ca3af' }
            }
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  if (ctx.datasetIndex === 0)
                    return `Encryption: ${ctx.raw} min`;
                  return `Files: ${ctx.raw}`;
                }
              }
            }
          }
        }
      });
    },

    // Ransom Payment Funnel
    paymentFunnel: function(ctx, data) {
      const stages = [
        { label: 'Infected', value: data.totalInfections, color: '#d6781e' },
        { label: 'Note Viewed', value: data.notesViewed, color: '#f59e0b' },
        { label: 'Contacted', value: data.contacted, color: '#0ea5e9' },
        { label: 'Negotiated', value: data.negotiated, color: '#8b5cf6' },
        { label: 'Paid', value: data.paid, color: '#10b981' }
      ];
      
      return new Chart(ctx, {
        type: 'funnel',
        data: {
          labels: stages.map(s => s.label),
          datasets: [{
            data: stages.map(s => s.value),
            backgroundColor: stages.map(s => s.color + 'CC'),
            borderColor: stages.map(s => s.color),
            borderWidth: 2,
            gap: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const pct = ((ctx.raw / stages[0].value) * 100).toFixed(1);
                  return `${ctx.label}: ${ctx.raw} (${pct}%)`;
                }
              }
            },
            legend: { display: false }
          }
        }
      });
    },

    // File Type Radar - Multi-dimensional comparison
    fileTypeRadar: function(ctx, data) {
      const extensions = Object.keys(data).slice(0, 8);
      const campaigns = [...new Set(Object.values(data).flatMap(d => Object.keys(d)))];
      
      return new Chart(ctx, {
        type: 'radar',
        data: {
          labels: extensions.map(e => '.' + e),
          datasets: campaigns.map((campaign, i) => ({
            label: campaign,
            data: extensions.map(e => data[e]?.[campaign] || 0),
            backgroundColor: [
              'rgba(214,120,30,0.2)',
              'rgba(16,185,129,0.2)',
              'rgba(14,165,233,0.2)',
              'rgba(139,92,246,0.2)',
              'rgba(244,63,94,0.2)',
              'rgba(6,182,212,0.2)'
            ][i % 6],
            borderColor: [
              '#d6781e', '#10b981', '#0ea5e9', '#8b5cf6', '#f43f5e', '#06b6d4'
            ][i % 6],
            borderWidth: 2,
            pointBackgroundColor: [
              '#d6781e', '#10b981', '#0ea5e9', '#8b5cf6', '#f43f5e', '#06b6d4'
            ][i % 6],
            pointRadius: 4
          }))
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            r: {
              grid: { color: '#2d2d2d' },
              angleLines: { color: '#2d2d2d' },
              pointLabels: { color: '#9ca3af', font: { size: 11 } },
              ticks: { backdropColor: 'transparent', color: '#6b7280' }
            }
          },
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 12, pointStyle: 'circle' } }
          }
        }
      });
    },

    // Encryption Speed Distribution - Histogram
    encryptionSpeedHistogram: function(ctx, data) {
      const speeds = data.map(d => d.mbPerSecond || Math.random() * 100);
      const bins = 20;
      const max = Math.max(...speeds);
      const binWidth = max / bins;
      const histogram = new Array(bins).fill(0);
      
      speeds.forEach(s => {
        const idx = Math.min(Math.floor(s / binWidth), bins - 1);
        histogram[idx]++;
      });
      
      return new Chart(ctx, {
        type: 'bar',
        data: {
          labels: Array.from({length: bins}, (_, i) => `${(i * binWidth).toFixed(1)}-${((i+1) * binWidth).toFixed(1)}`),
          datasets: [{
            label: 'Infections',
            data: histogram,
            backgroundColor: 'rgba(214,120,30,0.6)',
            borderColor: '#d6781e',
            borderWidth: 1,
            borderRadius: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.raw} infections at ${ctx.label} MB/s`
              }
            }
          },
          scales: {
            x: { grid: { color: '#2d2d2d' }, title: { display: true, text: 'Count', color: '#9ca3af' } },
            y: { grid: { display: false }, title: { display: true, text: 'Encryption Speed (MB/s)', color: '#9ca3af' } }
          }
        }
      });
    },

    // Geographic Heatmap - World map visualization (using canvas)
    geoHeatmap: function(canvas, data) {
      const ctx = canvas.getContext('2d');
      const width = canvas.width = canvas.offsetWidth;
      const height = canvas.height = canvas.offsetHeight;
      
      // Simple geographic projection
      const projection = (lon, lat) => ({
        x: (lon + 180) * (width / 360),
        y: (90 - lat) * (height / 180)
      });
      
      // Draw base map (simplified)
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, width, height);
      
      // Draw grid
      ctx.strokeStyle = 'rgba(214,120,30,0.03)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      
      // Draw infections as pulsing dots
      const maxCount = Math.max(...Object.values(data).map(c => c.count || 0));
      data.forEach((country, iso) => {
        if (!country.coords) return;
        const { x, y } = projection(country.coords[0], country.coords[1]);
        const intensity = (country.count || 0) / maxCount;
        const radius = Math.max(4, intensity * 20);
        const hue = 30; // amber
        const saturation = 100;
        const lightness = 50 - intensity * 20;
        
        // Pulsing effect
        const pulse = 1 + 0.3 * Math.sin(Date.now() / 500);
        
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * pulse);
        gradient.addColorStop(0, `hsla(${hue}, ${saturation}%, ${lightness}%, 0.9)`);
        gradient.addColorStop(1, `hsla(${hue}, ${saturation}%, ${lightness}%, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius * pulse, 0, Math.PI * 2);
        ctx.fill();
        
        // Label for top countries
        if (intensity > 0.5) {
          ctx.fillStyle = '#d6781e';
          ctx.font = '10px Inter';
          ctx.textAlign = 'center';
          ctx.fillText(iso, x, y - radius - 4);
        }
      });
    },

    // Real-time Network Graph - Infection spread visualization
    networkGraph: function(canvas, nodes, edges) {
      const ctx = canvas.getContext('2d');
      const width = canvas.width = canvas.offsetWidth;
      const height = canvas.height = canvas.offsetHeight;
      
      // Force-directed layout simulation (simplified)
      const positions = {};
      nodes.forEach((node, i) => {
        const angle = (i / nodes.length) * Math.PI * 2;
        const radius = Math.min(width, height) * 0.35;
        positions[node.id] = {
          x: width/2 + Math.cos(angle) * radius,
          y: height/2 + Math.sin(angle) * radius,
          vx: 0, vy: 0
        };
      });
      
      // Run simulation steps
      for (let step = 0; step < 100; step++) {
        // Repulsion
        nodes.forEach((a, i) => {
          nodes.forEach((b, j) => {
            if (i >= j) return;
            const pa = positions[a.id], pb = positions[b.id];
            const dx = pa.x - pb.x;
            const dy = pa.y - pb.y;
            const dist = Math.sqrt(dx*dx + dy*dy) || 1;
            const force = 500 / (dist * dist);
            pa.vx += dx/dist * force;
            pa.vy += dy/dist * force;
            pb.vx -= dx/dist * force;
            pb.vy -= dy/dist * force;
          });
        });
        
        // Attraction (edges)
        edges.forEach(edge => {
          const pa = positions[edge.source], pb = positions[edge.target];
          if (!pa || !pb) return;
          const dx = pb.x - pa.x;
          const dy = pb.y - pa.y;
          const dist = Math.sqrt(dx*dx + dy*dy) || 1;
          const force = dist * 0.01;
          pa.vx += dx/dist * force;
          pa.vy += dy/dist * force;
          pb.vx -= dx/dist * force;
          pb.vy -= dy/dist * force;
        });
        
        // Apply with damping
        nodes.forEach(node => {
          const p = positions[node.id];
          p.x += p.vx * 0.5;
          p.y += p.vy * 0.5;
          p.vx *= 0.9;
          p.vy *= 0.9;
          
          // Constrain to canvas
          p.x = Math.max(50, Math.min(width-50, p.x));
          p.y = Math.max(50, Math.min(height-50, p.y));
        });
      }
      
      // Draw edges
      ctx.strokeStyle = 'rgba(214,120,30,0.2)';
      ctx.lineWidth = 1;
      edges.forEach(edge => {
        const pa = positions[edge.source], pb = positions[edge.target];
        if (!pa || !pb) return;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      });
      
      // Draw nodes
      nodes.forEach(node => {
        const p = positions[node.id];
        const isActive = node.status === 'active';
        const color = isActive ? '#10b981' : node.status === 'idle' ? '#f59e0b' : '#6b7280';
        const size = Math.max(8, (node.infections || 1) * 3);
        
        // Glow
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 2);
        gradient.addColorStop(0, color + 'CC');
        gradient.addColorStop(1, color + '00');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size * 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Node
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
        
        // Label
        ctx.fillStyle = '#e5e5e5';
        ctx.font = '9px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(node.label || node.id.slice(0, 8), p.x, p.y + size + 12);
      });
    }
  },

  // ============================================================
  // THEME SYSTEM
  // ============================================================
  
  themes: {
    // Current: Chaos Amber (default)
    chaos: {
      name: 'Chaos Amber',
      primary: '#d6781e',
      primaryLight: 'rgba(214,120,30,0.15)',
      surface: '#050505',
      surfaceElevated: '#0d0d0d',
      border: '#2d2d2d',
      text: '#e5e5e5',
      textMuted: '#9ca3af',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#f43f5e',
      info: '#0ea5e9',
      violet: '#8b5cf6',
      cyan: '#06b6d4'
    },
    
    // Alternative: Matrix Green
    matrix: {
      name: 'Matrix Green',
      primary: '#00ff41',
      primaryLight: 'rgba(0,255,65,0.15)',
      surface: '#000a00',
      surfaceElevated: '#001a00',
      border: '#003300',
      text: '#00ff41',
      textMuted: '#00aa22',
      success: '#00ff41',
      warning: '#ffff00',
      danger: '#ff0040',
      info: '#00ffff',
      violet: '#aa00ff',
      cyan: '#00ffff'
    },
    
    // Alternative: Midnight Blue
    midnight: {
      name: 'Midnight Blue',
      primary: '#3b82f6',
      primaryLight: 'rgba(59,130,246,0.15)',
      surface: '#020617',
      surfaceElevated: '#0f172a',
      border: '#1e293b',
      text: '#f1f5f9',
      textMuted: '#94a3b8',
      success: '#22c55e',
      warning: '#fbbf24',
      danger: '#ef4444',
      info: '#06b6d4',
      violet: '#a855f7',
      cyan: '#06b6d4'
    },
    
    // Alternative: Blood Red
    blood: {
      name: 'Blood Red',
      primary: '#dc2626',
      primaryLight: 'rgba(220,38,38,0.15)',
      surface: '#180000',
      surfaceElevated: '#2d0000',
      border: '#450a0a',
      text: '#fef2f2',
      textMuted: '#fca5a5',
      success: '#4ade80',
      warning: '#fbbf24',
      danger: '#f87171',
      info: '#60a5fa',
      violet: '#c084fc',
      cyan: '#22d3ee'
    },
    
    // Alternative: Monochrome
    mono: {
      name: 'Monochrome',
      primary: '#e5e5e5',
      primaryLight: 'rgba(229,229,229,0.1)',
      surface: '#0a0a0a',
      surfaceElevated: '#171717',
      border: '#262626',
      text: '#ffffff',
      textMuted: '#a3a3a3',
      success: '#a3a3a3',
      warning: '#d4d4d4',
      danger: '#ffffff',
      info: '#a3a3a3',
      violet: '#d4d4d4',
      cyan: '#a3a3a3'
    }
  },

  currentTheme: 'chaos',

  applyTheme: function(themeName) {
    const theme = this.themes[themeName] || this.themes.chaos;
    this.currentTheme = themeName;
    
    const root = document.documentElement;
    root.style.setProperty('--chaos-primary', theme.primary);
    root.style.setProperty('--chaos-primary-light', theme.primaryLight);
    root.style.setProperty('--chaos-surface', theme.surface);
    root.style.setProperty('--chaos-surface-elevated', theme.surfaceElevated);
    root.style.setProperty('--chaos-border', theme.border);
    root.style.setProperty('--chaos-text', theme.text);
    root.style.setProperty('--chaos-text-muted', theme.textMuted);
    root.style.setProperty('--chaos-success', theme.success);
    root.style.setProperty('--chaos-warning', theme.warning);
    root.style.setProperty('--chaos-danger', theme.danger);
    root.style.setProperty('--chaos-info', theme.info);
    root.style.setProperty('--chaos-violet', theme.violet);
    root.style.setProperty('--chaos-cyan', theme.cyan);
    
    // Update Tailwind config dynamically
    if (window.tailwind) {
      tailwind.config.theme.extend.colors.chaos[500] = theme.primary;
      tailwind.config.theme.extend.colors.acc.emerald = theme.success;
      tailwind.config.theme.extend.colors.acc.amber = theme.warning;
      tailwind.config.theme.extend.colors.acc.rose = theme.danger;
      tailwind.config.theme.extend.colors.acc.sky = theme.info;
      tailwind.config.theme.extend.colors.acc.violet = theme.violet;
      tailwind.config.theme.extend.colors.acc.cyan = theme.cyan;
    }
    
    // Update Chart.js defaults
    Chart.defaults.color = theme.textMuted;
    Chart.defaults.borderColor = theme.border;
    Chart.defaults.plugins.tooltip.backgroundColor = theme.surfaceElevated;
    Chart.defaults.plugins.tooltip.borderColor = theme.border;
    Chart.defaults.scales.x.grid.color = theme.border;
    Chart.defaults.scales.y.grid.color = theme.border;
    
    // Redraw all charts
    Object.values(State.charts).forEach(chart => chart.update());
    
    showToast(`Theme changed to ${theme.name}`, 'success');
  },

  // ============================================================
  // INTERACTIVE COMPONENTS
  // ============================================================
  
  components: {
    // Real-time metric card with sparkline
    MetricCard: function({ label, value, trend, unit, color, sparklineData }) {
      const trendClass = trend > 0 ? 'text-acc-emerald' : trend < 0 ? 'text-acc-rose' : 'text-gray-500';
      const trendIcon = trend > 0 ? '↗' : trend < 0 ? '↘' : '→';
      
      return `
        <article class="card-base relative overflow-hidden group">
          <div class="absolute inset-0 bg-gradient-to-tr from-${color}-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <p class="stat-label relative z-10">${label}</p>
          <div class="flex items-baseline gap-2 relative z-10 mt-1">
            <span class="stat-value font-mono" style="color: var(--chaos-${color})">${value}</span>
            ${unit ? `<span class="text-sm text-gray-500">${unit}</span>` : ''}
          </div>
          <div class="flex items-center gap-2 relative z-10 mt-3">
            <span class="${trendClass} text-xs font-medium">${trendIcon} ${Math.abs(trend).toFixed(1)}%</span>
            <span class="text-xs text-gray-500">vs last period</span>
          </div>
          ${sparklineData ? `
            <div class="absolute bottom-0 right-0 w-32 h-16 opacity-50 group-hover:opacity-100 transition-opacity">
              <canvas class="w-full h-full" data-sparkline='${JSON.stringify(sparklineData)}'></canvas>
            </div>
          ` : ''}
        </article>
      `;
    },

    // System status badge with pulse animation
    StatusBadge: function(status, options = {}) {
      const configs = {
        active: { class: 'badge-active', icon: '<div class="w-1.5 h-1.5 bg-acc-emerald rounded-full animate-pulse"></div>', text: 'Active' },
        idle: { class: 'badge-warning', icon: '<div class="w-1.5 h-1.5 bg-acc-amber rounded-full"></div>', text: 'Idle' },
        offline: { class: 'badge-inactive', icon: '<div class="w-1.5 h-1.5 bg-gray-600 rounded-full"></div>', text: 'Offline' },
        encrypted: { class: 'badge-danger', icon: '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>', text: 'Encrypted' },
        decrypted: { class: 'badge-active', icon: '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>', text: 'Decrypted' },
        negotiating: { class: 'badge-info', icon: '<svg class="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>', text: 'Negotiating' },
        paid: { class: 'badge-active', icon: '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>', text: 'Paid' }
      };
      
      const cfg = configs[status] || configs.offline;
      const size = options.size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-0.5 text-xs';
      
      return `<span class="inline-flex items-center gap-1.5 ${cfg.class} ${size} font-medium">${cfg.icon}<span>${cfg.text}</span></span>`;
    },

    // Interactive data table with inline actions
    DataTable: function({ columns, rows, keyField, actions, sortable = true, selectable = true }) {
      const colsHtml = columns.map((col, i) => 
        `<th class="table-header ${sortable ? 'cursor-pointer' : ''}" data-col="${col.field}">${col.header}${sortable ? '<svg class="w-3 h-3 ml-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4M17 16v-4m0 0l4-4m-4 4l-4-4"></path></svg>' : ''}</th>`
      ).join('');
      
      const rowsHtml = rows.map(row => {
        const key = row[keyField];
        const cells = columns.map(col => {
          let value = row[col.field];
          if (col.render) value = col.render(value, row);
          else if (typeof value === 'object') value = JSON.stringify(value);
          return `<td class="table-cell ${col.align ? `text-${col.align}` : ''}">${value}</td>`;
        }).join('');
        
        const actionHtml = actions ? `
          <td class="table-cell">
            <div class="flex items-center gap-1">
              ${actions.map(a => `
                <button class="p-1.5 rounded hover:bg-surface-800 transition" 
                        onclick="${a.onClick}('${key}')" 
                        title="${a.title}"
                        ${a.condition && !a.condition(row) ? 'disabled style="opacity:0.3"' : ''}>
                  ${a.icon}
                </button>
              `).join('')}
            </div>
          </td>
        ` : '';
        
        const checkboxHtml = selectable ? `
          <td class="table-cell w-12">
            <input type="checkbox" class="row-checkbox rounded border-gray-600 text-chaos-500" value="${key}">
          </td>
        ` : '';
        
        return `<tr class="table-row" data-key="${key}">${checkboxHtml}${cells}${actionHtml}</tr>`;
      }).join('');
      
      return `
        <div class="card-base overflow-hidden">
          <div class="scrollbar-thin overflow-x-auto">
            <table class="w-full">
              <thead><tr>${selectable ? '<th class="table-header w-12"><input type="checkbox" id="selectAll" class="rounded border-gray-600 text-chaos-500"></th>' : ''}${colsHtml}${actions ? '<th class="table-header w-24">Actions</th>' : ''}</tr></thead>
              <tbody class="divide-y divide-gray-800">${rowsHtml}</tbody>
            </table>
          </div>
        </div>
      `;
    },

    // Campaign card with stats
    CampaignCard: function(campaign) {
      const statusClass = campaign.status === 'active' ? 'badge-active' : 'badge-inactive';
      const stats = campaign.stats || {};
      
      return `
        <article class="card-base glass-hover group relative overflow-hidden">
          <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-chaos-500 to-chaos-700"></div>
          <div class="flex items-start justify-between mb-4">
            <div>
              <h3 class="font-semibold text-white flex items-center gap-2">
                ${campaign.name}
                <span class="badge ${statusClass} text-xs">${campaign.status}</span>
              </h3>
              <p class="text-xs text-gray-500 font-mono mt-1">${campaign.id}</p>
            </div>
            <button class="btn-ghost text-xs p-1.5 opacity-0 group-hover:opacity-100 transition" onclick="openCampaignMenu('${campaign.id}', event)">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01"></path></svg>
            </button>
          </div>
          
          <div class="grid grid-cols-3 gap-4 mb-4">
            <div class="text-center p-3 bg-surface-900/50 rounded-lg">
              <p class="stat-value text-acc-emerald font-mono text-xl">${fmtNumber(stats.totalInfections || 0)}</p>
              <p class="stat-label">Infections</p>
            </div>
            <div class="text-center p-3 bg-surface-900/50 rounded-lg">
              <p class="stat-value text-acc-sky font-mono text-xl">${fmtNumber(stats.totalFiles || 0)}</p>
              <p class="stat-label">Files</p>
            </div>
            <div class="text-center p-3 bg-surface-900/50 rounded-lg">
              <p class="stat-value text-chaos-400 font-mono text-xl">${fmtBytes(stats.totalBytes || 0)}</p>
              <p class="stat-label">Data</p>
            </div>
          </div>
          
          <div class="flex items-center justify-between pt-3 border-t border-gray-800">
            <span class="text-xs text-gray-500">API: <code class="font-mono bg-surface-900 px-1.5 py-0.5 rounded">${campaign.apiKey?.slice(0, 12)}...</code></span>
            <div class="flex gap-2">
              <button class="btn-secondary text-xs" onclick="copyApiKey('${campaign.apiKey}')">Copy Key</button>
              <button class="btn-primary text-xs" onclick="openCampaignDetail('${campaign.id}')">View</button>
            </div>
          </div>
        </article>
      `;
    },

    // Real-time notification toast
    NotificationToast: function({ type, title, message, actions, duration = 5000 }) {
      const icons = {
        infection: '<svg class="w-5 h-5 text-acc-rose" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>',
        exfil: '<svg class="w-5 h-5 text-chaos-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>',
        payment: '<svg class="w-5 h-5 text-acc-emerald" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
        system: '<svg class="w-5 h-5 text-acc-sky" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>'
      };
      
      const colors = {
        infection: 'border-acc-rose bg-acc-roseDim',
        exfil: 'border-chaos-500 bg-surface-900',
        payment: 'border-acc-emerald bg-acc-emeraldDim',
        system: 'border-acc-sky bg-acc-skyDim'
      };
      
      return `
        <div class="notification-toast flex items-start gap-3 px-4 py-3 rounded-xl border ${colors[type]} shadow-xl animate-slide-in-right" role="alert">
          ${icons[type] || icons.system}
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-white">${title}</p>
            <p class="text-sm text-gray-400 mt-0.5">${message}</p>
            ${actions ? `
              <div class="flex gap-2 mt-3">
                ${actions.map(a => `<button class="btn-${a.variant || 'secondary'} text-xs" onclick="${a.onClick}">${a.label}</button>`).join('')}
              </div>
            ` : ''}
          </div>
          <button class="text-gray-500 hover:text-white" onclick="this.parentElement.remove()">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
      `;
    },

    // Sparkline chart (inline)
    Sparkline: function(data, color = 'chaos') {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 30;
      const ctx = canvas.getContext('2d');
      
      const max = Math.max(...data);
      const min = Math.min(...data);
      const range = max - min || 1;
      
      // Gradient area
      const gradient = ctx.createLinearGradient(0, 0, 0, 30);
      gradient.addColorStop(0, `rgba(${getColorRGB(color)}, 0.3)`);
      gradient.addColorStop(1, `rgba(${getColorRGB(color)}, 0)`);
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(0, 30);
      data.forEach((val, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 30 - ((val - min) / range) * 30;
        ctx.lineTo(x, y);
      });
      ctx.lineTo(100, 30);
      ctx.closePath();
      ctx.fill();
      
      // Line
      ctx.strokeStyle = getColorHex(color);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      data.forEach((val, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 30 - ((val - min) / range) * 30;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      
      return canvas;
    }
  },

  // ============================================================
  // ANIMATION UTILITIES
  // ============================================================
  
  animations: {
    // Staggered entrance for lists
    staggerIn: function(elements, delay = 50) {
      elements.forEach((el, i) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(10px)';
        el.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
        setTimeout(() => {
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
        }, i * delay);
      });
    },

    // Number counter animation
    countUp: function(element, start, end, duration = 1000) {
      const startTime = performance.now();
      const animate = (now) => {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
        const current = Math.round(start + (end - start) * eased);
        element.textContent = current.toLocaleString();
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    },

    // Pulse effect for live indicators
    pulse: function(element, color = '#10b981') {
      element.style.animation = 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite';
      element.style.boxShadow = `0 0 0 0 ${color}`;
    },

    // Slide in from right
    slideInRight: function(element) {
      element.style.animation = 'slideInRight 0.3s ease-out';
    },

    // Shake for errors
    shake: function(element) {
      element.style.animation = 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both';
      // Add shake keyframes if not exists
      if (!document.getElementById('shake-keyframes')) {
        const style = document.createElement('style');
        style.id = 'shake-keyframes';
        style.textContent = `
          @keyframes shake {
            10%, 90% { transform: translate3d(-1px, 0, 0); }
            20%, 80% { transform: translate3d(2px, 0, 0); }
            30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
            40%, 60% { transform: translate3d(4px, 0, 0); }
          }
        `;
        document.head.appendChild(style);
      }
    }
  },

  // ============================================================
  // DATA VISUALIZATION HELPERS
  // ============================================================
  
  viz: {
    // Format bytes with color coding
    formatBytesColored: function(bytes) {
      const fmt = fmtBytes(bytes);
      const color = bytes > 1e9 ? 'text-acc-rose' : bytes > 1e6 ? 'text-chaos-400' : 'text-acc-emerald';
      return `<span class="font-mono ${color}">${fmt}</span>`;
    },

    // Format number with abbreviation
    formatNumberAbbr: function(num) {
      if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
      if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
      if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
      return num.toString();
    },

    // Generate gradient for chart datasets
    generateGradient: function(ctx, colorStops) {
      const gradient = ctx.createLinearGradient(0, 0, 0, 400);
      colorStops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
      return gradient;
    },

    // Create chart color palette
    getPalette: function(count, theme = 'chaos') {
      const palettes = {
        chaos: ['#d6781e', '#10b981', '#0ea5e9', '#8b5cf6', '#f43f5e', '#06b6d4', '#f59e0b', '#ec4899'],
        matrix: ['#00ff41', '#00cc33', '#009926', '#00661a', '#00330d', '#00ff88', '#00ffaa', '#00ffcc'],
        midnight: ['#3b82f6', '#22c55e', '#06b6d4', '#a855f7', '#ec4899', '#f59e0b', '#ef4444', '#14b8a6'],
        blood: ['#dc2626', '#ef4444', '#f97316', '#fbbf24', '#22c55e', '#06b6d4', '#a855f7', '#ec4899'],
        mono: ['#e5e5e5', '#d4d4d4', '#a3a3a3', '#737373', '#525252', '#404040', '#262626', '#171717']
      };
      const palette = palettes[theme] || palettes.chaos;
      return Array.from({length: count}, (_, i) => palette[i % palette.length]);
    }
  }
};

// Helper functions
function getColorHex(name) {
  const colors = {
    chaos: '#d6781e', emerald: '#10b981', amber: '#f59e0b', rose: '#f43f5e',
    sky: '#0ea5e9', violet: '#8b5cf6', cyan: '#06b6d4'
  };
  return colors[name] || colors.chaos;
}

function getColorRGB(name) {
  const rgb = {
    chaos: '214,120,30', emerald: '16,185,129', amber: '245,158,11', rose: '244,63,94',
    sky: '14,165,233', violet: '139,92,246', cyan: '6,182,212'
  };
  return rgb[name] || rgb.chaos;
}

function fmtBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function fmtNumber(n) {
  return (n ?? 0).toLocaleString();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EnhancedUI;
}

// Initialize sparklines on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('canvas[data-sparkline]').forEach(canvas => {
    const data = JSON.parse(canvas.dataset.sparkline);
    const ctx = canvas.getContext('2d');
    // ... render sparkline
  });
});

// Make available globally
window.EnhancedUI = EnhancedUI;