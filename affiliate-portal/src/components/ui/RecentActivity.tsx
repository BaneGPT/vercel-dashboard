'use client';

import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils';
import { 
  Virus, 
  FileText, 
  DollarSign, 
  Wallet, 
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';

interface Activity {
  id: string;
  type: 'infection' | 'exfil' | 'payment' | 'payout' | 'campaign';
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface RecentActivityProps {
  activities: Activity[];
  limit?: number;
}

const typeConfig = {
  infection: { icon: Virus, color: 'text-chaos-rose', bg: 'bg-chaos-rose/10', label: 'New Infection' },
  exfil: { icon: FileText, color: 'text-chaos-sky', bg: 'bg-chaos-sky/10', label: 'File Exfiltrated' },
  payment: { icon: DollarSign, color: 'text-chaos-emerald', bg: 'bg-chaos-emerald/10', label: 'Payment Received' },
  payout: { icon: Wallet, color: 'text-chaos-gold', bg: 'bg-chaos-gold/10', label: 'Payout Processed' },
  campaign: { icon: AlertCircle, color: 'text-chaos-violet', bg: 'bg-chaos-violet/10', label: 'Campaign Event' },
};

export function RecentActivity({ activities, limit = 10 }: RecentActivityProps) {
  const displayActivities = activities.slice(0, limit);

  if (displayActivities.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400">No recent activity</p>
        <p className="text-sm text-gray-500 mt-1">Activity will appear here as your campaigns run</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {displayActivities.map((activity, index) => {
        const config = typeConfig[activity.type] || typeConfig.infection;
        const Icon = config.icon;

        return (
          <div
            key={activity.id}
            className={cn(
              'flex items-start gap-4 p-4 rounded-lg transition-all hover:bg-chaos-border/20 animate-in',
              `stagger-${Math.min(index + 1, 5)}`
            )}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', config.bg)}>
              <Icon className={cn('w-5 h-5', config.color)} aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{activity.message}</p>
              <p className="text-xs text-gray-400 mt-0.5">{formatRelativeTime(activity.timestamp)}</p>
              {activity.metadata && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(activity.metadata).map(([key, value]) => (
                    <span key={key} className="badge badge-neutral text-xs">
                      {key}: {String(value)}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <span className={cn('badge text-xs', config.color.replace('text-', 'badge-'))}>
              {config.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}