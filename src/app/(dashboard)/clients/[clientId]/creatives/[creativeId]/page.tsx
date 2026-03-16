"use client";

import { useState, useEffect } from "react";
import { use } from "react";
import Link from "next/link";
import Image from "next/image";
import NotesPanel from "@/components/notes/NotesPanel";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface CreativeDetail {
  creative: {
    id: string;
    name: string | null;
    primaryText: string | null;
    headline: string | null;
    description: string | null;
    callToActionType: string | null;
    imageUrl: string | null;
    thumbnailUrl: string | null;
    format: string | null;
    analysis: {
      overallScore: number | null;
      textScore: number | null;
      imageScore: number | null;
      hookStrength: number | null;
      ctaClarity: number | null;
      urgencyScore: number | null;
      humanPresence: boolean | null;
      textOverlayDensity: string | null;
      visualClutter: number | null;
      strengths: string[] | null;
      weaknesses: string[] | null;
      hypotheses: string[] | null;
      rewriteSuggestions: string[] | null;
      hook: string | null;
      callToAction: string | null;
      modelUsed: string | null;
      analyzedAt: string;
    } | null;
    fatigueSignals: {
      fatigueLevel: string;
      fatigueScore: number;
      ctrDropPct: number | null;
      frequency: number | null;
      signalDate: string;
    }[];
    ads: {
      id: string;
      name: string | null;
      effectiveStatus: string | null;
      campaign: { id: string; name: string } | null;
      adSet: { id: string; name: string } | null;
    }[];
  };
  trend: { date: string; spend: number; leads: number; clicks: number; impressions: number }[];
  metrics: { spend: number; leads: number; clicks: number; impressions: number; cpl: number | null; ctr: number | null };
}

const FATIGUE_STYLE: Record<string, { badge: string; label: string }> = {
  none:     { badge: "bg-green-100 text-green-700",  label: "Healthy" },
  mild:     { badge: "bg-yellow-100 text-yellow-700", label: "Mild Fatigue" },
  moderate: { badge: "bg-orange-100 text-orange-700", label: "Moderate" },
  severe:   { badge: "bg-red-100 text-red-700",       label: "Severe" },
};

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  const pct = (value / 10) * 100;
  const color = value >= 8 ? "bg-green-500" : value >= 6 ? "bg-yellow-400" : "bg-red-400";
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs text-gray-600">{label}</span>
        <span className="text-xs font-medium text-gray-900">{value.toFixed(1)}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function CreativeDetailPage({
  params,
}: {
  params: Promise<{ clientId: string; creativeId: string }>;
}) {
  const { clientId, creativeId } = use(params);
  const [data, setData] = useState<CreativeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState("last_30d");
  const [chartMetric, setChartMetric] = useState<"spend" | "leads" | "clicks">("spend");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/insights/creatives/${creativeId}?preset=${preset}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, [creativeId, preset]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-100 rounded-xl h-32 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Creative not found.</p>
      </div>
    );
  }

  const { creative, trend, metrics } = data;
  const latestFatigue = creative.fatigueSignals[0];
  const fatigueLevel = latestFatigue?.fatigueLevel ?? "none";
  const fatigueStyle = FATIGUE_STYLE[fatigueLevel] ?? FATIGUE_STYLE.none;

  const PRESETS = [
    { value: "last_7d", label: "7D" },
    { value: "last_14d", label: "14D" },
    { value: "last_30d", label: "30D" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href={`/clients/${clientId}/creatives`} className="hover:text-blue-600">Creatives</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium truncate max-w-xs">{creative.name ?? "Unnamed"}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Preview + basic info */}
        <div className="space-y-4">
          {/* Thumbnail */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="relative bg-gray-50 aspect-video flex items-center justify-center">
              {creative.thumbnailUrl || creative.imageUrl ? (
                <Image
                  src={creative.thumbnailUrl ?? creative.imageUrl!}
                  alt={creative.name ?? "Creative"}
                  fill
                  className="object-contain"
                  unoptimized
                />
              ) : (
                <div className="text-gray-300 text-center">
                  <div className="text-4xl mb-2">🖼</div>
                  <p className="text-xs">No preview available</p>
                </div>
              )}
            </div>
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${fatigueStyle.badge}`}>
                  {fatigueStyle.label}
                </span>
                {creative.format && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full uppercase">
                    {creative.format}
                  </span>
                )}
              </div>
              <h1 className="font-semibold text-gray-900">{creative.name ?? "Unnamed Creative"}</h1>
              {creative.headline && (
                <p className="text-sm font-medium text-gray-700">{creative.headline}</p>
              )}
              {creative.primaryText && (
                <p className="text-xs text-gray-500 line-clamp-4">{creative.primaryText}</p>
              )}
              {creative.callToActionType && (
                <span className="inline-block text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                  CTA: {creative.callToActionType.replace(/_/g, " ")}
                </span>
              )}
            </div>
          </div>

          {/* Ads using this creative */}
          {creative.ads.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Ads Using This Creative</h3>
              <div className="space-y-2">
                {creative.ads.map((ad) => (
                  <div key={ad.id} className="text-xs text-gray-600">
                    <p className="font-medium text-gray-900">{ad.name ?? ad.id}</p>
                    {ad.campaign && <p className="text-gray-400">Campaign: {ad.campaign.name}</p>}
                    {ad.adSet && <p className="text-gray-400">Ad Set: {ad.adSet.name}</p>}
                    {ad.effectiveStatus && (
                      <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-xs font-medium ${
                        ad.effectiveStatus === "ACTIVE" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {ad.effectiveStatus}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Metrics + AI analysis */}
        <div className="lg:col-span-2 space-y-4">
          {/* Period + KPI bar */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">Performance</h2>
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
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: "Spend", value: `$${metrics.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
                { label: "Leads", value: metrics.leads.toLocaleString() },
                { label: "CPL", value: metrics.cpl !== null ? `$${metrics.cpl.toFixed(2)}` : "—" },
                { label: "Clicks", value: metrics.clicks.toLocaleString() },
                { label: "Impressions", value: metrics.impressions.toLocaleString() },
                { label: "CTR", value: metrics.ctr !== null ? `${metrics.ctr.toFixed(2)}%` : "—" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-lg font-bold text-gray-900">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Trend chart */}
          {trend.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700">Daily Trend</h2>
                <div className="flex gap-1">
                  {(["spend", "leads", "clicks"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setChartMetric(m)}
                      className={`px-2 py-1 text-xs rounded capitalize transition-colors ${
                        chartMetric === m ? "bg-blue-100 text-blue-700 font-medium" : "text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => [chartMetric === "spend" ? `$${Number(v).toFixed(2)}` : Number(v).toLocaleString(), chartMetric]} />
                  <Line type="monotone" dataKey={chartMetric} stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* AI Analysis */}
          {creative.analysis ? (
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-700">AI Creative Analysis</h2>
                <div className="text-right">
                  <span className={`text-2xl font-bold ${
                    (creative.analysis.overallScore ?? 0) >= 8 ? "text-green-600" :
                    (creative.analysis.overallScore ?? 0) >= 6 ? "text-yellow-600" : "text-red-600"
                  }`}>
                    {creative.analysis.overallScore?.toFixed(1) ?? "—"}
                  </span>
                  <span className="text-gray-400 text-sm">/10</span>
                  {creative.analysis.modelUsed && (
                    <p className="text-xs text-gray-400 mt-0.5">{creative.analysis.modelUsed}</p>
                  )}
                </div>
              </div>

              {/* Score bars */}
              <div className="space-y-3 mb-5">
                <ScoreBar label="Text Score" value={creative.analysis.textScore} />
                <ScoreBar label="Image Score" value={creative.analysis.imageScore} />
                <ScoreBar label="Hook Strength" value={creative.analysis.hookStrength} />
                <ScoreBar label="CTA Clarity" value={creative.analysis.ctaClarity} />
                <ScoreBar label="Urgency" value={creative.analysis.urgencyScore} />
                {creative.analysis.visualClutter !== null && (
                  <ScoreBar label="Visual Clutter (lower = better)" value={creative.analysis.visualClutter} />
                )}
              </div>

              {/* Metadata */}
              <div className="flex gap-3 flex-wrap mb-4">
                {creative.analysis.humanPresence !== null && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    creative.analysis.humanPresence ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {creative.analysis.humanPresence ? "Human Presence ✓" : "No Human"}
                  </span>
                )}
                {creative.analysis.textOverlayDensity && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">
                    Text Overlay: {creative.analysis.textOverlayDensity}
                  </span>
                )}
              </div>

              {/* Strengths / Weaknesses */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {creative.analysis.strengths && (creative.analysis.strengths as string[]).length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-green-700 mb-2">Strengths</h4>
                    <ul className="space-y-1">
                      {(creative.analysis.strengths as string[]).map((s, i) => (
                        <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                          <span className="text-green-500 mt-0.5">✓</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {creative.analysis.weaknesses && (creative.analysis.weaknesses as string[]).length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-red-600 mb-2">Weaknesses</h4>
                    <ul className="space-y-1">
                      {(creative.analysis.weaknesses as string[]).map((w, i) => (
                        <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                          <span className="text-red-400 mt-0.5">✗</span>
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Hypotheses */}
              {creative.analysis.hypotheses && (creative.analysis.hypotheses as string[]).length > 0 && (
                <div className="mt-4">
                  <h4 className="text-xs font-semibold text-blue-700 mb-2">Test Hypotheses</h4>
                  <ul className="space-y-1">
                    {(creative.analysis.hypotheses as string[]).map((h, i) => (
                      <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                        <span className="text-blue-400 mt-0.5">→</span>
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Rewrite suggestions */}
              {creative.analysis.rewriteSuggestions && (creative.analysis.rewriteSuggestions as string[]).length > 0 && (
                <div className="mt-4 bg-blue-50 rounded-lg p-3">
                  <h4 className="text-xs font-semibold text-blue-700 mb-2">Copy Suggestions</h4>
                  <ul className="space-y-1.5">
                    {(creative.analysis.rewriteSuggestions as string[]).map((r, i) => (
                      <li key={i} className="text-xs text-blue-900 italic">&ldquo;{r}&rdquo;</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-xs text-gray-400 mt-4">
                Analyzed {new Date(creative.analysis.analyzedAt).toLocaleDateString()}
              </p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center shadow-sm">
              <p className="text-gray-500 text-sm">No AI analysis yet.</p>
              <p className="text-gray-400 text-xs mt-1">Run the creative analysis job to generate insights.</p>
            </div>
          )}

          {/* Fatigue history */}
          {creative.fatigueSignals.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Fatigue History</h2>
              <div className="space-y-2">
                {creative.fatigueSignals.map((sig, i) => {
                  const style = FATIGUE_STYLE[sig.fatigueLevel] ?? FATIGUE_STYLE.none;
                  return (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">{new Date(sig.signalDate).toLocaleDateString()}</span>
                      <span className={`px-2 py-0.5 rounded-full font-semibold ${style.badge}`}>
                        {style.label}
                      </span>
                      <span className="text-gray-500">Score: {Number(sig.fatigueScore).toFixed(1)}</span>
                      {sig.ctrDropPct !== null && (
                        <span className="text-gray-500">CTR drop: {Number(sig.ctrDropPct).toFixed(0)}%</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      <NotesPanel
        clientId={clientId}
        entityType="creative"
        entityId={creativeId}
        title="Creative Notes"
      />
    </div>
  );
}
