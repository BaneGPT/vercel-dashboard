'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  change?: string;
  changePositive?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  color: 'chaos-gold' | 'chaos-emerald' | 'chaos-rose' | 'chaos-sky' | 'chaos-violet' | 'chaos-amber' | 'chaos-cyan';
  delay?: number;
}

export function StatCard({ label, value, change, changePositive = true, icon: Icon, color, delay = 0 }: StatCardProps) {
  const colorMap = {
    'chaos-gold': 'from-chaos-gold to-chaos-goldHover',
    'chaos-emerald': 'from-chaos-emerald to-emerald-400',
    'chaos-rose': 'from-chaos-rose to-rose-400',
    'chaos-sky': 'from-chaos-sky to-sky-400',
    'chaos-violet': 'from-chaos-violet to-violet-400',
    'chaos-amber': 'from-chaos-amber to-amber-400',
    'chaos-cyan': 'from-chaos-cyan to-cyan-400',
  };

  const gradient = colorMap[color];

  return (
    <div className={cn('stat-card animate-in', `stagger-${Math.min(Math.floor(delay / 50) + 1, 5)}`)} style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400 font-medium">{label}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
          {change && (
            <p className={cn('text-sm mt-1 flex items-center gap-1', changePositive ? 'text-chaos-emerald' : 'text-chaos-rose')}>
              {changePositive ? <span className="text-chaos-emerald">▲</span> : <span className="text-chaos-rose">▼</span>}
              {change}
            </p>
          )}
        </div>
        <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br', gradient)}>
          <Icon className="w-6 h-6 text-chaos-bg" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}