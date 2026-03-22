"use client";

import { useState, useEffect } from "react";
import { use } from "react";

interface PacingSnapshot {
  id: string;
  pacingStatus: string;
  pacingPercent: number | null;
  monthBudget: number | null;
  spentToDate: number | null;
  projectedSpend: number | null;
  dailyRunRate: number | null;
  daysElapsed: number;
  daysRemaining: number;
  snapshotDate: string;
  adAccount: {
    metaAdAccountId: string;
    name: string | null;
    currency: string;
  };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bar: string }> = {
  on_track:    { label: "On Track",     color: "text-green-700",  bar: "bg-green-500" },
  overpacing:  { label: "Overpacing",   color: "text-red-600",    bar: "bg-red-500" },
  underpacing: { label: "Underpacing",  color: "text-yellow-600", bar: "bg-yellow-500" },
  exhausted:   { label: "Exhausted",    color: "text-gray-500",   bar: "bg-gray-400" },
  no_budget:   { label: "No Budget Set",color: "text-gray-400",   bar: "bg-gray-200" },
};

function PacingBar({ pct, status }: { pct: number | null; status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.on_track;
  const display = Math.min(100, Math.max(0, pct ?? 0));
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>Budget Used</span>
        <span className={`font-semibold ${cfg.color}`}>{pct != null ? `${pct.toFixed(1)}%` : "—"}</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${cfg.bar}`}
          style={{ width: `${display}%` }}
        />
      </div>
    </div>
  );
}

export default function BudgetPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);
  const [snapshots, setSnapshots] = useState<PacingSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState("USD");

  useEffect(() => {
    // Fetch client currency
    fetch(`/api/clients/${clientId}`)
      .then((r) => r.json())
      .then((d) => { if (d?.currencyCode) setCurrency(d.currencyCode); })
      .catch(() => {});
    // Fetch pacing data
    fetch(`/api/pacing?clientId=${clientId}`)
      .then((r) => r.json())
      .then((d) => {
        const snaps = (d.snapshots ?? []).map((s: Record<string, unknown>) => ({
          ...s,
          monthBudget:    s.monthBudget    != null ? Number(s.monthBudget)    : null,
          spentToDate:    s.spentToDate    != null ? Number(s.spentToDate)    : null,
          projectedSpend: s.projectedSpend != null ? Number(s.projectedSpend) : null,
          dailyRunRate:   s.dailyRunRate   != null ? Number(s.dailyRunRate)   : null,
          pacingPercent:  s.pacingPercent  != null ? Number(s.pacingPercent)  : null,
        }));
        setSnapshots(snaps);
        // Use currency from first adAccount if available
        if (snaps[0]?.adAccount?.currency) setCurrency(snaps[0].adAccount.currency);
        setLoading(false);
      });
  }, [clientId]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);

  // Aggregate totals
  const totalBudget   = snapshots.reduce((s, r) => s + (r.monthBudget ?? 0), 0);
  const totalSpent    = snapshots.reduce((s, r) => s + (r.spentToDate ?? 0), 0);
  const totalProjected = snapshots.reduce((s, r) => s + (r.projectedSpend ?? 0), 0);
  const overallPct    = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : null;

  const now = new Date();
  const monthName = now.toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Budget Pacing</h1>
        <p className="text-sm text-gray-500 mt-1">{monthName} · Real-time spend vs budget tracking</p>
      </div>

      {/* Monthly summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Monthly Budget",     value: totalBudget   > 0 ? fmt(totalBudget) : "—" },
          { label: "Spent to Date",      value: fmt(totalSpent) },
          { label: "Projected Month-End",value: totalProjected > 0 ? fmt(totalProjected) : "—" },
          { label: "Budget Consumed",    value: overallPct != null ? `${overallPct.toFixed(1)}%` : "—" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">{kpi.label}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Per-account cards */}
      {loading ? (
        <div className="p-8 text-center text-gray-400 text-sm">Loading pacing data…</div>
      ) : snapshots.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-14 text-center shadow-sm">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-gray-600 font-medium">No pacing data available</p>
          <p className="text-gray-400 text-sm mt-1">Run a Budget Pacing sync job to populate this page.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {snapshots.map((snap) => {
            const cfg = STATUS_CONFIG[snap.pacingStatus] ?? STATUS_CONFIG.on_track;
            const remaining = (snap.monthBudget ?? 0) - (snap.spentToDate ?? 0);
            return (
              <div key={snap.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">
                      {snap.adAccount.name ?? snap.adAccount.metaAdAccountId}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {snap.adAccount.currency} · {snap.daysElapsed}d elapsed · {snap.daysRemaining}d remaining
                    </p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold bg-opacity-10 ${
                    snap.pacingStatus === "on_track"    ? "bg-green-100 text-green-700" :
                    snap.pacingStatus === "overpacing"  ? "bg-red-100 text-red-600" :
                    snap.pacingStatus === "underpacing" ? "bg-yellow-100 text-yellow-700" :
                    "bg-gray-100 text-gray-500"
                  }`}>
                    {cfg.label}
                  </span>
                </div>

                {/* Metrics grid */}
                <div className="grid grid-cols-3 gap-3 text-center mb-3">
                  {[
                    { label: "Budget",    value: snap.monthBudget    != null ? fmt(snap.monthBudget)    : "—" },
                    { label: "Spent",     value: snap.spentToDate    != null ? fmt(snap.spentToDate)    : "—" },
                    { label: "Projected", value: snap.projectedSpend != null ? fmt(snap.projectedSpend) : "—" },
                  ].map((m) => (
                    <div key={m.label} className="bg-gray-50 rounded-lg px-2 py-2">
                      <p className="text-xs text-gray-400">{m.label}</p>
                      <p className="font-semibold text-gray-800 text-sm mt-0.5">{m.value}</p>
                    </div>
                  ))}
                </div>

                <PacingBar pct={snap.pacingPercent} status={snap.pacingStatus} />

                <div className="flex justify-between text-xs text-gray-400 mt-2.5">
                  <span>
                    Daily run rate: <span className="text-gray-600 font-medium">
                      {snap.dailyRunRate != null ? `${fmt(snap.dailyRunRate)}/day` : "—"}
                    </span>
                  </span>
                  <span>
                    Remaining budget: <span className={`font-medium ${remaining >= 0 ? "text-gray-600" : "text-red-500"}`}>
                      {snap.monthBudget != null ? `${fmt(Math.abs(remaining))}${remaining < 0 ? " over" : ""}` : "—"}
                    </span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
