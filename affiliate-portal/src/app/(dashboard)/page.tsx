'use client';

import { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Virus, 
  FileText, 
  Globe, 
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Users,
  Activity
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { ChartCard } from '@/components/ui/ChartCard';
import { RecentActivity } from '@/components/ui/RecentActivity';
import { api } from '@/lib/api';
import { formatCurrency, formatNumber, formatRelativeTime } from '@/lib/utils';

interface OverviewStats {
  summary: {
    totalInfections: number;
    activeInfections: number;
    totalFiles: number;
    totalBytes: number;
    totalEarnings: number;
    pendingEarnings: number;
    conversionRate: number;
    avgRansom: number;
  };
  daily: Array<{ date: string; infections: number; files: number; bytes: number; earnings: number }>;
  topCountries: Array<{ country: string; infections: number; earnings: number }>;
  recentActivity: Array<{
    id: string;
    type: 'infection' | 'exfil' | 'payment' | 'payout';
    message: string;
    timestamp: string;
    metadata?: Record<string, any>;
  }>;
}

export default function OverviewPage() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'24h' | '7d' | '30d'>('7d');

  useEffect(() => {
    fetchStats();
  }, [range]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await api.getOverviewStats(range);
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      label: 'Total Infections',
      value: stats ? formatNumber(stats.summary.totalInfections) : '—',
      change: stats ? `+${stats.summary.activeInfections} active` : null,
      changePositive: true,
      icon: Virus,
      color: 'chaos-rose',
    },
    {
      label: 'Total Earnings',
      value: stats ? formatCurrency(stats.summary.totalEarnings) : '—',
      change: stats ? `Pending: ${formatCurrency(stats.summary.pendingEarnings)}` : null,
      changePositive: true,
      icon: DollarSign,
      color: 'chaos-gold',
    },
    {
      label: 'Files Exfiltrated',
      value: stats ? formatNumber(stats.summary.totalFiles) : '—',
      change: stats ? `${formatNumber(stats.summary.totalBytes)} bytes` : null,
      changePositive: true,
      icon: FileText,
      color: 'chaos-sky',
    },
    {
      label: 'Conversion Rate',
      value: stats ? `${stats.summary.conversionRate.toFixed(1)}%` : '—',
      change: stats ? `Avg ransom: ${formatCurrency(stats.summary.avgRansom)}` : null,
      changePositive: stats ? stats.summary.conversionRate > 5 : true,
      icon: TrendingUp,
      color: 'chaos-emerald',
    },
  ];

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
          <h1 className="text-3xl font-bold text-gradient">Dashboard Overview</h1>
          <p className="text-gray-400 mt-1">Real-time view of your campaigns performance</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as any)}
            className="input-field w-auto bg-chaos-bg border-chaos-border text-white"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            change={stat.change}
            changePositive={stat.changePositive}
            icon: stat.icon
            color={stat.color}
            delay={i * 50}
          />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Infections & Earnings Trend"
          subtitle={`Last ${range === '24h' ? '24 hours' : range === '7d' ? '7 days' : '30 days'}`}
          chartType="line"
          data={{
            labels: stats?.daily.map(d => d.date) || [],
            datasets: [
              {
                label: 'Infections',
                data: stats?.daily.map(d => d.infections) || [],
                borderColor: '#f43f5e',
                backgroundColor: 'rgba(244, 63, 94, 0.1)',
                yAxisID: 'y',
              },
              {
                label: 'Earnings (USD)',
                data: stats?.daily.map(d => d.earnings) || [],
                borderColor: '#d6781e',
                backgroundColor: 'rgba(214, 120, 30, 0.1)',
                yAxisID: 'y1',
              },
            ],
          }}
          options={{
            responsive: true,
            interaction: { mode: 'index', intersect: false },
            scales: {
              y: { type: 'linear', position: 'left', grid: { color: 'rgba(255,255,255,0.05)' } },
              y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false } },
              x: { grid: { color: 'rgba(255,255,255,0.05)' } },
            },
          }}
        />

        <ChartCard
          title="Top Countries by Infections"
          subtitle="Geographic distribution"
          chartType="bar"
          data={{
            labels: stats?.topCountries.map(c => c.country) || [],
            datasets: [
              {
                label: 'Infections',
                data: stats?.topCountries.map(c => c.infections) || [],
                backgroundColor: 'rgba(214, 120, 30, 0.6)',
                borderColor: '#d6781e',
                borderWidth: 1,
                borderRadius: 4,
              },
              {
                label: 'Earnings (USD)',
                data: stats?.topCountries.map(c => c.earnings) || [],
                backgroundColor: 'rgba(16, 185, 129, 0.6)',
                borderColor: '#10b981',
                borderWidth: 1,
                borderRadius: 4,
              },
            ],
          }}
          options={{
            responsive: true,
            scales: {
              y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
              x: { grid: { display: false } },
            },
          }}
        />
      </div>

      {/* Recent Activity */}
      <div className="card">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg">Recent Activity</CardTitle>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Activity className="w-4 h-4" />
            <span>Live updates via SSE</span>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <RecentActivity activities={stats?.recentActivity || []} />
        </CardContent>
      </div>
    </div>
  );
}