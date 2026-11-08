'use client';

import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  BarChart2, 
  DollarSign, 
  Users, 
  Ticket, 
  Settings, 
  LogOut,
  Building2,
  FileCode,
  ShieldCheck,
  TrendingUp
} from 'lucide-react';
import { useAffiliateStore } from '@/lib/store';

const navigation = [
  { name: 'Overview', href: '/', icon: LayoutDashboard },
  { name: 'Campaigns', href: '/campaigns', icon: Building2 },
  { name: 'Analytics', href: '/analytics', icon: BarChart2 },
  { name: 'Earnings', href: '/earnings', icon: DollarSign },
  { name: 'Payload Builder', href: '/builder', icon: FileCode },
  { name: 'Referrals', href: '/referrals', icon: Users },
  { name: 'Tickets', href: '/tickets', icon: Ticket },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { affiliate, logout } = useAffiliateStore();

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-chaos-card border-r border-chaos-border/30 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-chaos-border/30">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-chaos-gold to-chaos-goldHover flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-chaos-bg" />
          </div>
          <span className="text-xl font-bold text-gradient">Chaos Affiliate</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'sidebar-link',
                isActive && 'active'
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-chaos-border/30 space-y-4">
        {affiliate && (
          <div className="glass rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-chaos-gold/20 flex items-center justify-center">
                <span className="text-chaos-gold font-bold text-sm">
                  {affiliate.username.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{affiliate.username}</p>
                <p className="text-xs text-gray-400 truncate">{affiliate.email}</p>
              </div>
              <span className={cn(
                'badge',
                affiliate.status === 'active' && 'badge-success',
                affiliate.status === 'suspended' && 'badge-warning',
                affiliate.status === 'banned' && 'badge-danger'
              )}>
                {affiliate.status}
              </span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Link href="/settings" className="sidebar-link">
            <Settings className="w-5 h-5" />
            Settings
          </Link>
          <button
            onClick={logout}
            className="sidebar-link text-chaos-rose hover:text-chaos-rose w-full text-left"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>

        {/* Quick Stats */}
        {affiliate && (
          <div className="grid grid-cols-2 gap-2 pt-4 border-t border-chaos-border/30">
            <div className="glass rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-chaos-gold">{affiliate.totalEarnings.toFixed(2)}</p>
              <p className="text-xs text-gray-400">Total Earned</p>
            </div>
            <div className="glass rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-chaos-emerald">{affiliate.pendingEarnings.toFixed(2)}</p>
              <p className="text-xs text-gray-400">Pending</p>
            </div>
            <div className="glass rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-chaos-sky">{affiliate.campaignCount}</p>
              <p className="text-xs text-gray-400">Campaigns</p>
            </div>
            <div className="glass rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-chaos-violet">{affiliate.infectionCount}</p>
              <p className="text-xs text-gray-400">Infections</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}