"use client";

import { useState, useEffect } from "react";
import { use } from "react";

interface PeriodMetrics {
  spend: number;
  leads: number;
  clicks: number;
  impressions: number;
  reach: number;
  cpl: number | null;
  cpc: number | null;
  ctr: number | null;
  cpm: number | null;
  activeCampaigns: number;
  days: number;
}

interface ComparisonResult {
  periodA: { since: string; until: string; metrics: PeriodMetrics };
  periodB: { since: string; until: string; metrics: PeriodMetrics };
  deltas: Record<string, number | null>;
}

interface SavedComparison {
  id: string;
  name: string;
  filterPayload: { periodA: { since: string; until: string }; periodB: { since: string; until: string } };
  createdAt: string;
}

type MetricDef = { key: keyof PeriodMetrics; label: string; format: (v: number | null) => string; lowerIsBetter?: boolean };

function buildMetrics(fmtC: (v: number, d?: number) => string): MetricDef[] {
  return [
    { key: "spend",           label: "Total Spend",       format: (v) => v !== null ? fmtC(v, 2) : "—" },
    { key: "leads",           label: "Leads",             format: (v) => v !== null ? v.toLocaleString() : "—" },
    { key: "clicks",          label: "Clicks",            format: (v) => v !== null ? v.toLocaleString() : "—" },
    { key: "impressions",     label: "Impressions",       format: (v) => v !== null ? v.toLocaleString() : "—" },
    { key: "reach",           label: "Reach",             format: (v) => v !== null ? v.toLocaleString() : "—" },
    { key: "cpl",             label: "CPL",               format: (v) => v !== null ? fmtC(v, 2) : "—",  lowerIsBetter: true },
    { key: "cpc",             label: "CPC",               format: (v) => v !== null ? fmtC(v, 3) : "—",  lowerIsBetter: true },
    { key: "ctr",             label: "CTR",               format: (v) => v !== null ? `${v.toFixed(2)}%` : "—" },
    { key: "cpm",             label: "CPM",               format: (v) => v !== null ? fmtC(v, 2) : "—",  lowerIsBetter: true },
    { key: "activeCampaigns", label: "Active Campaigns",  format: (v) => v !== null ? String(v) : "—" },
  ];
}

function DeltaBadge({ delta, lowerIsBetter }: { delta: number | null; lowerIsBetter?: boolean }) {
  if (delta === null) return <span className="text-gray-400 text-xs">—</span>;
  const positive = lowerIsBetter ? delta < 0 : delta > 0;
  const neutral = Math.abs(delta) < 0.5;
  const color = neutral
    ? "bg-gray-100 text-gray-500"
    : positive
    ? "bg-green-100 text-green-700"
    : "bg-red-100 text-red-600";
  const arrow = neutral ? "" : delta > 0 ? "↑" : "↓";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
      {arrow} {Math.abs(delta).toFixed(1)}%
    </span>
  );
}

// Presets relative to today
function getPreset(preset: string): { since: string; until: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const sub = (d: Date, days: number) => { const r = new Date(d); r.setDate(r.getDate() - days); return r; };
  switch (preset) {
    case "last7":    return { since: fmt(sub(today, 7)),  until: fmt(sub(today, 1)) };
    case "last30":   return { since: fmt(sub(today, 30)), until: fmt(sub(today, 1)) };
    case "last90":   return { since: fmt(sub(today, 90)), until: fmt(sub(today, 1)) };
    case "mtd": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { since: fmt(start), until: fmt(today) };
    }
    case "prev_month": {
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      const start = new Date(end.getFullYear(), end.getMonth(), 1);
      return { since: fmt(start), until: fmt(end) };
    }
    default: return { since: fmt(sub(today, 30)), until: fmt(sub(today, 1)) };
  }
}

export default function ComparisonsPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);

  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const sub = (d: Date, days: number) => { const r = new Date(d); r.setDate(r.getDate() - days); return r; };

  const [periodA, setPeriodA] = useState({ since: fmt(sub(today, 30)), until: fmt(sub(today, 1)) });
  const [periodB, setPeriodB] = useState({ since: fmt(sub(today, 60)), until: fmt(sub(today, 31)) });
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedList, setSavedList] = useState<SavedComparison[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [currency, setCurrency] = useState("USD");

  const fmtCurrency = (v: number, decimals = 2) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);

  const METRICS = buildMetrics(fmtCurrency);

  useEffect(() => {
    fetch(`/api/clients/${clientId}`)
      .then((r) => r.json())
      .then((d) => { if (d?.currencyCode) setCurrency(d.currencyCode); })
      .catch(() => {});
    fetch(`/api/comparisons?clientId=${clientId}`)
      .then((r) => r.json())
      .then((d) => setSavedList(d.saved ?? []));
  }, [clientId]);

  async function handleCompare() {
    setLoading(true); setError(null); setResult(null);
    const res = await fetch("/api/comparisons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, periodA, periodB }),
    });
    const data = await res.json();
    if (res.ok) {
      setResult(data);
    } else {
      setError(typeof data.error === "string" ? data.error : "Comparison failed");
    }
    setLoading(false);
  }

  async function handleSave() {
    if (!saveName.trim() || !result) return;
    setSaving(true);
    const res = await fetch("/api/comparisons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, periodA, periodB, saveName }),
    });
    const data = await res.json();
    if (res.ok && data.saved) {
      setSavedList((prev) => [data.saved, ...prev]);
      setSaveName("");
    }
    setSaving(false);
  }

  function loadSaved(s: SavedComparison) {
    setPeriodA(s.filterPayload.periodA);
    setPeriodB(s.filterPayload.periodB);
    setShowSaved(false);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Period Comparisons</h1>
          <p className="text-sm text-gray-500 mt-1">Compare performance metrics across two date ranges</p>
        </div>
        {savedList.length > 0 && (
          <button
            onClick={() => setShowSaved((v) => !v)}
            className="px-3 py-1.5 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50"
          >
            Saved ({savedList.length})
          </button>
        )}
      </div>

      {/* Saved comparisons dropdown */}
      {showSaved && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <h2 className="text-xs font-semibold text-gray-600 mb-3">Saved Comparisons</h2>
          <div className="space-y-2">
            {savedList.map((s) => (
              <button
                key={s.id}
                onClick={() => loadSaved(s)}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <p className="text-sm font-medium text-gray-800">{s.name}</p>
                <p className="text-xs text-gray-400">
                  {s.filterPayload.periodA.since} – {s.filterPayload.periodA.until}
                  {" vs "}
                  {s.filterPayload.periodB.since} – {s.filterPayload.periodB.until}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Period pickers */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Period A */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0" />
              <h3 className="text-sm font-semibold text-gray-700">Period A (Current)</h3>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {[
                { label: "Last 7d", preset: "last7" },
                { label: "Last 30d", preset: "last30" },
                { label: "MTD", preset: "mtd" },
              ].map(({ label, preset }) => (
                <button
                  key={preset}
                  onClick={() => setPeriodA(getPreset(preset))}
                  className="px-2.5 py-1 text-xs border border-gray-200 rounded-full text-gray-600 hover:border-blue-400 hover:text-blue-600"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="date"
                value={periodA.since}
                onChange={(e) => setPeriodA((p) => ({ ...p, since: e.target.value }))}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
              />
              <span className="self-center text-gray-400 text-sm">→</span>
              <input
                type="date"
                value={periodA.until}
                onChange={(e) => setPeriodA((p) => ({ ...p, until: e.target.value }))}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
              />
            </div>
          </div>

          {/* Period B */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-3 h-3 rounded-full bg-gray-400 flex-shrink-0" />
              <h3 className="text-sm font-semibold text-gray-700">Period B (Comparison)</h3>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {[
                { label: "Prev 30d", preset: "last30" },
                { label: "Prev Month", preset: "prev_month" },
                { label: "Last 90d", preset: "last90" },
              ].map(({ label, preset }) => (
                <button
                  key={preset}
                  onClick={() => setPeriodB(getPreset(preset))}
                  className="px-2.5 py-1 text-xs border border-gray-200 rounded-full text-gray-600 hover:border-gray-500 hover:text-gray-800"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="date"
                value={periodB.since}
                onChange={(e) => setPeriodB((p) => ({ ...p, since: e.target.value }))}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
              />
              <span className="self-center text-gray-400 text-sm">→</span>
              <input
                type="date"
                value={periodB.until}
                onChange={(e) => setPeriodB((p) => ({ ...p, until: e.target.value }))}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
              />
            </div>
          </div>
        </div>

        {error && <p className="text-red-500 text-xs mt-3">{error}</p>}

        <div className="mt-4">
          <button
            onClick={handleCompare}
            disabled={loading}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Comparing…" : "Compare Periods"}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Header labels */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
              <p className="text-xs text-blue-500 font-medium">PERIOD A</p>
              <p className="font-semibold text-blue-800 mt-0.5">
                {result.periodA.since} – {result.periodA.until}
              </p>
              <p className="text-xs text-blue-400 mt-0.5">{result.periodA.metrics.days} days</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400 font-medium">vs</p>
              <p className="font-semibold text-gray-600 mt-0.5">Change (A vs B)</p>
              <p className="text-xs text-gray-400 mt-0.5">% difference</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 font-medium">PERIOD B</p>
              <p className="font-semibold text-gray-800 mt-0.5">
                {result.periodB.since} – {result.periodB.until}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{result.periodB.metrics.days} days</p>
            </div>
          </div>

          {/* Metrics table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Metric</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-blue-600">Period A</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Change</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Period B</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {METRICS.map(({ key, label, format, lowerIsBetter }) => {
                  const valA = result.periodA.metrics[key] as number | null;
                  const valB = result.periodB.metrics[key] as number | null;
                  const delta = result.deltas[key as string] ?? null;
                  return (
                    <tr key={key} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-700">{label}</td>
                      <td className="px-4 py-3 text-right font-semibold text-blue-700">{format(valA)}</td>
                      <td className="px-4 py-3 text-center">
                        <DeltaBadge delta={delta} lowerIsBetter={lowerIsBetter} />
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{format(valB)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Save comparison */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-600 mb-3">Save This Comparison</h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Give this comparison a name…"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
              />
              <button
                onClick={handleSave}
                disabled={saving || !saveName.trim()}
                className="px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900 disabled:opacity-40"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
