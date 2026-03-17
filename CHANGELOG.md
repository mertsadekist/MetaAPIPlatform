# Changelog

All notable changes to the **Meta Ads Intelligence Platform** are documented in this file.

> **Versioning scheme:** `MAJOR.MINOR.PATCH`
> - `MINOR` bumps mark a completed development phase (significant new feature set)
> - `PATCH` bumps mark bug fixes, UI improvements, and small enhancements
> - Version `1.0.0` will be tagged on the first production-ready, fully-tested release

---

## [Unreleased]
Planned for upcoming phases:
- Comparisons page (period-over-period full UI)
- Competitors page (full UI with ad library snapshots)
- Alert dispatcher integration into scheduler
- Two-factor authentication (2FA) enforcement UI
- Billing management panel

---

## [0.4.3] — 2026-03-17

### Fixed
- **`POST /api/users` — 400 Bad Request on empty email field**
  Zod schema rejected empty string `""` for the optional `email` field because `z.string().email()` does not accept empty strings even when marked `.optional()`. Fixed using `z.preprocess()` to coerce `""` → `undefined` before validation. Same fix applied to `displayName`.
- **`POST /api/users` — 500 Internal Server Error with empty response body**
  ZodError check used `error.name === "ZodError"` which could miss edge cases. Replaced with `instanceof z.ZodError` for reliable detection. Errors that fell through to `handleAuthError` caused an unhandled exception returning a 500 with no JSON body, crashing the client-side parser (`Unexpected end of JSON input`). Now returns proper JSON for all error paths.
- **`POST /api/users` — Prisma unique constraint (P2002) now returns 409**
  Creating a user with a duplicate username or email now returns `409 Conflict` with a descriptive message instead of an opaque 500.

### Changed
- **Meta Connections page — color contrast**
  "Select Client" dropdown was missing `text-gray-900 bg-white`. Text appeared faint/invisible against the white background. All inputs and selects in the manual token form also updated with `text-gray-900 placeholder:text-gray-400`.
- **Meta Connections page — added onboarding guide**
  When no client is selected, the page now shows a full instructional panel: 4-step connection flow (Select Client → Connect with Facebook → Discover Assets → Verify Ad Accounts), a Meta App setup warning box, and a comparison between OAuth and Manual System User auth modes.
- **Meta Connections page — connection status strip**
  After selecting a client, active/total connection count badges appear inline next to the selector.
- **Meta Connections page — page header**
  Added subtitle: *"Link clients to their Meta ad accounts for automated data sync"*.

---

## [0.4.2] — 2026-03-16

### Fixed
- **`POST /api/users` — crash after creating new user**
  The POST handler's Prisma `select` was missing `_count: { select: { clientAccess: true } }`. The newly created user object was prepended to the list without the `_count` field, causing `Cannot read properties of undefined (reading 'clientAccess')` on every row render.

### Changed
- **Global input text visibility**
  Across all admin and client form pages, typed text was nearly invisible because input/select/textarea elements lacked an explicit text color. Added `text-gray-900 placeholder:text-gray-400` (and `bg-white` for selects) to every affected element in:
  - `admin/users/page.tsx` — username, display name, email, password inputs; role select
  - `admin/clients/new/page.tsx` — client name, industry, timezone, currency, notes
  - `admin/settings/page.tsx` — test email input; manual job trigger select
  - `admin/clients/[id]/page.tsx` — user-assignment selects
  - `admin/clients/[id]/kpi-targets/page.tsx` — month selector and all numeric KPI inputs
  - `clients/[clientId]/reports/page.tsx` — report type and date range selects
  - `clients/[clientId]/comparisons/page.tsx` — period date inputs
  - `clients/[clientId]/competitors/page.tsx` — competitor name and URL inputs

---

## [0.4.1] — 2026-03-15

### Fixed
- **Coolify deployment — `SMTP_*` wildcard variable crash**
  Environment variable named `SMTP_*` is invalid in bash (wildcard character in variable name). Caused both the Coolify build-time `.env` sourcing and Docker Compose `.env` parsing to fail with a syntax error. Replaced with individual variables: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_PASS`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`, `SMTP_FROM`.
- **Coolify deployment — `TOKEN_ENCRYPTION_KEY` set to command string**
  The key was set to the Node.js command text instead of its output. Generated a proper 64-character hex value using `crypto.randomBytes(32).toString('hex')`.
- **Coolify deployment — NextAuth redirecting to `0.0.0.0:3000/login?error=Configuration`**
  NextAuth v5 beta requires `AUTH_URL` in addition to `NEXTAUTH_URL`. Added `AUTH_URL=https://yourdomain.com` to the required environment variables.

### Changed
- **Dockerfile — multi-stage ARG/ENV pass-through**
  Environment variables set as Docker build ARGs were not surviving to the `runner` stage in the multi-stage Dockerfile, causing them to be `undefined` at runtime. Added explicit `ARG` + `ENV` redeclarations in the runner stage for all required variables (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `NEXTAUTH_URL`, `TOKEN_ENCRYPTION_KEY`, `META_*`, `AI_*`, `SMTP_*`, `NEXT_PUBLIC_APP_URL`).

### Added
- **`README.md` — professional documentation**
  Full project README with: Overview, Features breakdown, Tech Stack table, Getting Started steps, complete Environment Variables reference, Database Setup, Coolify Deployment guide (including minimum required vars for first deploy), Architecture directory tree, full API Reference tables, Roles & Permissions matrix, and Background Workers schedule.

---

## [0.4.0] — 2026-03-12 · *Phase 4 — Client Operations*

### Added
- **KPI Targets** — monthly targets for spend, impressions, clicks, CTR, ROAS, CPA with upsert API (`GET/PUT /api/clients/[clientId]/kpi-targets`)
- **Lead Management** — paginated lead table with status filter pills (qualified / unqualified / pending), inline quality update, and CSV export with date-range and status filters (`GET /api/leads`, `PUT /api/leads/[id]/quality`, `GET /api/leads/export`)
- **Reports** — report generation form (type + date range), async inline generation, polling until complete, downloadable HTML output (`GET/POST /api/reports`, `GET /api/reports/[id]`, `GET /api/reports/[id]/download`)
- **Client Settings page** — 3-tab layout: KPI Targets, Alert Recipients, Shared Dashboard Links
- **Alert Recipients** — manage email recipients per client for automated alert dispatch (`GET/POST /api/alerts/recipients`)
- **Shared Dashboard Links** — generate public token-based dashboard links with configurable expiry, revoke links (`GET/POST /api/shared-links`, `DELETE /api/shared-links/[token]`)

---

## [0.3.0] — 2026-03-08 · *Phase 3 — Intelligence Layer*

### Added
- **AI Creative Analysis** — text and image analysis via Anthropic Claude (`claude-sonnet-4-6`); scores for hook strength, CTA clarity, visual quality, and brand consistency stored per creative
- **Creative Fatigue Detection** — worker detects fatigued creatives based on frequency threshold and CTR drop signals; fires `creative_fatigue` alerts
- **AI Recommendations** — narrative summaries and campaign recommendations generated on demand or via background worker; dismiss workflow with audit trail
- **Alert Dispatcher** — rule-based alert engine dispatches pending alerts via Nodemailer/SMTP with configurable recipient lists
- **Scheduler updates** — added `creative_fatigue` (12h) and `creative_analysis` (24h) job types to the in-process scheduler
- **Insights API** — `/api/insights/overview` (KPI summary), `/api/insights/campaigns`, `/api/insights/creatives`, `/api/insights/trend`, `/api/insights/whatsapp`
- **Creative detail page** — AI scores panel, performance trend chart, fatigue signal indicators
- **WhatsApp Intelligence page** — WhatsApp campaign metrics and trend chart
- **Shared dashboard** — public read-only view at `/shared/[token]` (no authentication required)
- **Notes system** — pin notes to clients or campaigns; full CRUD with author tracking; collapsible panel on overview and campaign detail pages

### Changed
- Client Overview page upgraded with KPI cards, budget pacing strip, spend trend chart (Recharts), and notes panel
- Campaigns page upgraded with full metrics table (spend, impressions, clicks, CTR, CPC, ROAS, CPA) and sortable columns

---

## [0.2.0] — 2026-03-04 · *Phase 2 — Meta API Integration*

### Added
- **Meta token encryption** — AES-256-GCM encryption for all stored access tokens using `TOKEN_ENCRYPTION_KEY`
- **Meta connection management** — save, validate, and delete Meta connections per client; support for System User and User Token auth modes (`POST /api/meta/connect`, `POST /api/meta/validate`, `GET/DELETE /api/meta/connections/[id]`)
- **Facebook OAuth flow** — popup-based OAuth login using Meta's authorization dialog; `window.postMessage` result passing; long-lived token exchange; `GET /api/meta/oauth` and `GET /api/meta/oauth/callback`
- **Asset discovery** — queues a background job to fetch all ad accounts, campaigns, ad sets, ads, and creatives from Meta Graph API (`POST /api/meta/discover`)
- **Background scheduler** — in-process job queue (`src/workers/scheduler.ts`) seeded at app startup via `src/instrumentation.ts`
- **Worker jobs** — `hourly_sync` (1h), `daily_reconcile` (24h), `budget_pacing` (6h), `asset_discovery` (on-demand)
- **Sync logs** — job run history with status, duration, and error details; accessible at `/admin/sync-logs`
- **Meta Connections admin page** — UI for connecting clients to Meta accounts, validating tokens, running discovery, and viewing ad accounts table

### Changed
- Admin sidebar updated with Meta Connections and Sync Logs navigation items

---

## [0.1.0] — 2026-02-26 · *Phase 1 — Foundation*

### Added
- **Next.js 16.1.6** project scaffold with App Router, TypeScript 5, Tailwind CSS v4, standalone Docker output
- **MySQL 8 + Prisma v6** — full schema: `User`, `Client`, `UserClientAccess`, `MetaConnection`, `AdAccount`, `Campaign`, `AdSet`, `Ad`, `Creative`, `Lead`, `Note`, `Alert`, `Recommendation`, `Report`, `SharedDashboardLink`, `AuditLog`, `SyncJob`, `SyncRun`, `BudgetPacing`
- **Authentication** — NextAuth v5 beta with credentials provider (username + password), JWT strategy, bcryptjs hashing
- **RBAC** — four roles: `owner`, `analyst`, `client_manager`, `client_viewer`; route guards via `requireRole`, `requireClientAccess`, `requirePermission` in `@/lib/auth/guards`
- **Rate limiting** — login endpoint rate limited (5 attempts / 15 min per IP)
- **Admin panel** — dashboard with client and user count cards; client management (list, create, edit, user assignment); user management (list, create); audit log with scope filtering
- **Seed script** — `prisma/seed.ts` creates the first owner account from `SEED_OWNER_*` env vars
- **Health check** — `GET /api/health` returns `{ status: "ok" }`
- **Audit logging** — `logAuditEvent()` utility records all system events to `AuditLog` table with entity ref, scope, and metadata
- **Pino structured logger** — environment-aware logging (`LOG_LEVEL` env var)
- **Docker** — multi-stage Dockerfile (deps → builder → runner) with non-root user; Coolify-compatible

---

*This changelog is maintained manually. For the full git commit history, run `git log --oneline`.*
