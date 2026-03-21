"use client";

import { useState, useEffect } from "react";
import { use } from "react";
import Link from "next/link";
import Image from "next/image";

interface Creative {
  id: string;
  name: string | null;
  format: string | null;
  previewUrl: string | null;
  thumbnailUrl: string | null;
  status: string | null;
  analysis: {
    overallScore: number | null;
    hook: string | null;
    callToAction: string | null;
  } | null;
  fatigueSignals: {
    fatigueLevel: string;
    fatigueScore: number;
    ctrDropPct: number | null;
  }[];
  metrics: {
    spend: number;
    leads: number;
    clicks: number;
    impressions: number;
    cpl: number | null;
  };
}

const FATIGUE_STYLE: Record<string, { badge: string; label: string }> = {
  none:     { badge: "bg-green-100 text-green-700",  label: "Healthy" },
  mild:     { badge: "bg-yellow-100 text-yellow-700", label: "Mild Fatigue" },
  moderate: { badge: "bg-orange-100 text-orange-700", label: "Moderate" },
  severe:   { badge: "bg-red-100 text-red-700",       label: "Severe" },
};

const SCORE_COLOR = (s: number | null) => {
  if (s === null) return "text-gray-400";
  if (s >= 8) return "text-green-600";
  if (s >= 6) return "text-yellow-600";
  return "text-red-600";
};

type SortKey = "spend" | "leads" | "cpl" | "score";

export default function CreativesPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState("last_30d");
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [fatigueFilter, setFatigueFilter] = useState<string>("all");
  const [view, setView] = useState<"grid" | "table">("grid");

  const fmtCurrency = (n: number, decimals = 0) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: decimals }).format(n);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/insights/creatives?clientId=${clientId}&preset=${preset}`)
      .then((r) => r.json())
      .then((d) => { setCreatives(d.creatives ?? []); setCurrency(d.currency ?? "USD"); setLoading(false); });
  }, [clientId, preset]);

  const PRESETS = [
    { value: "last_7d", label: "7D" },
    { value: "last_14d", label: "14D" },
    { value: "last_30d", label: "30D" },
    { value: "last_90d", label: "90D" },
  ];

  const filtered = creatives.filter((c) => {
    if (fatigueFilter === "all") return true;
    const level = c.fatigueSignals[0]?.fatigueLevel ?? "none";
    return level === fatigueFilter;
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sortKey) {
      case "spend":  return b.metrics.spend - a.metrics.spend;
      case "leads":  return b.metrics.leads - a.metrics.leads;
      case "cpl":    return (a.metrics.cpl ?? Infinity) - (b.metrics.cpl ?? Infinity);
      case "score":  return (b.analysis?.overallScore ?? -1) - (a.analysis?.overallScore ?? -1);
    }
  });

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Creatives</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period presets */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPreset(p.value)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  preset === p.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Fatigue filter */}
          <select
            value={fatigueFilter}
            onChange={(e) => setFatigueFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700"
          >
            <option value="all">All Fatigue Levels</option>
            <option value="none">Healthy</option>
            <option value="mild">Mild</option>
            <option value="moderate">Moderate</option>
            <option value="severe">Severe</option>
          </select>

          {/* Sort */}
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700"
          >
            <option value="spend">Sort: Spend</option>
            <option value="leads">Sort: Leads</option>
            <option value="cpl">Sort: CPL</option>
            <option value="score">Sort: AI Score</option>
          </select>

          {/* View toggle */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(["grid", "table"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors ${
                  view === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className={view === "grid" ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" : "space-y-3"}>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-56 animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-gray-500 text-sm">No creatives found. Run Asset Discovery to sync creatives from Meta.</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sorted.map((c) => {
            const fatigue = c.fatigueSignals[0];
            const fatigueLevel = fatigue?.fatigueLevel ?? "none";
            const fatigueStyle = FATIGUE_STYLE[fatigueLevel] ?? FATIGUE_STYLE.none;
            const score = c.analysis?.overallScore ?? null;

            return (
              <Link
                key={c.id}
                href={`/clients/${clientId}/creatives/${c.id}`}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group"
              >
                {/* Thumbnail */}
                <div className="relative bg-gray-50 h-40 flex items-center justify-center overflow-hidden">
                  {c.thumbnailUrl || c.previewUrl ? (
                    <Image
                      src={c.thumbnailUrl ?? c.previewUrl!}
                      alt={c.name ?? "Creative"}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      unoptimized
                    />
                  ) : (
                    <div className="text-gray-300 text-xs text-center px-4">
                      <div className="text-2xl mb-1">🖼</div>
                      No preview
                    </div>
                  )}
                  {/* Fatigue badge */}
                  <div className="absolute top-2 left-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${fatigueStyle.badge}`}>
                      {fatigueStyle.label}
                    </span>
                  </div>
                  {/* AI score */}
                  {score !== null && (
                    <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-lg px-2 py-0.5 shadow-sm">
                      <span className={`text-xs font-bold ${SCORE_COLOR(score)}`}>{score.toFixed(1)}</span>
                      <span className="text-gray-400 text-xs">/10</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <p className="text-xs font-medium text-gray-900 truncate">{c.name ?? "Unnamed Creative"}</p>
                  {c.format && (
                    <p className="text-xs text-gray-400 uppercase mt-0.5">{c.format}</p>
                  )}
                  <div className="flex items-center justify-between mt-2 gap-2">
                    <div className="text-xs text-gray-600">
                      <span className="font-medium">{fmtCurrency(c.metrics.spend)}</span>
                      <span className="text-gray-400"> spend</span>
                    </div>
                    <div className="text-xs text-gray-600">
                      <span className="font-medium">{c.metrics.leads}</span>
                      <span className="text-gray-400"> leads</span>
                    </div>
                    {c.metrics.cpl !== null && (
                      <div className="text-xs text-gray-600">
                        <span className="font-medium">{fmtCurrency(c.metrics.cpl, 2)}</span>
                        <span className="text-gray-400"> CPL</span>
                      </div>
                    )}
                  </div>
                  {c.analysis?.hook && (
                    <p className="text-xs text-gray-400 mt-1.5 italic truncate">&ldquo;{c.analysis.hook}&rdquo;</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        /* Table view */
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Creative</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Fatigue</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">AI Score</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Spend</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Leads</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">CPL</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">CTR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((c) => {
                const fatigue = c.fatigueSignals[0];
                const fatigueLevel = fatigue?.fatigueLevel ?? "none";
                const fatigueStyle = FATIGUE_STYLE[fatigueLevel] ?? FATIGUE_STYLE.none;
                const score = c.analysis?.overallScore ?? null;
                const ctr = c.metrics.impressions > 0
                  ? ((c.metrics.clicks / c.metrics.impressions) * 100).toFixed(2)
                  : null;

                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/clients/${clientId}/creatives/${c.id}`} className="flex items-center gap-3 hover:text-blue-600">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden relative">
                          {c.thumbnailUrl ? (
                            <Image src={c.thumbnailUrl} alt="" fill className="object-cover" unoptimized />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">🖼</div>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 max-w-[200px] truncate">{c.name ?? "Unnamed"}</p>
                          {c.format && <p className="text-xs text-gray-400 uppercase">{c.format}</p>}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${fatigueStyle.badge}`}>
                        {fatigueStyle.label}
                      </span>
                      {fatigue?.ctrDropPct != null && (
                        <span className="text-xs text-gray-400 ml-1">
                          CTR -{Number(fatigue.ctrDropPct).toFixed(0)}%
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {score !== null ? (
                        <span className={`font-bold ${SCORE_COLOR(score)}`}>{score.toFixed(1)}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {fmtCurrency(c.metrics.spend)}
                    </td>
                    <td className="px-4 py-3 text-right">{c.metrics.leads.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      {c.metrics.cpl !== null ? fmtCurrency(c.metrics.cpl, 2) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {ctr !== null ? `${ctr}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary bar */}
      {!loading && sorted.length > 0 && (
        <p className="text-xs text-gray-400 text-right">
          {sorted.length} creative{sorted.length !== 1 ? "s" : ""} shown
          {fatigueFilter !== "all" && ` · filtered by ${fatigueFilter} fatigue`}
        </p>
      )}
    </div>
  );
}
