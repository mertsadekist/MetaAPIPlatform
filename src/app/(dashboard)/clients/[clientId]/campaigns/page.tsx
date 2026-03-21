"use client";

import { useState, useEffect } from "react";
import { use } from "react";
import Link from "next/link";

interface Campaign {
  id: string;
  name: string;
  objective: string | null;
  effectiveStatus: string | null;
  adAccount: { name: string; currency: string } | null;
  metrics: {
    spend: number;
    leads: number;
    clicks: number;
    impressions: number;
    messagesStarted: number;
    cpl: number | null;
    costPerMessage: number | null;
  };
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:      "bg-green-100 text-green-700",
  PAUSED:      "bg-yellow-100 text-yellow-700",
  ARCHIVED:    "bg-gray-100 text-gray-500",
  IN_PROCESS:  "bg-blue-100 text-blue-700",
  WITH_ISSUES: "bg-red-100 text-red-700",
};

type Preset = "last_7d" | "last_14d" | "last_30d" | "this_month";

const PRESETS: { value: Preset; label: string }[] = [
  { value: "last_7d",    label: "7D" },
  { value: "last_14d",   label: "14D" },
  { value: "last_30d",   label: "30D" },
  { value: "this_month", label: "Month" },
];

export default function CampaignsPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);
  const [campaigns, setCampaigns]   = useState<Campaign[]>([]);
  const [loading, setLoading]       = useState(true);
  const [preset, setPreset]         = useState<Preset>("last_30d");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/insights/campaigns?clientId=${clientId}&preset=${preset}`)
      .then((r) => r.json())
      .then((d) => { setCampaigns(d.campaigns ?? []); setLoading(false); });
  }, [clientId, preset]);

  const currency = campaigns[0]?.adAccount?.currency ?? "USD";
  const fmt = (n: number, decimals = 0) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: decimals }).format(n);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Campaigns</h1>
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

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : campaigns.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 text-sm">No campaigns found for this period.</p>
            <p className="text-gray-400 text-xs mt-1">Connect Meta account and run Asset Discovery to sync campaigns.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Campaign</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Objective</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Spend</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Messages</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Cost/Msg</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Leads</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">CPL</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">CTR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/clients/${clientId}/campaigns/${c.id}`} className="hover:text-blue-600">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.effectiveStatus ?? ""] ?? "bg-gray-100 text-gray-500"}`}>
                        {c.effectiveStatus ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{c.objective ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-medium">{fmt(c.metrics.spend)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-blue-700">
                      {c.metrics.messagesStarted > 0
                        ? c.metrics.messagesStarted.toLocaleString()
                        : <span className="text-gray-400 font-normal">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.metrics.costPerMessage != null
                        ? fmt(c.metrics.costPerMessage, 2)
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">{c.metrics.leads > 0 ? c.metrics.leads.toLocaleString() : <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3 text-right">
                      {c.metrics.cpl != null
                        ? fmt(c.metrics.cpl, 2)
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {c.metrics.impressions > 0
                        ? `${((c.metrics.clicks / c.metrics.impressions) * 100).toFixed(2)}%`
                        : <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
