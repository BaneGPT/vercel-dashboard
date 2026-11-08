'use client';

import { useState, useEffect } from 'react';
import { 
  Users, 
  Link2, 
  DollarSign, 
  TrendingUp,
  Copy,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  Filter,
  ExternalLink
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { formatCurrency, formatNumber, formatDate, formatRelativeTime, cn, generateReferralCode } from '@/lib/utils';
import { useAffiliateStore } from '@/lib/store';
import toast from 'react-hot-toast';

interface Referral {
  id: string;
  username: string;
  email: string;
  joinedAt: string;
  campaignCount: number;
  infectionCount: number;
  totalEarnings: number;
  yourCommission: number;
  status: 'active' | 'inactive' | 'banned';
}

interface ReferralStats {
  totalReferrals: number;
  activeReferrals: number;
  totalCommissionEarned: number;
  pendingCommission: number;
  referralCode: string;
  referralLink: string;
  tierBreakdown: Array<{ tier: number; count: number; commissionRate: number }>;
}

export default function ReferralsPage() {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const pageSize = 20;
  const { affiliate } = useAffiliateStore();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsData, referralsData] = await Promise.all([
        api.getReferralStats(),
        api.getReferrals({ page, limit: pageSize }),
      ]);
      setStats(statsData);
      setReferrals(referralsData.referrals || []);
    } catch (error) {
      console.error('Failed to fetch referrals:', error);
    } finally {
      setLoading(false);
    }
  };

  const referralLink = stats?.referralLink || `${window.location.origin}/register?ref=${stats?.referralCode || affiliate?.referralCode}`;

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success('Referral link copied!');
  };

  const copyReferralCode = () => {
    navigator.clipboard.writeText(stats?.referralCode || affiliate?.referralCode || '');
    toast.success('Referral code copied!');
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card h-32 bg-chaos-border/20" />
          ))}
        </div>
        <div className="card h-64 bg-chaos-border/20" />
        <div className="card h-96 bg-chaos-border/20" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Referral Program</h1>
          <p className="text-gray-400 mt-1">Earn commissions from affiliates you refer</p>
        </div>
      </div>

      {/* Referral Link Card */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 bg-gradient-to-r from-chaos-gold/10 to-chaos-violet/10 rounded-xl border border-chaos-gold/20">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-chaos-gold/20 flex items-center justify-center">
              <Link2 className="w-8 h-8 text-chaos-gold" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Your Referral Link</h3>
              <p className="text-sm text-gray-400">Share this link to earn {stats?.tierBreakdown[0]?.commissionRate || 10}% commission on referrals' earnings</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex items-center gap-2 glass px-4 py-2 rounded-lg min-w-[300px]">
              <ExternalLink className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-mono text-gray-300 truncate flex-1">{referralLink}</span>
              <button onClick={copyReferralLink} className="btn-secondary text-sm px-3 py-1">Copy</button>
            </div>
            <div className="flex items-center gap-2 glass px-4 py-2 rounded-lg">
              <span className="text-sm font-mono text-chaos-gold">{stats?.referralCode || affiliate?.referralCode}</span>
              <button onClick={copyReferralCode} className="btn-secondary text-sm px-3 py-1">Copy Code</button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCardReferral
          label="Total Referrals"
          value={stats?.totalReferrals?.toString() || '0'}
          sublabel={`${stats?.activeReferrals || 0} active`}
          icon={Users}
          color="chaos-sky"
        />
        <StatCardReferral
          label="Commission Earned"
          value={formatCurrency(stats?.totalCommissionEarned || 0)}
          sublabel={`Pending: ${formatCurrency(stats?.pendingCommission || 0)}`}
          icon={DollarSign}
          color="chaos-gold"
        />
        <StatCardReferral
          label="Referral Code"
          value={stats?.referralCode || affiliate?.referralCode || '—'}
          sublabel="Unique identifier"
          icon={Link2}
          color="chaos-violet"
        />
        <StatCardReferral
          label="Conversion Rate"
          value={stats?.totalReferrals > 0 ? `${((stats.activeReferrals / stats.totalReferrals) * 100).toFixed(1)}%` : '0%'}
          sublabel="Active / Total"
          icon={TrendingUp}
          color="chaos-emerald"
        />
      </div>

      {/* Tier Breakdown */}
      <div className="card">
        <CardHeader>
          <CardTitle>Commission Tiers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Tier</th>
                  <th className="table-header">Description</th>
                  <th className="table-header">Commission Rate</th>
                  <th className="table-header">Referrals</th>
                  <th className="table-header">Est. Monthly</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { tier: 1, desc: 'Direct referrals', rate: '10%', count: stats?.tierBreakdown[0]?.count || 0 },
                  { tier: 2, desc: 'Referrals of referrals', rate: '5%', count: stats?.tierBreakdown[1]?.count || 0 },
                  { tier: 3, desc: 'Third level', rate: '2%', count: stats?.tierBreakdown[2]?.count || 0 },
                ].map((t) => (
                  <tr key={t.tier} className="hover:bg-chaos-border/20">
                    <td className="table-cell font-bold text-chaos-gold">Tier {t.tier}</td>
                    <td className="table-cell text-gray-300">{t.desc}</td>
                    <td className="table-cell font-semibold">{t.rate}</td>
                    <td className="table-cell">{t.count}</td>
                    <td className="table-cell text-chaos-emerald">{formatCurrency(t.count * 500 * (parseInt(t.rate) / 100))}/mo</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </div>

      {/* Referrals Table */}
      <div className="card">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg">Your Referrals</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search referrals..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input-field pl-10 w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="table-container">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Affiliate</th>
                  <th className="table-header">Joined</th>
                  <th className="table-header">Campaigns</th>
                  <th className="table-header">Infections</th>
                  <th className="table-header">Earnings</th>
                  <th className="table-header">Your Commission</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody>
                {referrals.filter(r => 
                  r.username.toLowerCase().includes(search.toLowerCase()) ||
                  r.email.toLowerCase().includes(search.toLowerCase())
                ).map((ref, i) => (
                  <tr key={ref.id} className="hover:bg-chaos-border/20">
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-chaos-gold/20 flex items-center justify-center">
                          <span className="text-chaos-gold font-bold text-sm">{ref.username.charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="font-medium">{ref.username}</p>
                          <p className="text-xs text-gray-400">{ref.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell text-gray-300">{formatDate(ref.joinedAt)}</td>
                    <td className="table-cell">{ref.campaignCount}</td>
                    <td className="table-cell text-chaos-rose">{formatNumber(ref.infectionCount)}</td>
                    <td className="table-cell text-chaos-gold">{formatCurrency(ref.totalEarnings)}</td>
                    <td className="table-cell text-chaos-emerald font-semibold">{formatCurrency(ref.yourCommission)}</td>
                    <td className="table-cell">
                      <span className={cn(
                        'badge',
                        ref.status === 'active' && 'badge-success',
                        ref.status === 'inactive' && 'badge-warning',
                        ref.status === 'banned' && 'badge-danger'
                      )}>
                        {ref.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {referrals.length === 0 && (
                  <tr>
                    <td className="table-cell text-center text-gray-400" colSpan={7}>
                      No referrals yet. Share your link to start earning commissions!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-chaos-border/30">
            <span className="text-sm text-gray-400">
              Page {page} • {referrals.length} referrals
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary text-sm"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={referrals.length < pageSize}
                className="btn-secondary text-sm"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </CardContent>
      </div>

      {/* How It Works */}
      <div className="card">
        <CardHeader>
          <CardTitle>How the Referral Program Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4 p-4 glass rounded-lg">
              <div className="w-10 h-10 rounded-lg bg-chaos-gold/20 flex items-center justify-center flex-shrink-0">
                <span className="text-chaos-gold font-bold">1</span>
              </div>
              <div>
                <h4 className="font-semibold">Share Your Link</h4>
                <p className="text-gray-400 text-sm">Distribute your unique referral link or code to other affiliates</p>
              </div>
            </div>
            <div className="flex gap-4 p-4 glass rounded-lg">
              <div className="w-10 h-10 rounded-lg bg-chaos-gold/20 flex items-center justify-center flex-shrink-0">
                <span className="text-chaos-gold font-bold">2</span>
              </div>
              <div>
                <h4 className="font-semibold">They Sign Up & Build</h4>
                <p className="text-gray-400 text-sm">Referred affiliates create campaigns and deploy payloads</p>
              </div>
            </div>
            <div className="flex gap-4 p-4 glass rounded-lg">
              <div className="w-10 h-10 rounded-lg bg-chaos-gold/20 flex items-center justify-center flex-shrink-0">
                <span className="text-chaos-gold font-bold">3</span>
              </div>
              <div>
                <h4 className="font-semibold">You Earn Commission</h4>
                <p className="text-gray-400 text-sm">Receive 10% Tier 1, 5% Tier 2, 2% Tier 3 of their earnings automatically</p>
              </div>
            </div>
            <div className="flex gap-4 p-4 glass rounded-lg">
              <div className="w-10 h-10 rounded-lg bg-chaos-gold/20 flex items-center justify-center flex-shrink-0">
                <span className="text-chaos-gold font-bold">4</span>
              </div>
              <div>
                <h4 className="font-semibold">Withdraw Anytime</h4>
                <p className="text-gray-400 text-sm">Commissions added to your available balance, withdraw with your regular payouts</p>
              </div>
            </div>
          </div>
        </CardContent>
      </div>
    </div>
  );
}

function StatCardReferral({ label, value, sublabel, icon: Icon, color }: { label: string; value: string; sublabel: string; icon: React.ComponentType<{ className?: string }>; color: string }) {
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