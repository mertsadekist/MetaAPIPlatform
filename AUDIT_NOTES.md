# Audit Notes — Orthoflex Ads Manager Client Portal
**Date:** 2026-03-22
**Audited By:** Claude (automated page-by-page inspection)

---

## Page Status Summary

| Page | Status | Issues |
|------|--------|--------|
| Overview | ⚠️ Data Issues | Inflated spend (5x), CTR bug (135%), Trend chart empty |
| Campaigns | ⚠️ Empty | Requires Asset Discovery (rate-limited) |
| Creatives | ⚠️ Empty | Requires Asset Discovery (rate-limited) |
| Leads & Quality | ✅ Empty State OK | No leads (expected) |
| WhatsApp | ⚠️ Empty | Requires Asset Discovery |
| Budget & Pacing | ⚠️ Currency Bug | "$0.00" should be "AED 0.00" |
| Competitors | ✅ Empty State OK | No competitors added |
| Comparisons | ⚠️ Currency Bug | "$0.00" hardcoded for spend |
| Reports | ⚠️ Currency Bug | Report HTML shows "$6,795" not "AED 6,795" |
| Alerts | ✅ Empty State OK | No recommendations yet |
| Settings/KPI | ⚠️ Currency Bug | Labels show "Monthly Budget ($)" not "(AED)" |

---

## CRITICAL BUGS (affect data accuracy)

---

### BUG #1 — CRITICAL: Inflated Spend Numbers (5x actual)
**Severity:** Critical
**Affected:** Overview, Comparisons, Reports, all InsightSnapshot-based queries
**Reported by user:** Actual spend = AED 1,390.10 — Platform shows AED 6,794.81 (≈ 5x)

**Root Cause:**
`src/workers/jobs/hourly-sync.ts` line 92 uses `prisma.insightSnapshot.create()`.
Meta API returns **cumulative daily spend** at each call (e.g., "how much spent today so far").
Every hourly sync creates a **NEW row** with the cumulative total up to that hour.
The insights service then `SUM`s all rows — summing 5 cumulative snapshots = 5x actual spend.

**Evidence:**
```
DB has 164 InsightSnapshot rows for Orthoflex.
2026-03-18, adSet1: 28.33 → 32.44 → 40.18 → 44.32 → ... → 63.57 (13 rows, same adSet, same date)
SUM of all rows = 6,937.83 AED vs actual 1,390.10 AED
```

**Fix Required:**
1. Add `@@unique([adAccountId, adSetId, dateStart, entityLevel, granularity])` to `InsightSnapshot` in `schema.prisma`
2. Change `prisma.insightSnapshot.create()` → `prisma.insightSnapshot.upsert()` using the unique key
3. Delete duplicate rows from DB (keep latest per adSetId+dateStart)

**File:** `src/workers/jobs/hourly-sync.ts` line 92

---

### BUG #2 — CRITICAL: Spend Trend Chart Always Empty
**Severity:** Critical
**Affected:** Overview page Spend Trend chart (shows "No trend data available")

**Root Cause:**
`src/modules/insights/insights.service.ts` line 198:
```typescript
granularity: "daily",   // ← WRONG
```
But `hourly-sync.ts` line 98 stores:
```typescript
granularity: "hourly",  // ← What's actually in DB
```
Mismatch → query returns 0 rows → empty chart.

**Fix Required:**
Change `getTrendData` query filter from `granularity: "daily"` to `granularity: "hourly"`.

**File:** `src/modules/insights/insights.service.ts` line 198

---

### BUG #3 — CTR Displays as 135.76% Instead of 1.36%
**Severity:** High
**Affected:** Overview page CTR KPI card

**Root Cause:**
Meta API returns CTR as a percentage string already (e.g., `"1.3572"` = 1.36%).
`src/app/(dashboard)/clients/[clientId]/overview/page.tsx` line 167:
```typescript
value={overview?.ctr != null ? overview.ctr * 100 : null}  // ← × 100 is wrong
```
1.3572 × 100 = 135.72 displayed as "135.72%"

**Fix Required:**
Remove `* 100`:
```typescript
value={overview?.ctr != null ? overview.ctr : null}
```

**File:** `src/app/(dashboard)/clients/[clientId]/overview/page.tsx` line 167

---

## UI / DISPLAY BUGS

---

### BUG #4 — Currency Symbol Hardcoded as "$" in Multiple Pages
**Severity:** Medium
**Affected:** Budget & Pacing, Comparisons, Reports HTML, Settings KPI Targets

**Root Cause:** Pages hardcode `$` instead of reading client's `currencyCode`.

**Locations:**

| File | Line | Issue |
|------|------|-------|
| `clients/[clientId]/budget/page.tsx` | 92 | `` `$${totalSpent...}` `` |
| `clients/[clientId]/comparisons/page.tsx` | 34,39,40,42 | `(v) => \`$${v.toFixed(2)}\`` for spend, CPL, CPC, CPM |
| `clients/[clientId]/settings/page.tsx` | 168,170,172 | Labels: `"Monthly Budget ($)"` etc |
| `clients/[clientId]/settings/page.tsx` | 238,240,242 | Display values with `$` prefix |
| `app/api/reports/route.ts` | 129,131 | HTML template: `$${spend}` |

**Fix Required:**
Each page needs to fetch the client's `currencyCode` and use it in formatting.
Pattern to use (same as overview page):
```typescript
const [currency, setCurrency] = useState("USD");
// on mount, fetch /api/insights/overview?clientId=X&preset=last_7d
// extract overview?.currency or call a dedicated currency endpoint
```

---

## DATA GAPS (require Asset Discovery — blocked by Meta rate limit)

### BUG #5 — Campaigns Page Empty
`/campaigns` shows "No campaigns yet. Connect Meta account and run Asset Discovery."
The `Campaign` table has 0 rows for Orthoflex because asset discovery was blocked by rate limits.
**Workaround:** Wait for rate limit reset and run Asset Discovery.

### BUG #6 — Creatives Page Empty
Same reason as campaigns — no Ad/Creative records from asset discovery.

### BUG #7 — WhatsApp Page Empty
Same reason — WhatsApp campaigns are detected via asset discovery.

---

## DESIGN / UX OBSERVATIONS

### OBS #1 — Overview Page title text extremely faint
The "Performance Overview" heading uses a gray color that blends into the background.
Already partially fixed via the `globals.css` placeholder fix, but the `h1`/heading text could also be darker.

### OBS #2 — Budget & Pacing always shows "No pacing data"
The budget-pacing job has never run. No `BudgetPacingSnapshot` rows exist.
The job needs to be triggered from the scheduler or admin panel.

### OBS #3 — Comparisons shows $0.00 for Period A (Mar 2026)
Correct for now — the InsightSnapshot data only covers a narrow date window.
After Bug #1 fix, the data will be correct but historical data won't be in the system.

---

## FIX PLAN (Priority Order)

| Priority | Bug | Files to Change |
|----------|-----|----------------|
| 1 | #1 Inflated spend — upsert + schema | `schema.prisma`, `hourly-sync.ts`, DB migration script |
| 2 | #2 Trend chart empty — granularity | `insights.service.ts` |
| 3 | #3 CTR ×100 bug | `overview/page.tsx` |
| 4 | #4 Currency hardcoded $ | `budget/page.tsx`, `comparisons/page.tsx`, `settings/page.tsx`, `reports/route.ts` |
| 5 | #5-7 Empty pages | Resolve rate limit and run Asset Discovery |

---

## DB State Summary
- InsightSnapshot rows: 164 (Orthoflex) — all duplicates from hourly syncs
- Campaign rows: 0 (Orthoflex)
- AdSet rows: 2 (discovered indirectly via InsightSnapshot adSetId)
- Ad/Creative rows: 0
- BudgetPacingSnapshot: 0
