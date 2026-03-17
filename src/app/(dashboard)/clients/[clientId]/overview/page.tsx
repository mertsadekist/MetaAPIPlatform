"use client";

import { useState, useEffect } from "react";
import { use } from "react";
import { KpiCard } from "@/components/cards/KpiCard";
import NotesPanel from "@/components/notes/NotesPanel";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type Preset = "last_7d" | "last_14d" | "last_30d" | "this_month";

const PRESETS: { value: Preset; label: string }[] = [
  { value: "last_7d", label: "7D" },
  { value: "last_14d", label: "14D" },
  { value: "last_30d", label: "30D" },
  { value: "this_month", label: "Month" },
];

interface Overview {
  spend: number;
  leads: number;
  cpl: number | null;
  roas: number | null;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  messagesStarted: number;
  currency: string;
  deltas: { spend: number | null; leads: number | null; cpl: number | null };
  pacing?: {
    pacingStatus: string;
    spentToDate: number;
    monthBudget: number | null;
    projectedSpend: number;
    daysElapsed: number;
    daysRemaining: number;
    adAccount: { name: string; currency: string };
  } | null;
}

interface TrendPoint {
  date: string;
  value: number | null;
}

export default function OverviewPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);
  const [preset, setPreset] = useState<Preset>("last_7d");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/insights/overview?clientId=${clientId}&preset=${preset}`).then((r) => r.json()),
      fetch(`/api/insights/trend?clientId=${clientId}&preset=${preset}&metric=spend`).then((r) => r.json()),
    ]).then(([overviewData, trendData]) => {
      setOverview(overviewData.overview ?? null);
      setTrend(trendData.trend ?? []);
      setLoading(false);
    });
  }, [clientId, preset]);

  const pacing = overview?.pacing;
  const pacingPercent =
    pacing?.monthBudget && Number(pacing.monthBudget) > 0
      ? Math.round((Number(pacing.spentToDate) / Number(pacing.monthBudget)) * 100)
      : null;

  const statusBadge: Record<string, { label: string; color: string }> = {
    on_track: { label: "✓ On Track", color: "text-green-600 bg-green-50" },
    underspend: { label: "⚠ Underspend", color: "text-yellow-700 bg-yellow-50" },
    overspend: { label: "⚠ Overspend", color: "text-red-600 bg-red-50" },
    unknown: { label: "—", color: "text-gray-500 bg-gray-50" },
  };
  const pacingBadge = pacing ? statusBadge[pacing.pacingStatus] ?? statusBadge.unknown : null;
  const currency = overview?.currency ?? "USD";
  const fmtCurrency = (n: number, decimals = 0) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: decimals }).format(n);

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Performance Overview</h1>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPreset(p.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                preset === p.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Budget Pacing Strip */}
      {pacing && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-700">
              Budget Pacing — {pacing.adAccount.name}
            </span>
            {pacingBadge && (
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${pacingBadge.color}`}>
                {pacingBadge.label}
              </span>
            )}
          </div>
          {pacingPercent !== null && (
            <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  pacing.pacingStatus === "overspend"
                    ? "bg-red-500"
                    : pacing.pacingStatus === "underspend"
                    ? "bg-yellow-400"
                    : "bg-green-500"
                }`}
                style={{ width: `${Math.min(100, pacingPercent)}%` }}
              />
            </div>
          )}
          <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
            <span>
              Spent: {fmtCurrency(Number(pacing.spentToDate))}
              {pacing.monthBudget ? ` of ${fmtCurrency(Number(pacing.monthBudget))}` : ""}
              {pacingPercent !== null ? ` (${pacingPercent}%)` : ""}
            </span>
            <span>Day {pacing.daysElapsed} of {pacing.daysElapsed + pacing.daysRemaining}</span>
            <span>Projected EOM: {fmtCurrency(Number(pacing.projectedSpend))}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Spend" value={overview?.spend ?? null} format="currency" currency={currency} delta={overview?.deltas.spend} />
            <KpiCard label="Leads" value={overview?.leads ?? null} format="number" delta={overview?.deltas.leads} />
            <KpiCard label="CPL" value={overview?.cpl ?? null} format="currency" currency={currency} delta={overview?.deltas.cpl} isPositiveWhenUp={false} />
            <KpiCard label="ROAS" value={overview?.roas ?? null} format="multiplier" />
            <KpiCard label="Impressions" value={overview?.impressions ?? null} format="number" />
            <KpiCard label="Clicks" value={overview?.clicks ?? null} format="number" />
            <KpiCard label="CTR" value={overview?.ctr != null ? overview.ctr * 100 : null} format="percent" />
            <KpiCard label="CPM" value={overview?.cpm ?? null} format="currency" currency={currency} isPositiveWhenUp={false} />
          </div>

          {/* Spend Trend Chart */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Spend Trend</h2>
            {trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v) => [fmtCurrency(Number(v), 2), "Spend"]}
                  />
                  <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
                No trend data available — run a sync to populate data
              </div>
            )}
          </div>

          {/* Client-level notes */}
          <NotesPanel
            clientId={clientId}
            entityType="client"
            entityId={clientId}
            title="Client Notes"
          />
        </>
      )}
    </div>
  );
}
