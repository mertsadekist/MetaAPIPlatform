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

## [0.5.0] — 2026-03-18 · *User & Client Management + Ad Account Permission System*

### Added
- **User CRUD** — full edit, delete, toggle active/inactive, and admin password reset for all users
  - `PATCH /api/users/[userId]` — update `displayName`, `email`, `role`, `isActive` (owner only)
  - `DELETE /api/users/[userId]` — delete user with self-delete guard; returns 400 if attempting own account
  - `PATCH /api/users/[userId]/password` — admin password reset (no current password required)
- **Subscription plan tiers** (Option C) — `starter` / `pro` / `enterprise` field on `Client` model
  - `src/lib/subscriptions/plans.ts` — plan constants (`maxAdAccounts`, `aiFeatures`, `reports`, `alerts`, `sharedLinks`) + `getEffectiveAdAccountLimit()` helper
  - Plan badge displayed on client detail page header and in client edit form
  - Plan features shown in edit form as colored tags (AI, Reports, Alerts, Shared Links)
- **Per-client ad account quota** (Option A) — `maxAdAccounts Int?` on `Client` model
  - Admin can override the plan default with a custom integer limit per client
  - `PATCH /api/admin/ad-accounts` now enforces quota before assignment; returns `400` with descriptive message on limit breach
  - `GET /api/admin/ad-accounts` now returns `{ quota: { limit, plan } }` in the response
  - Quota usage bar shown in client detail stats card ("X / Y assigned")
- **Per-user ad account access restrictions** (Option B) — new `UserAdAccountAccess` Prisma model
  - `GET /api/users/[userId]/ad-accounts?clientId=xxx` — fetch current restrictions for a user scoped to a client
  - `PUT /api/users/[userId]/ad-accounts` — replace access list; empty `adAccountIds` removes all restrictions (user sees all accounts again)
  - Backward-compatible: users with zero entries in `user_ad_account_access` see all accounts (existing behavior unchanged)
- **Per-user permission level on ad accounts** (Option D) — `permissionLevel: "view" | "manage"` on `UserAdAccountAccess`
  - `view` — user can see insights, charts, and metrics for restricted accounts
  - `manage` — user can also trigger syncs, export data, and add notes
- **`getAccessibleAdAccountIds()` helper** in `src/lib/auth/guards.ts`
  - Returns `null` for owner/analyst (bypass, see all) or when no restrictions exist
  - Returns `string[]` of allowed account IDs when restrictions are set
- **Insights API ad account filtering** — all four insight endpoints now apply per-user account restrictions:
  - `GET /api/insights/overview` — scopes KPI aggregation to allowed accounts
  - `GET /api/insights/campaigns` — scopes campaign list and metrics to allowed accounts
  - `GET /api/insights/trend` — scopes trend chart data to allowed accounts
  - `GET /api/insights/creatives` — scopes creative metrics to allowed accounts
  - `insights.service.ts` updated: `getAssignedAdAccountIds()` accepts optional `intersectWith` parameter; all four service functions accept optional `restrictToIds`

### Changed
- **Admin Users page** — full rewrite with professional management UI:
  - Inline **Edit panel** (blue-50 bg) per row: edit displayName, email, role, status
  - Inline **Password panel** (amber-50 bg) per row: new password + confirm with client-side match check
  - Functional **toggle switch** in Status column: animated green/gray pill, PATCH fires on click
  - **Two-step delete confirmation** inline in the Actions cell (no modal)
  - Role badges with distinct colors: owner=purple, analyst=blue, client_manager=green, client_viewer=gray
  - Action buttons: edit (pencil), change password (key), delete (trash)
- **Admin Client Detail page** — augmented with full management capabilities:
  - **Clickable status badge** in header → toggles `isActive` via PUT (no page reload)
  - **Edit Client button** → opens inline form below header; fields: displayName, industry, timezone, currency, notes, subscription plan, custom ad account limit
  - **Delete button** with two-step inline confirmation → DELETE → `router.push("/admin/clients")`
  - **Subscription plan selector** in edit form with plan feature indicators
  - **Ad account quota display** in stats card: `X / Y assigned` or `X assigned (unlimited)`
  - **Per-user ad account restriction panel** (collapsible, indigo-50 bg) inside the Assigned Users table — one per assigned user:
    - Checkboxes for all `isAssigned` ad accounts of the client
    - "All accounts (no restriction)" option to clear all restrictions
    - Permission level radio buttons (View only / Full manage)
    - Save button calls `PUT /api/users/[userId]/ad-accounts`
  - Stats grid now shows `Competitors Tracked` instead of Campaigns (which is not in the `getClient` query)
  - Fixed interface to match actual Prisma schema fields (`currencyCode`, not `currency`; no `slug` or `monthlyBudget`)
- **`client.schema.ts`** — `subscriptionPlan` and `maxAdAccounts` added to both `createClientSchema` and `updateClientSchema`

### Database
- New table: `user_ad_account_access` — links `User` ↔ `AdAccount` with `permissionLevel`; cascades on user/account delete
- New columns on `clients` table: `subscriptionPlan VARCHAR` (default `'pro'`), `maxAdAccounts INT NULL`
- Relations added: `User.adAccountAccess`, `AdAccount.userAccess`

---

## [0.4.4] — 2026-03-18

### Fixed
- **Asset discovery — accounts lost on Meta rate limit** (commit `c51a1e0`)
  Previously, the job collected all accounts into a `allAccountSources[]` array and saved them in a single loop at the end. If Meta returned a rate-limit error (code 17) during Business Manager fetching, the outer `try/catch` aborted before the save loop — even successfully fetched personal accounts were never written to the database. Fixed by extracting a `processAccount()` arrow function that writes each ad account (plus its campaigns/adsets/ads/creatives) to the database immediately upon fetch. Personal accounts are now saved first. Each Business Manager is wrapped in its own isolated `try/catch` so a BM failure does not abort the others.
- **Meta API client — wasted retry budget on rate limit errors** (commit `8a5c1e0`)
  Code 17 (`User request limit reached`) previously triggered the standard exponential-backoff retry (1s, 2s, 4s). Since Meta's rate limit window is ~1 hour, retrying after a few seconds burned quota and always failed. Now throws immediately on code 17 with no retries. Other retryable errors (network timeouts, 5xx) retain the existing retry logic.
- **Meta API client — late proactive throttling** (commit `8a5c1e0`)
  The `x-app-usage` header-based throttle previously only triggered at 75%+ usage. Updated thresholds: 60% → 500ms delay, 75% → 3s delay, 90% → 10s delay — stopping problems earlier before the limit is reached.

### Added
- **"Sync Now" button** on Admin → Meta Connections page (commit `4dbb448`)
  Queues an `hourly_sync` job immediately for the selected client without navigating to the Scheduler tab. The button shows a spinner while pending and displays success/error feedback inline. Calls `POST /api/admin/jobs` with `{ clientId, jobType: "hourly_sync" }`.

### Changed
- **Ad account assignment** — batch save with `isAssigned` filtering (commit `57e9461`)
  - Assignment UI changed from individual checkbox toggles to a batch "Save Assignments" workflow: all changes are collected locally and written in a single `PATCH /api/admin/ad-accounts` request with a `assignments[]` array — eliminates multiple round-trips and flickering.
  - Insights service (`getClientOverview`, `getCampaignList`, etc.) now filters by `isAssigned: true` accounts; unassigned accounts are excluded from all KPI calculations.
  - Ad account row now displays the account `currency` field fetched from the Meta API, replacing the previous placeholder.

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
