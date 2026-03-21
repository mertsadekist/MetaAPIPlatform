# Audit Notes — Orthoflex Ads Manager Client Portal
**Date:** 2026-03-22
**Audited By:** Claude (automated page-by-page inspection)
**Reference:** Actual Meta Ads Manager data confirmed by user (AED 1,394.59 all-time spend)

---

## Final Page Status (Post-Fix)

| Page | Status | Notes |
|------|--------|-------|
| Overview | ✅ Fixed | Spend, CTR, Trend all corrected |
| Campaigns | ⚠️ Empty | Asset Discovery blocked by Meta rate limit |
| Creatives | ⚠️ Empty | Asset Discovery blocked by Meta rate limit |
| Leads & Quality | ✅ Empty State OK | No leads (expected — no campaigns in DB) |
| WhatsApp | ⚠️ Empty | Asset Discovery needed + messagesStarted fixed |
| Budget & Pacing | ℹ️ No Data | Budget Pacing job not yet run |
| Competitors | ✅ Empty State OK | Feature not used |
| Comparisons | ✅ Fixed | entityLevel + granularity filter corrected |
| Reports | ✅ Fixed | Currency now reads from DB |
| Alerts | ✅ Fixed | Recommendations engine entityLevel corrected |
| Settings/KPI | ✅ Fixed | Currency labels now dynamic |

---

## BUGS FOUND & STATUS

---

### BUG #1 — CRITICAL: Inflated Spend (5x actual) ✅ FIXED
**Commit:** `0d60f89`
**Affected:** Overview, Comparisons, Reports, all InsightSnapshot-based queries
**User-confirmed actual:** AED 1,394.59 total all-time. Platform showed AED ~6,795 (≈ 5x).

**Root Cause:**
`hourly-sync.ts` used `prisma.insightSnapshot.create()`. Meta API returns **cumulative** daily spend
at each call. Every hourly sync appended a new row with the running total. SUM of all rows = 5× spend.

**Fix Applied:**
1. Added `@@unique([adAccountId, adSetId, dateStart, entityLevel, granularity])` to schema
2. Changed `create()` → `$transaction([deleteMany, create])` in `hourly-sync.ts`
3. Ran `scripts/dedup.js` + `scripts/dedup2.js` to remove duplicate rows (164 → 8 rows)

**Files Changed:** `schema.prisma`, `src/workers/jobs/hourly-sync.ts`

---

### BUG #2 — CRITICAL: Spend Trend Chart Always Empty ✅ FIXED
**Commit:** `0d60f89`
**Affected:** Overview page Spend Trend chart

**Root Cause:**
`insights.service.ts` `getTrendData()` queried `granularity: "daily"` but all data
is stored as `granularity: "hourly"` by the hourly sync. Query returned 0 rows → empty chart.

**Fix Applied:** Changed `granularity: "daily"` → `"hourly"` in `getTrendData()`.

**File Changed:** `src/modules/insights/insights.service.ts`

---

### BUG #3 — CTR Displayed as 135.76% Instead of 1.36% ✅ FIXED
**Commit:** `0d60f89`
**Affected:** Overview page CTR KPI card

**Root Cause:**
Meta API returns CTR already as a percentage string (e.g., `"1.3572"` = 1.36%).
`overview/page.tsx` applied `* 100` → displayed as 135.72%.

**Fix Applied:** Removed `* 100` from the CTR KpiCard value prop.

**File Changed:** `src/app/(dashboard)/clients/[clientId]/overview/page.tsx`

---

### BUG #4 — Currency Hardcoded as "$" Throughout ✅ FIXED
**Commit:** `0d60f89`
**Affected:** Budget & Pacing, Comparisons, Settings KPI Targets, Reports HTML

**Root Cause:** Pages hardcoded `$` instead of reading client's `currencyCode` from DB.

**Fix Applied:**
- `budget/page.tsx`: All amounts now use `Intl.NumberFormat` with currency from API
- `comparisons/page.tsx`: `buildMetrics(fmtCurrency)` factory reads currency from API
- `settings/page.tsx`: KPI target labels use dynamic `${currency}` variable
- `reports/route.ts`: Fetches `client.currencyCode` and passes to HTML builder

**Files Changed:** `budget/page.tsx`, `comparisons/page.tsx`, `settings/page.tsx`, `api/reports/route.ts`

---

### BUG #5 — Comparisons API Returns All Zeros ✅ FIXED
**Commit:** (this session, to be pushed)
**Affected:** Comparisons page — both periods show 0 for all metrics

**Root Cause:**
`api/comparisons/route.ts` `getPeriodMetrics()` queried `entityLevel: "account"` and lacked
a `granularity` filter. No data is stored at `entityLevel: "account"` — all hourly sync data
is stored at `entityLevel: "adset"`. Query returned 0 rows.

**Fix Applied:**
Changed `entityLevel: "account"` → `"adset"` and added `granularity: "hourly"`.
Also fixed the date range filter (`dateStop: { lte: until }` → `dateStart: { lte: until }`).

**File Changed:** `src/app/api/comparisons/route.ts`

---

### BUG #6 — WhatsApp Trend Always Empty ✅ FIXED
**Commit:** (this session, to be pushed)
**Affected:** WhatsApp insights page trend chart

**Root Cause:**
`api/insights/whatsapp/route.ts` trend query used `granularity: "daily"` (line 70).
All data is stored as `granularity: "hourly"`. Query returned 0 rows → empty trend.

**Fix Applied:** Changed `granularity: "daily"` → `"hourly"` in the trend query.

**File Changed:** `src/app/api/insights/whatsapp/route.ts`

---

### BUG #7 — WhatsApp messagesStarted Always 0 ✅ FIXED (DB + Code)
**Affected:** WhatsApp metrics, Overview WA KPI, all messagesStarted aggregations

**Root Cause:**
`src/lib/meta/insights.ts` defined:
```typescript
CONVERSATION_STARTED: "messaging_conversation_started_7d"  // WRONG
```
Correct Meta API action type is: `"onsite_conversion.messaging_conversation_started_7d"`.
The missing `"onsite_conversion."` prefix caused extraction to always return 0.
All 8 InsightSnapshot rows had `messagesStarted = 0` in DB.

**Fix Applied (two-part):**
1. Fixed constant in `insights.ts` (prefix restored)
2. Ran `scripts/backfill-messages.js` — re-read `actionsJson` for all 8 rows, updated DB:
   - Row 1: 0 → 4
   - Row 2: 0 → 6
   - Row 3: 0 → 1
   - Row 4: 0 → 3
   - Row 5: 0 → 1
   - Row 6: 0 → 5
   - Row 7: 0 → 4
   - Row 8: 0 → 5
   **Total: 0 → 29 messages started (correct for 7D window)**

**File Changed:** `src/lib/meta/insights.ts`

---

### BUG #8 — Creative Fatigue Job Never Produces Signals ✅ FIXED
**Commit:** (this session, to be pushed)
**Affected:** Creative fatigue signals, Alerts/Recommendations page

**Root Cause:**
`creative-fatigue.ts` queried `granularity: "daily"` in both aggregate calls (lines 42, 57).
All data is stored as `granularity: "hourly"`. Both queries returned 0 rows → `impressions7d = 0`
→ every creative is skipped via `if (impressions7d < MIN_IMPRESSIONS) continue` → zero fatigue
signals are ever generated.

**Fix Applied:** Changed both `granularity: "daily"` → `"hourly"` in the aggregate queries.

**File Changed:** `src/workers/jobs/creative-fatigue.ts`

---

### BUG #9 — Stale Inflated Report in DB ℹ️ INFO
**Affected:** Reports page shows 1 existing report from 2026-03-22 with `$6,795` spend
**Status:** Not a code bug — this report was generated before the spend fix was applied.
**Action Required:** Regenerate the report from the Reports page to get correct AED-denominated data.
Old report: `status: "completed"`, spend: `$6,795`, currency: `USD`
New report will show: `AED ~1,394` with correct currency.

---

### BUG #10 — March 21 Duplicate Snapshots (10 rows after dedup) ✅ FIXED
**Root Cause:**
First dedup ran before new `deleteMany+create` code was deployed to production.
The old production code ran one more `create()` pass that evening, creating 2 new duplicates.
**Fix Applied:** Ran `scripts/dedup2.js` — deleted 2 duplicate rows (10 → 8 total).

---

## DATA GAPS (require Asset Discovery — blocked by Meta rate limit)

### INFO — Campaigns/Creatives/WhatsApp Pages Empty
All three pages show empty states because `Campaign`, `AdSet`, `Ad`, and `AdCreative` tables
have 0 rows for Orthoflex. Asset Discovery was blocked by Meta rate limit error:
`"User request limit reached"`.

**Workaround options:**
1. Wait for rate limit reset (typically 24h) then run Asset Discovery from admin panel
2. Use the new **Manual Ad Account Entry** feature (planned) to add the specific account by ID

---

## BUGS INVESTIGATED BUT NOT BUGS

### rules.engine.ts — `entityLevel: "account"` (lines 80, 93, 113)
Initially flagged by grep. On closer inspection, these values are in `RuleResult` objects
being pushed to the `results[]` array — they represent the **recommendation entity level**
(i.e., "this recommendation is about an ad account"), NOT a DB query filter.
The actual `InsightSnapshot` queries in this file (lines 64-67, 71-74) correctly use
`entityLevel: "adset"`. **Not a bug.**

### daily-reconcile.ts — `granularity: "daily"` (line 107)
This is a **`prisma.insightSnapshot.create()`** call, not a query filter. The daily reconcile
job intentionally writes daily-granularity snapshots at `entityLevel: "ad"` for D-1/D-2 attribution
reconciliation. These are a different data type from the hourly sync snapshots. **Not a bug.**

---

## DB State Summary (post-fix)

| Table | Orthoflex Rows | Notes |
|-------|---------------|-------|
| InsightSnapshot | 8 | Correctly deduplicated; all with correct messagesStarted |
| Campaign | 0 | Asset Discovery not yet run |
| AdSet | 2 | Discovered indirectly (Beauty & Hair Care, Health & Fitness) |
| Ad | 0 | Asset Discovery not yet run |
| AdCreative | 0 | Asset Discovery not yet run |
| BudgetPacingSnapshot | 0 | Pacing job not run |
| WhatsAppCampaign | 0 | Asset Discovery not yet run |
| Report | 1 | Stale pre-fix report — regenerate |

---

## Commits Summary

| Commit | Description |
|--------|-------------|
| `0d60f89` | Fix: inflated spend (upsert), CTR ×100, trend granularity, currency symbols |
| *(this session)* | Fix: WA action type prefix, comparisons entityLevel, WA trend granularity, creative-fatigue granularity |

---

## Remaining Actions

- [ ] Regenerate the report for Orthoflex (manually, from Reports page)
- [ ] Trigger Asset Discovery when Meta rate limit clears
- [ ] Trigger Budget Pacing sync from admin scheduler
- [ ] Verify comparisons page shows correct AED figures after deployment
- [ ] Set up SMTP env vars for alert emails (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM)
