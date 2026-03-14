"use client";

import { useState, useEffect } from "react";
import { use } from "react";

interface SharedData {
  client: { id: string; name: string; industry: string | null };
  label: string | null;
  scope: string[];
  expiresAt: string;
  overview?: {
    spend: number;
    leads: number;
    clicks: number;
    impressions: number;
    cpl: number | null;
    roas: number | null;
    ctr: number;
    cpc: number;
  };
  campaigns?: {
    id: string;
    name: string;
    effectiveStatus: string | null;
    objective: string | null;
    metrics: { spend: number; leads: number; clicks: number; impressions: number; cpl: number | null };
  }[];
  error?: string;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  PAUSED: "bg-yellow-100 text-yellow-700",
  ARCHIVED: "bg-gray-100 text-gray-500",
};

export default function SharedDashboardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<SharedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/shared-links/${token}/view`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) {
          setError(json.error ?? "Something went wrong");
        } else {
          setData(json);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load dashboard");
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-400 text-sm">Loading dashboard...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center max-w-md">
          <div className="text-4xl mb-4">🔗</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link Unavailable</h1>
          <p className="text-gray-500 text-sm">{error ?? "This shared link is not valid."}</p>
        </div>
      </div>
    );
  }

  const { client, label, overview, campaigns } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{client.name}</h1>
            {label && <p className="text-sm text-gray-500">{label}</p>}
            {client.industry && <p className="text-xs text-gray-400">{client.industry}</p>}
          </div>
          <div className="text-xs text-gray-400">
            Expires {new Date(data.expiresAt).toLocaleDateString()}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* KPI Overview */}
        {overview && (
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Performance Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Spend", value: `$${overview.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
                { label: "Leads", value: overview.leads.toLocaleString() },
                { label: "CPL", value: overview.cpl !== null ? `$${overview.cpl.toFixed(2)}` : "—" },
                { label: "CTR", value: `${overview.ctr.toFixed(2)}%` },
                { label: "Clicks", value: overview.clicks.toLocaleString() },
                { label: "Impressions", value: overview.impressions.toLocaleString() },
                { label: "ROAS", value: overview.roas !== null ? `${overview.roas.toFixed(2)}x` : "—" },
                { label: "CPC", value: overview.cpc > 0 ? `$${overview.cpc.toFixed(2)}` : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                  <p className="text-xs text-gray-500 font-medium">{label}</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Campaigns */}
        {campaigns && campaigns.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Campaigns</h2>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Campaign</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Spend</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Leads</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">CPL</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">CTR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {campaigns.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{c.name}</p>
                        {c.objective && <p className="text-xs text-gray-400 uppercase">{c.objective}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.effectiveStatus ?? ""] ?? "bg-gray-100 text-gray-500"}`}>
                          {c.effectiveStatus ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        ${c.metrics.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-4 py-3 text-right">{c.metrics.leads.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        {c.metrics.cpl !== null ? `$${c.metrics.cpl.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {c.metrics.impressions > 0
                          ? `${((c.metrics.clicks / c.metrics.impressions) * 100).toFixed(2)}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 bg-white mt-12 py-4 text-center text-xs text-gray-400">
        Shared dashboard — read-only view
      </div>
    </div>
  );
}
