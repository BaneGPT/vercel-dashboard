# Chaos C2 Affiliate Panel

A comprehensive affiliate/partner dashboard for the Chaos C2 platform. Built with modern web technologies and designed for real-time tracking of referrals, earnings, and payouts.

## Features

### 🎯 Core Features
- **Multi-Level Referral System** - Earn from direct referrals (20%), their referrals (5%), and third level (2%)
- **Real-Time Earnings Tracking** - Track every infection, file exfiltration, and payment in real-time
- **Tier-Based Commission Structure** - Bronze (20%) → Silver (25%) → Gold (30%) → Platinum (35%)
- **Crypto Payouts** - Support for BTC, ETH, USDT, XMR with low fees
- **Campaign Management** - Create and manage ransomware campaigns from the panel

### 📊 Dashboard Views
1. **Dashboard** - Overview of earnings, referrals, tier progress, and quick actions
2. **Referrals** - Manage and track all referred affiliates with detailed analytics
3. **Earnings** - Detailed breakdown of earnings by referral, campaign, and time period
4. **Payouts** - Request and track cryptocurrency payouts with transaction history
5. **Campaigns** - Create and monitor ransomware campaigns
6. **Settings** - Profile, wallet, security (2FA), notifications, and account management

### 🔐 Security Features
- JWT-based session management with refresh tokens
- Two-Factor Authentication (TOTP) with backup codes
- API key/secret authentication for programmatic access
- IP whitelisting support
- Secure password reset flow

### 💰 Commission Structure

| Tier | Base Commission | Multi-Level | Min Payout | Support |
|------|----------------|-------------|------------|---------|
| Bronze | 20% | Level 1 only | $100 | Standard |
| Silver | 25% | Level 1-2 (5%) | $50 | Priority |
| Gold | 30% | Level 1-3 (2%) | $25 | Dedicated |
| Platinum | 35% | All levels + bonuses | No minimum | 24/7 Direct |

## API Endpoints

### Affiliate Management
- `POST /api/affiliates/auth` - Login, register, verify, refresh, logout, 2FA
- `GET /api/affiliates` - List affiliates (admin) or get single affiliate
- `POST /api/affiliates` - Create new affiliate (registration)
- `PUT /api/affiliates` - Update affiliate profile
- `DELETE /api/affiliates` - Delete affiliate (admin)

### Referral Tracking
- `GET /api/affiliates/referrals` - List referrals with filtering
- `POST /api/affiliates/referrals` - Track referral activity (infections, payments)
- `PUT /api/affiliates/referrals` - Update referral status

### Payout Management
- `GET /api/affiliates/payouts` - List payouts with filtering
- `POST /api/affiliates/payouts` - Request payout (affiliate) or create (admin)
- `PUT /api/affiliates/payouts` - Update payout status (admin)
- `DELETE /api/affiliates/payouts` - Cancel payout request

### Campaign Management
- `GET /api/affiliates/campaigns` - List affiliate's campaigns
- `POST /api/affiliates/campaigns` - Create new campaign

## Database Schema (Vercel KV)

### Affiliate
```
affiliate:{id} - Affiliate object
affiliate:username:{username} - Maps username to ID
affiliate:email:{email} - Maps email to ID
affiliate:{id}:stats - Hash with earnings stats
affiliate:{id}:referrals - Set of referral IDs
affiliate:{id}:payouts - Set of payout IDs
affiliate:{id}:campaigns - Set of campaign IDs
affiliate:{id}:multilevel - Set of multi-level referral IDs
referral_code:{code} - Maps referral code to affiliate ID
```

### Referral
```
referral:{id} - Referral object
referral:{id}:earnings - List of earning events
```

### Payout
```
payout:{id} - Payout object
```

### Multi-Level Referral
```
multilevel_referral:{id} - Multi-level referral object
```

### Session/Auth
```
session:{token} - Session data
refresh:{token} - Refresh token data
temp_2fa:{token} - Temporary 2FA token
password_reset:{token} - Password reset token
```

## Deployment

### Prerequisites
- Vercel account
- Vercel KV database (or Redis-compatible)
- Node.js 18+

### Local Development
```bash
cd vercel-dashboard
npm install
npm run dev
```

### Production Deployment
```bash
npm run build
npm run deploy
```

### Environment Variables
```
MASTER_API_KEY - Master API key for admin access
KV_REST_API_URL - Vercel KV REST API URL
KV_REST_API_TOKEN - Vercel KV REST API token
```

## Frontend Architecture

### Files
- `dashboard/affiliate-index.html` - Main HTML structure
- `dashboard/affiliate-app.js` - Application logic (vanilla JS)
- Uses Tailwind CSS (CDN) and Chart.js (CDN)

### State Management
- `AffiliateState` object holds all client-side state
- Session tokens stored in localStorage
- Auto-refresh polling every 30 seconds

### Key Components
- Modal system for auth, payouts, campaign creation
- Real-time charts with Chart.js
- Toast notifications
- Responsive sidebar navigation
- Table pagination and filtering

## Integration with Main Dashboard

The affiliate panel is accessible at `/affiliate` and integrates with:
- Campaign system via `affiliateId` field
- Systems tracking via referral commissions
- Real-time SSE events for live updates

## Security Considerations

1. **Never expose master keys** in client-side code
2. **Use HTTPS only** in production
3. **Implement rate limiting** on auth endpoints
4. **Validate all inputs** server-side
5. **Use bcrypt** for password hashing in production
6. **Rotate API keys** periodically
7. **Monitor for suspicious activity** (multiple failed logins, etc.)

## Extending the Panel

### Adding New Tier
1. Update `getTierConfig()` in `affiliate-app.js`
2. Update tier logic in `affiliates/index.js`
3. Add new badge styles in CSS

### Adding New Wallet Type
1. Add to wallet type selects in HTML
2. Update `calculateFee()` in `payouts.js`
3. Add validation for address formats

### Adding New Earning Action
1. Add to `handlePost` in `referrals.js`
2. Update frontend earnings display
3. Add to Chart.js datasets

## License

Part of the Chaos C2 platform. Internal use only.