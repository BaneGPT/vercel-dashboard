'use client';

import { useState, useEffect } from 'react';
import { 
  User, 
  Mail, 
  Wallet, 
  Key, 
  Shield, 
  Bell, 
  Palette,
  Save,
  Loader2,
  Check,
  Eye,
  EyeOff,
  Copy,
  RotateCcw,
  Trash2,
  LogOut
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { useAffiliateStore } from '@/lib/store';
import toast from 'react-hot-toast';

interface SettingsForm {
  username: string;
  email: string;
  walletAddress: string;
  notifications: {
    emailNewInfection: boolean;
    emailPayment: boolean;
    emailPayout: boolean;
    emailTicket: boolean;
    telegramNewInfection: boolean;
    telegramPayment: boolean;
    telegramPayout: boolean;
  };
  appearance: {
    theme: 'dark' | 'light' | 'system';
    compactMode: boolean;
    animations: boolean;
  };
  security: {
    twoFactorEnabled: boolean;
    sessionTimeout: number;
    apiKeyRotationDays: number;
  };
}

const defaultSettings: SettingsForm = {
  username: '',
  email: '',
  walletAddress: '',
  notifications: {
    emailNewInfection: true,
    emailPayment: true,
    emailPayout: true,
    emailTicket: true,
    telegramNewInfection: false,
    telegramPayment: true,
    telegramPayout: true,
  },
  appearance: {
    theme: 'dark',
    compactMode: false,
    animations: true,
  },
  security: {
    twoFactorEnabled: false,
    sessionTimeout: 30,
    apiKeyRotationDays: 90,
  },
};

export default function SettingsPage() {
  const { affiliate, setAffiliate } = useAffiliateStore();
  const [settings, setSettings] = useState<SettingsForm>(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'appearance' | 'security' | 'api'>('profile');
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (affiliate) {
      setSettings(prev => ({
        ...prev,
        username: affiliate.username,
        email: affiliate.email,
        walletAddress: affiliate.walletAddress || '',
      }));
    }
  }, [affiliate]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const updated = await api.updateProfile({
        email: settings.email,
        walletAddress: settings.walletAddress,
      });
      setAffiliate(updated);
      toast.success('Settings saved');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (section: keyof SettingsForm, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: { ...prev[section], [key]: value },
    }));
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'api', label: 'API Keys', icon: Key },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Settings</h1>
          <p className="text-gray-400 mt-1">Manage your account preferences</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="card overflow-hidden">
        <div className="border-b border-chaos-border/30 flex overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'px-6 py-4 text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2',
                activeTab === tab.id
                  ? 'text-chaos-gold border-b-2 border-chaos-gold'
                  : 'text-gray-400 hover:text-gray-200'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'profile' && <ProfileTab settings={settings} onChange={handleInputChange} />}
          {activeTab === 'notifications' && <NotificationsTab settings={settings.notifications} onChange={(k, v) => handleInputChange('notifications', k, v)} />}
          {activeTab === 'appearance' && <AppearanceTab settings={settings.appearance} onChange={(k, v) => handleInputChange('appearance', k, v)} />}
          {activeTab === 'security' && <SecurityTab settings={settings.security} onChange={(k, v) => handleInputChange('security', k, v)} />}
          {activeTab === 'api' && <ApiKeysTab affiliate={affiliate} />}
        </div>
      </div>

      {/* Save Button (for profile tab) */}
      {activeTab === 'profile' && (
        <div className="flex justify-end">
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
}

function ProfileTab({ settings, onChange }: { settings: SettingsForm; onChange: (k: string, v: any) => void }) {
  return (
    <form onSubmit={e => e.preventDefault()} className="space-y-6 max-w-2xl">
      <div>
        <label className="block text-sm font-medium mb-1">Username</label>
        <div className="input-field bg-chaos-border/20 text-gray-300" style={{cursor: 'not-allowed'}}>
          {settings.username}
        </div>
        <p className="text-xs text-gray-500 mt-1">Username cannot be changed</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Email Address</label>
        <input
          type="email"
          value={settings.email}
          onChange={e => onChange('email', e.target.value)}
          className="input-field"
          placeholder="your@email.com"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Crypto Wallet Address</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={settings.walletAddress}
            onChange={e => onChange('walletAddress', e.target.value)}
            className="input-field font-mono flex-1"
            placeholder="BTC / XMR / USDT address"
          />
          <button type="button" className="btn-secondary" title="Validate address">
            <Shield className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">Used for automatic payouts. Supports BTC, XMR, USDT (TRC20/ERC20)</p>
      </div>

      <div className="pt-4 border-t border-chaos-border/30">
        <h3 className="text-lg font-semibold mb-4">Danger Zone</h3>
        <div className="flex items-center justify-between p-4 glass rounded-lg">
          <div>
            <p className="font-medium text-chaos-rose">Delete Account</p>
            <p className="text-sm text-gray-400">Permanently delete your account and all data</p>
          </div>
          <button className="btn-danger">Delete Account</button>
        </div>
      </div>
    </form>
  );
}

function NotificationsTab({ settings, onChange }: { settings: SettingsForm['notifications']; onChange: (k: string, v: any) => void }) {
  const notificationOptions = [
    { key: 'emailNewInfection', label: 'New Infection', desc: 'When a new system is infected' },
    { key: 'emailPayment', label: 'Payment Received', desc: 'When a victim pays the ransom' },
    { key: 'emailPayout', label: 'Payout Processed', desc: 'When your withdrawal is completed' },
    { key: 'emailTicket', label: 'Ticket Updates', desc: 'Replies to your support tickets' },
  ];

  const telegramOptions = [
    { key: 'telegramNewInfection', label: 'New Infection', desc: 'Telegram notification for new infections' },
    { key: 'telegramPayment', label: 'Payment Received', desc: 'Telegram notification for payments' },
    { key: 'telegramPayout', label: 'Payout Processed', desc: 'Telegram notification for payouts' },
  ];

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Mail className="w-5 h-5 text-chaos-sky" />
          Email Notifications
        </h3>
        <div className="space-y-3">
          {notificationOptions.map(opt => (
            <label key={opt.key} className="flex items-center justify-between p-4 glass rounded-lg">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings[opt.key as keyof typeof settings]}
                  onChange={e => onChange(opt.key, e.target.checked)}
                  className="w-4 h-4 rounded border-chaos-border bg-chaos-bg text-chaos-gold focus:ring-chaos-gold"
                />
                <div>
                  <p className="font-medium">{opt.label}</p>
                  <p className="text-xs text-gray-400">{opt.desc}</p>
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="w-5 h-5 bg-gradient-to-br from-blue-500 to-blue-600 rounded flex items-center justify-center">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg>
          </span>
          Telegram Notifications
        </h3>
        <p className="text-sm text-gray-400 mb-4">Connect your Telegram bot to receive instant notifications</p>
        <div className="space-y-3">
          {telegramOptions.map(opt => (
            <label key={opt.key} className="flex items-center justify-between p-4 glass rounded-lg">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings[opt.key as keyof typeof settings]}
                  onChange={e => onChange(opt.key, e.target.checked)}
                  className="w-4 h-4 rounded border-chaos-border bg-chaos-bg text-chaos-gold focus:ring-chaos-gold"
                />
                <div>
                  <p className="font-medium">{opt.label}</p>
                  <p className="text-xs text-gray-400">{opt.desc}</p>
                </div>
              </div>
            </label>
          ))}
        </div>
        <button className="btn-secondary flex items-center gap-2">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg>
          Connect Telegram
        </button>
      </div>
    </div>
  );
}

function AppearanceTab({ settings, onChange }: { settings: SettingsForm['appearance']; onChange: (k: string, v: any) => void }) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-lg font-semibold mb-4">Theme</h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { value: 'dark', label: 'Dark', desc: 'Always dark mode' },
            { value: 'light', label: 'Light', desc: 'Always light mode' },
            { value: 'system', label: 'System', desc: 'Follow OS preference' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => onChange('theme', opt.value)}
              className={cn(
                'p-4 glass rounded-lg text-left transition-all',
                settings.theme === opt.value
                  ? 'border-chaos-gold/50 bg-chaos-gold/5'
                  : 'hover:border-chaos-border/50'
              )}
            >
              <p className="font-medium">{opt.label}</p>
              <p className="text-xs text-gray-400 mt-1">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Display Options</h3>
        <div className="space-y-3">
          <label className="flex items-center justify-between p-4 glass rounded-lg">
            <div>
              <p className="font-medium">Compact Mode</p>
              <p className="text-xs text-gray-400">Reduce padding and spacing</p>
            </div>
            <input
              type="checkbox"
              checked={settings.compactMode}
              onChange={e => onChange('compactMode', e.target.checked)}
              className="w-5 h-5 rounded border-chaos-border bg-chaos-bg text-chaos-gold focus:ring-chaos-gold"
            />
          </label>
          <label className="flex items-center justify-between p-4 glass rounded-lg">
            <div>
              <p className="font-medium">Animations</p>
              <p className="text-xs text-gray-400">Enable transitions and micro-animations</p>
            </div>
            <input
              type="checkbox"
              checked={settings.animations}
              onChange={e => onChange('animations', e.target.checked)}
              className="w-5 h-5 rounded border-chaos-border bg-chaos-bg text-chaos-gold focus:ring-chaos-gold"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

function SecurityTab({ settings, onChange }: { settings: SettingsForm['security']; onChange: (k: string, v: any) => void }) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-chaos-emerald" />
          Two-Factor Authentication
        </h3>
        <div className="glass rounded-lg p-4">
          <label className="flex items-center justify-between">
            <div>
              <p className="font-medium">Enable 2FA</p>
              <p className="text-xs text-gray-400">Require authenticator app code on login</p>
            </div>
            <input
              type="checkbox"
              checked={settings.twoFactorEnabled}
              onChange={e => onChange('twoFactorEnabled', e.target.checked)}
              className="w-5 h-5 rounded border-chaos-border bg-chaos-bg text-chaos-gold focus:ring-chaos-gold"
            />
          </label>
          {settings.twoFactorEnabled && (
            <div className="mt-4 p-4 bg-chaos-bg rounded-lg border border-chaos-border/30">
              <p className="font-mono text-sm text-chaos-gold">Backup Codes:</p>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {Array.from({length: 8}, (_, i) => (
                  <span key={i} className="font-mono text-xs bg-chaos-border/30 px-2 py-1 rounded">
                    {Math.random().toString(36).substring(2, 8).toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Session Management</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Session Timeout (days)</label>
            <input
              type="number"
              min="1"
              max="90"
              value={settings.sessionTimeout}
              onChange={e => onChange('sessionTimeout', parseInt(e.target.value))}
              className="input-field w-32"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">API Key Auto-Rotation (days)</label>
            <input
              type="number"
              min="30"
              max="365"
              value={settings.apiKeyRotationDays}
              onChange={e => onChange('apiKeyRotationDays', parseInt(e.target.value))}
              className="input-field w-32"
            />
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-chaos-border/30">
        <h3 className="text-lg font-semibold mb-4 text-chaos-rose">Danger Zone</h3>
        <div className="space-y-3">
          <button className="btn-danger w-full justify-start">
            <LogOut className="w-4 h-4" />
            Revoke All Sessions
          </button>
          <button className="btn-danger w-full justify-start">
            <RotateCcw className="w-4 h-4" />
            Rotate API Keys
          </button>
        </div>
      </div>
    </div>
  );
}

function ApiKeysTab({ affiliate }: { affiliate: any }) {
  const [apiKeys, setApiKeys] = useState<Array<{id: string, name: string, key: string, createdAt: string, lastUsed: string, active: boolean}>>([
    { id: 'key_1', name: 'Default API Key', key: affiliate?.referralCode ? `sk_${affiliate.referralCode}_${Math.random().toString(36).substring(2, 20)}` : 'sk_xxx', createdAt: '2024-01-15', lastUsed: '2 hours ago', active: true },
  ]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');

  const createKey = () => {
    if (!newKeyName.trim()) return;
    const newKey = {
      id: `key_${Date.now()}`,
      name: newKeyName,
      key: `sk_${Math.random().toString(36).substring(2, 10)}_${Math.random().toString(36).substring(2, 20)}`,
      createdAt: new Date().toISOString().split('T')[0],
      lastUsed: 'Never',
      active: true,
    };
    setApiKeys([newKey, ...apiKeys]);
    setShowCreateModal(false);
    setNewKeyName('');
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('API key copied to clipboard');
  };

  const toggleKey = (id: string) => {
    setApiKeys(apiKeys.map(k => k.id === id ? { ...k, active: !k.active } : k));
  };

  const deleteKey = (id: string) => {
    if (confirm('Delete this API key? This cannot be undone.')) {
      setApiKeys(apiKeys.filter(k => k.id !== id));
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">API Keys</h3>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Create New Key
        </button>
      </div>

      <div className="space-y-3">
        {apiKeys.map(key => (
          <div key={key.id} className="card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h4 className="font-medium">{key.name}</h4>
                <span className={cn('badge text-xs', key.active ? 'badge-success' : 'badge-neutral')}>
                  {key.active ? 'Active' : 'Revoked'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <span>Created: {key.createdAt}</span>
                <span>•</span>
                <span>Last used: {key.lastUsed}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 glass px-3 py-2 rounded-lg flex-1 sm:flex-none min-w-0">
                <input
                  type="text"
                  value={key.key}
                  readOnly
                  className="bg-transparent border-none text-sm font-mono text-gray-300 w-full sm:w-64"
                />
                <button onClick={() => copyKey(key.key)} className="btn-secondary text-sm px-3 py-1" title="Copy">
                  <Copy className="w-4 h-4" />
                </button>
                <button onClick={() => {}} className="btn-secondary text-sm px-3 py-1" title="Regenerate">
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
              <button onClick={() => toggleKey(key.id)} className="btn-secondary text-sm">
                {key.active ? 'Revoke' : 'Activate'}
              </button>
              <button onClick={() => deleteKey(key.id)} className="btn-danger text-sm">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="card w-full max-w-md mx-4 animate-in">
            <CardHeader>
              <CardTitle>Create New API Key</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Key Name</label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  className="input-field"
                  placeholder="e.g., Production Server"
                  autoFocus
                />
              </div>
              <div className="flex gap-2 pt-4">
                <button onClick={() => setShowCreateModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={createKey} className="btn-primary flex-1">Create Key</button>
              </div>
            </CardContent>
          </div>
        </div>
      )}
    </div>
  );
}