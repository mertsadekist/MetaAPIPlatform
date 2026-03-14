"use client";

import { useState, useEffect } from "react";
import { use } from "react";
import Link from "next/link";

interface Campaign {
  id: string;
  name: string;
  objective: string | null;
  effectiveStatus: string | null;
  metrics: { spend: number; leads: number; clicks: number; impressions: number; cpl: number | null };
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  PAUSED: "bg-yellow-100 text-yellow-700",
  ARCHIVED: "bg-gray-100 text-gray-500",
  IN_PROCESS: "bg-blue-100 text-blue-700",
  WITH_ISSUES: "bg-red-100 text-red-700",
};

export default function CampaignsPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/insights/campaigns?clientId=${clientId}&preset=last_30d`)
      .then((r) => r.json())
      .then((d) => { setCampaigns(d.campaigns ?? []); setLoading(false); });
  }, [clientId]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Campaigns</h1>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
        ) : campaigns.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 text-sm">No campaigns yet.</p>
            <p className="text-gray-400 text-xs mt-1">Connect Meta account and run Asset Discovery to sync campaigns.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Campaign</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Objective</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Spend</th>
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
                  <td className="px-4 py-3 text-right font-medium">${c.metrics.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td className="px-4 py-3 text-right">{c.metrics.leads.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">{c.metrics.cpl != null ? `$${c.metrics.cpl.toFixed(2)}` : "—"}</td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {c.metrics.impressions > 0
                      ? `${((c.metrics.clicks / c.metrics.impressions) * 100).toFixed(2)}%`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
