"use client";

import { useState, useEffect } from "react";
import { use } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface WaCampaign {
  id: string;
  campaignId: string;
  campaignName: string;
  waPhoneNumber: string | null;
  waDisplayName: string | null;
  trackingMethod: string;
  status: string;
  campaign: {
    id: string;
    name: string;
    effectiveStatus: string | null;
    objective: string | null;
  } | null;
  metrics: {
    spend: number;
    leads: number;
    clicks: number;
    impressions: number;
    messagesStarted: number;
    cpm: number | null; // cost per message
    cpl: number | null;
  };
}

interface Totals {
  spend: number;
  messages: number;
  leads: number;
  costPerMessage: number | null;
  cpl: number | null;
}

interface TrendPoint {
  date: string;
  spend: number;
  messages: number;
  leads: number;
}

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  archived: "bg-gray-100 text-gray-500",
};

export default function WhatsappPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);
  const [campaigns, setCampaigns] = useState<WaCampaign[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState("last_30d");
  const [chartMetric, setChartMetric] = useState<"spend" | "messages" | "leads">("messages");

  const PRESETS = [
    { value: "last_7d", label: "7D" },
    { value: "last_14d", label: "14D" },
    { value: "last_30d", label: "30D" },
    { value: "last_90d", label: "90D" },
  ];

  useEffect(() => {
    setLoading(true);
    fetch(`/api/insights/whatsapp?clientId=${clientId}&preset=${preset}`)
      .then((r) => r.json())
      .then((d) => {
        setCampaigns(d.campaigns ?? []);
        setTotals(d.totals ?? null);
        setTrend(d.trend ?? []);
        setLoading(false);
      });
  }, [clientId, preset]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">WhatsApp Intelligence</h1>
          <p className="text-sm text-gray-500 mt-0.5">Click-to-WhatsApp campaign performance & CPQL</p>
        </div>
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

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-20 animate-pulse" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <div className="text-3xl mb-3">💬</div>
          <p className="text-gray-700 font-medium">No WhatsApp Campaigns Found</p>
          <p className="text-gray-400 text-sm mt-1">
            Click-to-WhatsApp campaigns are detected automatically from Meta via Asset Discovery.
          </p>
          <p className="text-gray-400 text-xs mt-1">
            Campaigns using MESSAGES or OUTCOME_ENGAGEMENT objectives are tracked here.
          </p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          {totals && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Spend", value: `$${totals.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
                { label: "Messages Started", value: totals.messages.toLocaleString() },
                { label: "Cost per Message", value: totals.costPerMessage !== null ? `$${totals.costPerMessage.toFixed(2)}` : "—" },
                { label: "Leads from WA", value: totals.leads > 0 ? totals.leads.toLocaleString() : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                  <p className="text-sm text-gray-500 font-medium">{label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Trend Chart */}
          {trend.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-700">Daily Trend</h2>
                <div className="flex gap-1">
                  {(["spend", "messages", "leads"] as const).map((m) => (
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
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v) => [
                      chartMetric === "spend" ? `$${Number(v).toFixed(2)}` : Number(v).toLocaleString(),
                      chartMetric,
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey={chartMetric}
                    stroke="#25d366"
                    strokeWidth={2}
                    dot={false}
                    name={chartMetric === "messages" ? "Messages" : chartMetric === "spend" ? "Spend" : "Leads"}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Campaign Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">WhatsApp Campaigns</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Campaign</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">WA Number</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Spend</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Messages</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Cost/Msg</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Leads</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">CPL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{c.campaignName}</p>
                      {c.campaign?.objective && (
                        <p className="text-xs text-gray-400 uppercase">{c.campaign.objective}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_BADGE[c.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.waDisplayName || c.waPhoneNumber ? (
                        <div>
                          {c.waDisplayName && <p className="font-medium text-gray-900">{c.waDisplayName}</p>}
                          {c.waPhoneNumber && <p className="text-xs text-gray-400">{c.waPhoneNumber}</p>}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      ${c.metrics.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.metrics.messagesStarted > 0 ? c.metrics.messagesStarted.toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.metrics.cpm !== null ? `$${c.metrics.cpm.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.metrics.leads > 0 ? c.metrics.leads.toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.metrics.cpl !== null ? `$${c.metrics.cpl.toFixed(2)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tracking info */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700">
            <p className="font-semibold mb-1">How WhatsApp tracking works</p>
            <p>Messages are tracked via Meta&apos;s <code>messaging_conversation_started_7d</code> action. Campaigns using MESSAGES or OUTCOME_ENGAGEMENT objectives are automatically classified as WhatsApp campaigns during Asset Discovery.</p>
          </div>
        </>
      )}
    </div>
  );
}
