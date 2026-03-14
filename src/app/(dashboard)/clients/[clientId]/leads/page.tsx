"use client";

import { useState, useEffect, useCallback } from "react";
import { use } from "react";

interface Lead {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  leadSource: string;
  qualityStatus: string;
  qualityNote: string | null;
  receivedAt: string;
  campaign: { id: string; name: string } | null;
}

interface StatusBreakdown {
  qualityStatus: string;
  _count: number;
}

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  new:         { label: "New",         badge: "bg-blue-100 text-blue-700" },
  contacted:   { label: "Contacted",   badge: "bg-yellow-100 text-yellow-700" },
  qualified:   { label: "Qualified",   badge: "bg-green-100 text-green-700" },
  unqualified: { label: "Unqualified", badge: "bg-red-100 text-red-700" },
  converted:   { label: "Converted",   badge: "bg-purple-100 text-purple-700" },
  duplicate:   { label: "Duplicate",   badge: "bg-gray-100 text-gray-500" },
};

const STATUSES = Object.keys(STATUS_CONFIG);

export default function LeadsPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [breakdown, setBreakdown] = useState<StatusBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [updating, setUpdating] = useState<string | null>(null);

  const LIMIT = 50;

  const load = useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams({ clientId, page: String(page), limit: String(LIMIT) });
    if (statusFilter !== "all") qs.set("status", statusFilter);
    fetch(`/api/leads?${qs}`)
      .then((r) => r.json())
      .then((d) => {
        setLeads(d.leads ?? []);
        setTotal(d.total ?? 0);
        setBreakdown(d.statusBreakdown ?? []);
        setLoading(false);
      });
  }, [clientId, page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(leadId: string, qualityStatus: string) {
    setUpdating(leadId);
    const res = await fetch(`/api/leads/${leadId}/quality`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qualityStatus }),
    });
    if (res.ok) {
      setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, qualityStatus } : l));
    }
    setUpdating(null);
  }

  const totalPages = Math.ceil(total / LIMIT);
  const summaryMap: Record<string, number> = {};
  for (const s of breakdown) summaryMap[s.qualityStatus] = s._count;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Leads & Quality</h1>
        <span className="text-sm text-gray-500">{total.toLocaleString()} total leads</span>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setStatusFilter("all"); setPage(1); }}
          className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
            statusFilter === "all" ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-600 hover:border-gray-400"
          }`}
        >
          All ({total})
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              statusFilter === s ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-600 hover:border-gray-400"
            }`}
          >
            {STATUS_CONFIG[s].label} ({summaryMap[s] ?? 0})
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading leads…</div>
        ) : leads.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 text-sm">No leads found.</p>
            <p className="text-gray-400 text-xs mt-1">Leads are synced from Meta Lead Ads during Asset Discovery.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Lead", "Campaign", "Source", "Received", "Quality Status"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">
                      {lead.name ?? <span className="text-gray-400 italic">Anonymous</span>}
                    </p>
                    {lead.email && <p className="text-xs text-gray-400">{lead.email}</p>}
                    {lead.phone && <p className="text-xs text-gray-400">{lead.phone}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {lead.campaign?.name ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full uppercase">
                      {lead.leadSource}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {new Date(lead.receivedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={lead.qualityStatus}
                      onChange={(e) => updateStatus(lead.id, e.target.value)}
                      disabled={updating === lead.id}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        STATUS_CONFIG[lead.qualityStatus]?.badge ?? "bg-gray-100 text-gray-600"
                      } ${updating === lead.id ? "opacity-50 cursor-wait" : ""}`}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">
            Showing {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, total)} of {total.toLocaleString()}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
