# Chaos C2 - Payment Integration & Multi-Tenant Infrastructure

A complete payment processing system with multi-tenant isolation for the Chaos C2 platform. Supports cryptocurrency and fiat payments with webhook handling for major providers.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
                        Admin Panel (/admin)
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  Tenant A     │    │  Tenant B     │    │  Tenant C     │
│  (isolated)   │    │  (isolated)   │    │  (isolated)   │
│               │    │               │    │               │
│ • Affiliates  │    │ • Affiliates  │    │ • Affiliates  │
│ • Campaigns   │    │ • Campaigns   │    │ • Campaigns   │
│ • Payments    │    │ • Payments    │    │ • Payments    │
│ • Billing     │    │ • Billing     │    │ • Billing     │
└───────────────┘    └───────────────┘    └───────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
                    Payment Processing Layer
  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────┐
  │   Crypto    │ │   Fiat      │ │  Webhooks   │ │ Fees   │
  │ BTC/ETH/    │ │ Stripe/     │ │ BlockCypher │ │ Calc   │
  │ USDT/XMR    │ │ Coinbase    │ │ Blocknative │ │        │
  └─────────────┘ └─────────────┘ └─────────────┘ └────────┘
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
                    Vercel KV (Redis) Storage
  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────┐
  │ Tenants  │ │Affiliates│ │Campaigns │ │ Payments │ │Stats │
  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────┘
└─────────────────────────────────────────────────────────────┘
```

## 💳 Payment Integration

### Supported Payment Methods

| Category | Methods | Features |
|----------|---------|----------|
| **Cryptocurrency** | BTC, ETH, USDT (ERC20), XMR, LTC, BCH | Address generation, QR codes, blockchain monitoring, configurable confirmations |
| **Fiat** | Stripe, Coinbase Commerce, Bank Transfer | Payment intents, redirects, webhooks |
| **Processors** | NowPayments, CoinGate, BTCPay Server | Unified crypto/fiat gateway |

### Payment Types

- **Deposit** - Tenant/affiliate adds funds
- **Payout** - Affiliate withdraws earnings
- **Commission** - Automatic referral commission credits
- **Subscription** - Recurring tenant billing

### Fee Structure

```javascript
// Crypto: 1% service fee + network fee
btc: { deposit: 0.0005, payout: 0.0005, service: 0.01 }
eth: { deposit: 0.005, payout: 0.005, service: 0.01 }
usdt: { deposit: 5, payout: 5, service: 0.01 }
xmr: { deposit: 0.0001, payout: 0.0001, service: 0.01 }

// Fiat: Processor fee + 1% service fee
stripe: { deposit: 0.029, fixed: 0.30, service: 0.01 }
coinbase: { deposit: 0.01, service: 0.01 }
```

### Confirmation Requirements

| Currency | Required Confirmations |
|----------|----------------------|
| BTC | 3 |
| ETH | 12 |
| USDT (ERC20) | 12 |
| XMR | 10 |
| LTC | 6 |
| BCH | 6 |

## 🏢 Multi-Tenant Infrastructure

### Tenant Isolation

Each tenant gets completely isolated data access:

```javascript
// Tenant-scoped KV keys
tenant:{tenantId}:affiliates     // Set of affiliate IDs
tenant:{tenantId}:campaigns      // Set of campaign IDs
tenant:{tenantId}:payments       // Set of payment IDs
tenant:{tenantId}:stats          // Hash with aggregated stats
tenant:{tenantId}:balance        // Hash with currency balances
tenant:{tenantId}:deposit_addresses // Generated deposit addresses
```

### Plan Tiers

| Plan | Price | Affiliates | Campaigns | Storage | API Rate | Features |
|------|-------|------------|-----------|---------|----------|----------|
| Starter | $29/mo | 10 | 5 | 10GB | 100/min | Basic affiliate program |
| Professional | $99/mo | 100 | 50 | 100GB | 1,000/min | Multi-level referrals |
| Business | $299/mo | 1,000 | 500 | 1TB | 5,000/min | Custom commissions, dedicated support |
| Enterprise | $999/mo | Unlimited | Unlimited | Unlimited | 50,000/min | White-label, SLA 99.99%, custom features |

### Tenant Roles

- **tenant** - Owner, full access to tenant settings, billing, all data
- **tenant_admin** - Admin affiliate, can manage affiliates/campaigns within tenant
- **affiliate** - Standard affiliate, owns their campaigns/referrals

## 📡 Webhook Integration

### Supported Providers

| Provider | Endpoint | Events |
|----------|----------|--------|
| Stripe | `/api/payments/webhooks?provider=stripe` | payment_intent.succeeded, payment_intent.payment_failed, etc. |
| Coinbase Commerce | `/api/payments/webhooks?provider=coinbase` | charge:confirmed, charge:failed, charge:pending |
| BlockCypher | `/api/payments/webhooks?provider=blockcypher` | Transaction confirmations |
| Blocknative | `/api/payments/webhooks?provider=blocknative` | Mempool/confirmed events |
| NowPayments | `/api/payments/webhooks?provider=nowpayments` | payment_status changes |
| CoinGate | `/api/payments/webhooks?provider=coingate` | Order status changes |
| BTCPay Server | `/api/payments/webhooks?provider=btcpay` | Invoice status changes |
| Generic | `/api/payments/webhooks?provider=generic` | Manual status updates |

### Webhook Payload Example

```json
{
  "event": "payment.completed",
  "payment": {
    "id": "pay_deposit_123",
    "tenantId": "tenant_abc",
    "amount": 100.00,
    "currency": "USD",
    "type": "deposit",
    "method": "btc",
    "status": "completed",
    "txHash": "abc123...",
    "confirmations": 3,
    "completedAt": "2024-01-15T10:30:00Z"
  }
}
```

## 🔐 Authentication & Authorization

### API Key Types

| Key Type | Prefix | Scope |
|----------|--------|-------|
| Master Admin | (env) | Full system access |
| Tenant API Key | `tk_` | Tenant-scoped operations |
| Tenant API Secret | `ts_` | Sensitive operations |
| Webhook Secret | `whs_` | Webhook verification |
| Affiliate API Key | `ak_` | Affiliate-scoped operations |
| Affiliate API Secret | `as_` | Sensitive affiliate ops |
| Session Token | `sess_` | User sessions (24hr) |
| Refresh Token | `ref_` | Token refresh (30 days) |

### Rate Limiting

Per-tenant rate limits based on plan:

```javascript
// Sliding window (1 minute)
starter: 100 req/min
professional: 1,000 req/min
business: 5,000 req/min
enterprise: 50,000 req/min
```

## 📊 API Endpoints

### Payment API (`/api/payments`)

```
GET    /api/payments                    # List payments (filtered by auth)
GET    /api/payments?id=:id             # Get payment details
POST   /api/payments                    # Create payment (deposit/payout)
PUT    /api/payments                    # Update payment status (admin)
POST   /api/payments/webhooks?provider= # Webhook handlers
```

### Tenant API (`/api/tenants`)

```
GET    /api/tenants                     # List all tenants (admin)
GET    /api/tenants?id=:id              # Get tenant with stats/affiliates/campaigns
POST   /api/tenants                     # Create tenant (admin)
PUT    /api/tenants                     # Update tenant (admin)
DELETE /api/tenants?id=:id              # Delete tenant (admin)
GET    /api/tenants/affiliates          # List tenant affiliates (tenant admin)
POST   /api/tenants/affiliates          # Create affiliate in tenant
PUT    /api/tenants/affiliates          # Update tenant affiliate
DELETE /api/tenants/affiliates?id=:id   # Deactivate affiliate
GET    /api/tenants/campaigns           # List tenant campaigns
POST   /api/tenants/campaigns           # Create campaign in tenant
GET    /api/tenants/billing             # Get billing info
POST   /api/tenants/billing             # Change plan, add payment method, etc.
PUT    /api/tenants/billing             # Cancel/reactivate subscription
```

### Middleware (`/api/tenants/middleware.js`)

Reusable tenant isolation utilities:

```javascript
import { withTenantIsolation, getTenantContext } from './middleware.js';

// Automatically extracts tenant context, enforces isolation
export default withTenantIsolation(async (request, response, context) => {
  // context.tenantId, context.kv (tenant-scoped), context.hasFeature(), etc.
  const affiliates = await context.kv.smembers('affiliates');
});
```

## 🖥️ Frontend Panels

### Admin Panel (`/admin`)

- **Overview** - System-wide stats, revenue charts, recent activity
- **Tenants** - Full CRUD, plan management, billing, affiliate/campaign views
- **Payments** - Global payment monitoring with filters
- **Affiliates** - Cross-tenant affiliate management
- **Campaigns** - Cross-tenant campaign monitoring
- **Analytics** - Revenue trends, plan distribution, payment methods, top tenants
- **Settings** - Master API key, payment provider config, system toggles

### Affiliate Panel (`/affiliate`)

- **Dashboard** - Earnings overview, tier progress, quick actions
- **Referrals** - Multi-level referral tree with earnings
- **Earnings** - Detailed breakdown by referral/campaign/time
- **Payouts** - Request crypto payouts, view history
- **Campaigns** - Create/manage campaigns
- **Settings** - Profile, wallet, 2FA, API keys, notifications

## 🚀 Deployment

### Environment Variables

```bash
# Required
MASTER_API_KEY=your_master_key_here
KV_REST_API_URL=https://your-kv-url.vercel-storage.com
KV_REST_API_TOKEN=your_kv_token

# Payment Providers (optional)
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
COINBASE_COMMERCE_API_KEY=...
COINBASE_WEBHOOK_SECRET=...
BLOCKCYPHER_TOKEN=...
BLOCKNATIVE_TOKEN=...
NOWPAYMENTS_API_KEY=...
NOWPAYMENTS_IPN_SECRET=...
COINGATE_API_TOKEN=...
COINGATE_WEBHOOK_SECRET=...
BTCPAY_URL=https://your-btcpay.com
BTCPAY_API_KEY=...
```

### Local Development

```bash
cd vercel-dashboard
npm install
npm run dev  # Starts vercel dev on localhost:3000
```

### Production Deploy

```bash
npm run build
npm run deploy  # Deploys to Vercel
```

## 📁 Project Structure

```
vercel-dashboard/
├── api/
│   ├── payments/
│   │   ├── index.js          # Core payment processing
│   │   └── webhooks.js       # All webhook handlers
│   ├── tenants/
│   │   ├── index.js          # Tenant CRUD (admin)
│   │   ├── middleware.js     # Tenant isolation middleware
│   │   ├── affiliates.js     # Tenant affiliate management
│   │   ├── campaigns.js      # Tenant campaign management
│   │   └── billing.js        # Subscription/billing management
│   ├── affiliates/           # Affiliate program APIs
│   ├── campaigns/            # Campaign management APIs
│   ├── systems/              # System tracking APIs
│   ├── stats/                # Analytics APIs
│   └── auth/                 # Authentication APIs
├── dashboard/
│   ├── index.html            # Main C2 dashboard
│   ├── app.js                # Main dashboard logic
│   ├── affiliate-index.html  # Affiliate panel HTML
│   ├── affiliate-app.js      # Affiliate panel logic
│   ├── admin-index.html      # Admin panel HTML
│   └── admin-app.js          # Admin panel logic
├── public/                   # Built assets (auto-generated)
├── vercel.json               # Vercel config with rewrites
├── package.json
└── AFFILIATE_README.md
```

## 🔧 Extending the System

### Adding New Payment Provider

1. Add fee structure in `calculateFees()` (`api/payments/index.js`)
2. Add confirmation requirement in `getRequiredConfirmations()`
3. Create webhook handler in `api/payments/webhooks.js`
4. Add provider to frontend payment method selects
5. Configure webhook URL in payment provider dashboard

### Adding New Tenant Feature

1. Add feature flag in `getPlanFeatures()` (`api/tenants/index.js`)
2. Check with `context.hasFeature('featureName')` in middleware
3. Add UI in admin panel settings
4. Implement feature logic in appropriate API

### Custom Commission Structures

For Enterprise tenants with `customCommissionRates: true`:

```javascript
// In tenant settings
commissionStructure: {
  level1: 0.25,  // 25%
  level2: 0.08,  // 8%
  level3: 0.03,  // 3%
  bonus: {       // Volume bonuses
    threshold: 10000,
    bonusRate: 0.02
  }
}
```

## 🛡️ Security Best Practices

1. **Never expose master keys** in client-side code
2. **Use HTTPS only** in production
3. **Verify all webhook signatures** (implement in production)
4. **Rotate API keys** periodically via admin panel
5. **Monitor for suspicious activity** (failed logins, unusual payment patterns)
6. **Implement proper password hashing** (bcrypt) in production
7. **Use parameterized queries** - all KV operations are safe
8. **Validate all inputs** server-side
9. **Implement audit logging** for sensitive operations
10. **Regular backup** of KV data

## 📈 Monitoring & Observability

### Key Metrics to Track

- Payment success/failure rates by provider
- Tenant churn rate
- Affiliate conversion rates
- API latency by tenant
- Revenue per tenant/plan
- Blockchain confirmation times

### Health Checks

```bash
# Check API health
curl https://your-domain.com/api/tenants

# Check webhook endpoints
curl -X POST https://your-domain.com/api/payments/webhooks?provider=stripe \
  -H "Content-Type: application/json" \
  -d '{"type":"test"}'
```

## 📝 License

Part of the Chaos C2 platform. Internal use only.