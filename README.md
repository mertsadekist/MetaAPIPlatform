# Meta Ads Intelligence Platform

A full-stack SaaS platform for managing, analyzing, and optimizing Meta (Facebook/Instagram) advertising campaigns. Built with Next.js 16, Prisma, MySQL, and powered by AI-driven insights.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Deployment on Coolify](#deployment-on-coolify)
- [Architecture](#architecture)
- [API Reference](#api-reference)
- [Roles & Permissions](#roles--permissions)
- [Background Workers](#background-workers)

---

## Overview

Meta Ads Intelligence Platform is a white-label dashboard that connects to the Meta Marketing API and gives agencies and advertisers a unified view of their ad performance. It supports multiple clients, AI-powered creative analysis, lead quality management, budget pacing tracking, WhatsApp campaign monitoring, and automated alert dispatching.

---

## Features

### 📊 Analytics & Reporting
- Real-time KPI overview (spend, impressions, clicks, CTR, ROAS, CPA)
- Campaign-level and ad-set-level breakdowns
- Period-over-period comparisons with custom date ranges and presets
- Budget pacing with projected overspend alerts
- Downloadable HTML reports with auto-generation and polling

### 🤖 AI Intelligence Layer
- Creative text and image analysis via Claude (Anthropic)
- Creative fatigue detection based on frequency and CTR drop signals
- Automated recommendation generation with dismiss workflow
- Narrative summaries for campaign performance

### 🔔 Alerts & Notifications
- Rule-based alert system with email dispatch
- Unread notification bell with live badge count (auto-refreshes every 60s)
- Alert history with scope filtering
- Configurable SMTP delivery

### 👥 Lead Management
- Lead capture from Meta Lead Ads
- Quality scoring (qualified / unqualified / pending)
- Paginated lead table with status filter pills
- CSV export with date-range and status filters

### 🏢 Multi-Client & RBAC
- Admin panel with full client and user management
- Per-client user access control with role assignment
- Role-based permissions (admin, manager, analyst, viewer)
- Audit log for all system events with scope filtering
- Sync log with job history and run status

### 🔗 Meta API Integration
- System User and User Token auth modes
- Token validation with scope checking before saving
- Automatic asset discovery (accounts, campaigns, ad sets, ads, creatives)
- Background sync workers (hourly, daily, budget pacing)

### 🛡️ Competitor Intelligence
- Track competitor Facebook Page ad activity
- Ad Library snapshots with spend and impression estimates
- Expandable ad creative previews

### 📤 Shared Dashboards
- Generate shareable public dashboard links with token-based access
- Configurable expiry (days)
- No login required for shared view

### 📝 Notes
- Pin notes to clients or campaigns
- Full CRUD with author tracking
- Collapsible panel integrated into overview and campaign detail pages

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.1.6 (App Router, standalone output) |
| Language | TypeScript 5 |
| Database | MySQL 8 + Prisma ORM v6 |
| Auth | NextAuth v5 beta (JWT strategy, bcryptjs) |
| AI | Anthropic Claude (claude-sonnet-4-6) |
| Charts | Recharts |
| Styling | Tailwind CSS v4 |
| Background Jobs | Custom in-process scheduler |
| Email | Nodemailer (SMTP) |
| Encryption | AES-256-GCM (Node.js crypto) |
| Container | Docker (multi-stage, standalone) |
| Deployment | Coolify |

---

## Prerequisites

- Node.js 20+
- MySQL 8 database
- Meta Developer App (App ID + App Secret) — from [developers.facebook.com](https://developers.facebook.com)
- Anthropic API key — from [console.anthropic.com](https://console.anthropic.com)
- SMTP server for email alerts

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/mertsadekist/MetaAPIPlatform.git
cd MetaAPIPlatform
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
# Edit .env with your values (see Environment Variables section below)
```

### 4. Push database schema

```bash
npx prisma db push
```

### 5. Seed the admin user

```bash
npx tsx prisma/seed.ts
```

### 6. Start the development server

```bash
npm run dev
# App runs at http://localhost:3005
```

### 7. Login

```
URL:      http://localhost:3005
Username: admin
Password: Admin@123456  (or as configured in SEED_OWNER_PASSWORD)
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values below.

### Database
```env
DATABASE_URL=mysql://user:password@host:3306/database
```

### Authentication
```env
AUTH_SECRET=<random 32-byte base64 string>
AUTH_URL=https://yourdomain.com
NEXTAUTH_URL=https://yourdomain.com
```

> **Generate AUTH_SECRET:**
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
> ```

### Encryption
```env
TOKEN_ENCRYPTION_KEY=<64-character hex string>
```

> **Generate TOKEN_ENCRYPTION_KEY:**
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

### Meta Marketing API
```env
META_APP_ID=your_app_id_number
META_APP_SECRET=your_app_secret
META_GRAPH_API_VERSION=v21.0
META_AD_LIBRARY_ENABLED=true
META_AD_LIBRARY_DEFAULT_COUNTRIES=SA,AE,EG,KW,QA
```

### AI Provider (Anthropic)
```env
AI_PROVIDER=anthropic
AI_API_KEY=sk-ant-api03-...
AI_MODEL_TEXT=claude-sonnet-4-6
AI_MODEL_VISION=claude-sonnet-4-6
```

### Email (SMTP)
```env
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_USER=no-reply@yourdomain.com
SMTP_PASSWORD=your_smtp_password
SMTP_PASS=your_smtp_password
SMTP_FROM_EMAIL=no-reply@yourdomain.com
SMTP_FROM_NAME=Meta Ads Platform
SMTP_FROM=Meta Ads Platform <no-reply@yourdomain.com>
```

### App Settings
```env
NEXT_PUBLIC_APP_URL=https://yourdomain.com
SHARED_LINK_EXPIRY_DAYS=7
LOG_LEVEL=info
NODE_ENV=production
```

### Alert Thresholds (optional)
```env
ALERT_CREATIVE_FATIGUE_FREQUENCY=3.0
ALERT_CREATIVE_FATIGUE_CTR_DROP=0.3
```

### WhatsApp via Twilio (optional)
```env
WA_NOTIFICATION_PROVIDER=twilio
WA_TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx
WA_TWILIO_AUTH_TOKEN=your_auth_token
WA_TWILIO_FROM_PHONE=whatsapp:+14155238886
```

### Telegram (optional)
```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_ENABLED=false
```

### Seed Script
```env
SEED_OWNER_USERNAME=admin
SEED_OWNER_EMAIL=admin@yourdomain.com
SEED_OWNER_PASSWORD=Admin@123456
```

---

## Database Setup

This project uses Prisma with MySQL. Because the remote database has no shadow database, use `db push` instead of `migrate dev`:

```bash
# Initial setup or after any schema change
npx prisma db push --accept-data-loss

# View and edit data in browser UI
npx prisma studio

# Regenerate Prisma client after schema changes
npx prisma generate
```

---

## Deployment on Coolify

### 1. Create a new application
- **Source:** GitHub → `mertsadekist/MetaAPIPlatform`
- **Branch:** `main`
- **Build Pack:** Dockerfile

### 2. Set environment variables in Coolify UI

Go to **Service → Environment Variables** and add each variable individually.

> ⚠️ **Critical:** Never use wildcard names like `SMTP_*`. Every variable must have an exact name (`SMTP_HOST`, `SMTP_PORT`, etc.).

### 3. Minimum required variables for first deploy

| Variable | Description |
|---|---|
| `DATABASE_URL` | Full MySQL connection string |
| `AUTH_SECRET` | Random 32-byte base64 string |
| `AUTH_URL` | Your public HTTPS domain (e.g. `https://metalive.cloud`) |
| `NEXTAUTH_URL` | Same as AUTH_URL |
| `TOKEN_ENCRYPTION_KEY` | 64-character hex string |
| `NEXT_PUBLIC_APP_URL` | Same as AUTH_URL |
| `META_APP_ID` | Numeric App ID from Meta Developers |
| `META_APP_SECRET` | App Secret from Meta Developers |
| `AI_API_KEY` | Anthropic API key (`sk-ant-...`) |

### 4. After first deploy — initialize database

Connect to the container terminal in Coolify and run:

```bash
npx prisma db push
npx tsx prisma/seed.ts
```

### 5. Redeploy

Trigger a redeploy from the Coolify dashboard. The app will be available at your configured domain.

---

## Architecture

```
src/
├── app/
│   ├── (auth)/login/              # Login page
│   ├── (dashboard)/
│   │   ├── admin/                 # Admin panel
│   │   │   ├── page.tsx           # Dashboard
│   │   │   ├── clients/           # Client management + KPI targets
│   │   │   ├── users/             # User management
│   │   │   ├── meta/              # Meta connections
│   │   │   ├── sync-logs/         # Sync job history
│   │   │   ├── audit-logs/        # System audit trail
│   │   │   └── settings/          # Platform settings
│   │   └── clients/[clientId]/    # Per-client portal
│   │       ├── overview/          # KPIs + spend trend + notes
│   │       ├── campaigns/         # Campaign table + detail
│   │       ├── creatives/         # Creative gallery + detail
│   │       ├── leads/             # Lead table + export
│   │       ├── whatsapp/          # WhatsApp campaign metrics
│   │       ├── budget/            # Budget pacing cards
│   │       ├── competitors/       # Competitor intelligence
│   │       ├── comparisons/       # Period-over-period compare
│   │       ├── reports/           # Report generation + history
│   │       ├── alerts/            # Recommendations center
│   │       └── settings/          # KPI targets, recipients, links
│   ├── api/                       # All API route handlers
│   ├── shared/[token]/            # Public shared dashboard
│   └── page.tsx                   # Root redirect
│
├── components/
│   ├── layout/                    # AdminSidebar, ClientSidebar, NotificationBell
│   └── notes/                     # NotesPanel
│
├── lib/
│   ├── auth/                      # NextAuth config, guards, rate limiting
│   ├── ai/                        # Anthropic provider + prompt templates
│   ├── db/                        # Prisma client singleton
│   ├── meta/                      # Token encryption, Meta API helpers
│   └── logger.ts                  # Pino structured logger
│
├── modules/
│   └── meta/                      # Meta service, schema validation, types
│
├── workers/
│   ├── jobs/                      # Individual job implementations
│   │   ├── asset-discovery.ts
│   │   ├── hourly-sync.ts
│   │   ├── daily-reconcile.ts
│   │   ├── budget-pacing.ts
│   │   ├── creative-fatigue.ts
│   │   ├── creative-analysis.ts
│   │   └── alert-dispatcher.ts
│   └── scheduler.ts               # In-process job queue + seedGlobalJobs()
│
├── instrumentation.ts             # App startup hook — seeds global jobs
└── middleware.ts                  # Auth route protection (Next.js Proxy)
```

---

## API Reference

All endpoints require an authenticated session cookie unless noted.

### Insights

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/insights/overview` | KPI summary for a client |
| `GET` | `/api/insights/campaigns` | Campaign metrics list |
| `GET` | `/api/insights/creatives` | Creative gallery with fatigue signals |
| `GET` | `/api/insights/creatives/[id]` | Creative detail with AI scores |
| `GET` | `/api/insights/trend` | Spend trend time series |
| `GET` | `/api/insights/whatsapp` | WhatsApp campaign metrics |

### Leads

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/leads` | Paginated lead list with filters |
| `PUT` | `/api/leads/[id]/quality` | Update lead quality status |
| `GET` | `/api/leads/export` | CSV export with filters |

### Campaigns & Comparisons

| Method | Endpoint | Description |
|---|---|---|
| `GET/POST` | `/api/comparisons` | Run or save period comparison |
| `GET/POST` | `/api/competitors` | Competitor profile management |
| `PATCH/DELETE` | `/api/competitors/[id]` | Update or deactivate competitor |

### Recommendations & Alerts

| Method | Endpoint | Description |
|---|---|---|
| `GET/POST` | `/api/recommendations` | List or generate AI recommendations |
| `POST` | `/api/recommendations/run` | Trigger AI recommendation run |
| `POST` | `/api/recommendations/[id]/dismiss` | Dismiss a recommendation |
| `GET` | `/api/alerts/history` | Alert dispatch history |
| `GET/POST` | `/api/alerts/recipients` | Manage alert email recipients |
| `GET` | `/api/alerts/unread` | Unread count + recent alerts for bell |

### Reports & Notes

| Method | Endpoint | Description |
|---|---|---|
| `GET/POST` | `/api/reports` | List or generate reports |
| `GET` | `/api/reports/[id]` | Report detail + HTML content |
| `GET` | `/api/reports/[id]/download` | Download report as HTML file |
| `GET/POST` | `/api/notes` | List or create notes |
| `PUT/DELETE` | `/api/notes/[id]` | Update or delete a note |

### Meta Integration

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/meta/connect` | Save new Meta connection |
| `POST` | `/api/meta/validate` | Validate access token + check scopes |
| `POST` | `/api/meta/discover` | Queue asset discovery job |
| `GET` | `/api/meta/connections` | List connections for client |
| `DELETE` | `/api/meta/connections/[id]` | Delete a Meta connection |

### Shared Links & Pacing

| Method | Endpoint | Description |
|---|---|---|
| `GET/POST` | `/api/shared-links` | List or create shared dashboard links |
| `DELETE` | `/api/shared-links/[token]` | Revoke a shared link |
| `GET` | `/api/shared-links/[token]/view` | Public view (no auth) |
| `GET` | `/api/pacing` | Budget pacing snapshots |

### System

| Method | Endpoint | Description |
|---|---|---|
| `GET/POST` | `/api/sync/jobs` | List or create sync jobs |
| `POST` | `/api/sync/run` | Manually trigger a sync job |
| `GET` | `/api/sync/runs` | Sync run history |
| `GET/PUT` | `/api/profile` | View or update current user profile |
| `GET` | `/api/health` | Health check (`{ status: "ok" }`) |

---

## Roles & Permissions

| Permission | Admin | Manager | Analyst | Viewer |
|---|:---:|:---:|:---:|:---:|
| View all clients | ✅ | ❌ | ❌ | ❌ |
| Manage clients | ✅ | ❌ | ❌ | ❌ |
| Manage users | ✅ | ❌ | ❌ | ❌ |
| Connect Meta accounts | ✅ | ✅ | ❌ | ❌ |
| Manage Meta connections | ✅ | ✅ | ❌ | ❌ |
| Trigger sync jobs | ✅ | ✅ | ❌ | ❌ |
| View audit logs | ✅ | ❌ | ❌ | ❌ |
| Manage system settings | ✅ | ❌ | ❌ | ❌ |
| Manage billing | ✅ | ❌ | ❌ | ❌ |
| Export leads | ✅ | ✅ | ✅ | ❌ |
| View client data | ✅ | ✅ | ✅ | ✅ |

---

## Background Workers

Jobs are seeded at app startup via `src/instrumentation.ts` and managed by an in-process scheduler.

| Job | Interval | Scope | Description |
|---|---|---|---|
| `hourly_sync` | 1 hour | Per client | Sync latest metrics from Meta API |
| `daily_reconcile` | 24 hours | Per client | Full reconciliation of campaigns and ads |
| `budget_pacing` | 6 hours | Per client | Update budget pacing snapshots |
| `creative_fatigue` | 12 hours | Per client | Detect fatigued creatives by frequency and CTR |
| `creative_analysis` | 24 hours | Per client | Run AI analysis on new creatives |
| `alert_dispatch` | 15 minutes | Global | Dispatch pending alerts via email |

### Manual sync trigger

```http
POST /api/sync/run
Content-Type: application/json

{
  "clientId": "client-uuid-here",
  "jobType": "hourly_sync"
}
```

---

## License

Private — All rights reserved © 2025 Meta Ads Intelligence Platform
