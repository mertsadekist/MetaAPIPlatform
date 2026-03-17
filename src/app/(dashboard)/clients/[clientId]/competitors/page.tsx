"use client";

import { useState, useEffect } from "react";
import { use } from "react";

interface AdSnapshot {
  id: string;
  adCreativeBody: string | null;
  adCreativeTitle: string | null;
  ctaType: string | null;
  mediaType: string | null;
  estimatedSpendRange: string | null;
  estimatedImpressionRange: string | null;
  adSnapshotUrl: string | null;
  isActive: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
}

interface Competitor {
  id: string;
  competitorName: string;
  metaPageId: string | null;
  metaPageName: string | null;
  notes: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  adSnapshots: AdSnapshot[];
}

const MEDIA_COLORS: Record<string, string> = {
  image: "bg-blue-100 text-blue-700",
  video: "bg-purple-100 text-purple-700",
  carousel: "bg-orange-100 text-orange-700",
};

export default function CompetitorsPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState({ competitorName: "", metaPageId: "", metaPageName: "", notes: "" });
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/competitors?clientId=${clientId}`)
      .then((r) => r.json())
      .then((d) => { setCompetitors(d.competitors ?? []); setLoading(false); });
  }, [clientId]);

  async function handleAdd() {
    if (!form.competitorName.trim()) { setFormError("Name is required"); return; }
    setSaving(true); setFormError(null);
    const res = await fetch("/api/competitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, ...form }),
    });
    const data = await res.json();
    if (res.ok) {
      setCompetitors((prev) => [...prev, data.competitor]);
      setForm({ competitorName: "", metaPageId: "", metaPageName: "", notes: "" });
      setShowForm(false);
    } else {
      setFormError(typeof data.error === "string" ? data.error : "Failed to add competitor");
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    const res = await fetch(`/api/competitors/${id}`, { method: "DELETE" });
    if (res.ok) setCompetitors((prev) => prev.filter((c) => c.id !== id));
    setDeleting(null);
  }

  const totalAds = competitors.reduce((sum, c) => sum + c.adSnapshots.length, 0);
  const activeAds = competitors.reduce((sum, c) => sum + c.adSnapshots.filter((a) => a.isActive).length, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Competitor Intelligence</h1>
          <p className="text-sm text-gray-500 mt-1">Track competitor ad activity from Meta Ad Library</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          + Add Competitor
        </button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Tracked Competitors", value: competitors.length },
          { label: "Total Ad Snapshots", value: totalAds },
          { label: "Currently Active Ads", value: activeAds },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">{kpi.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Add Competitor</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Competitor Name *</label>
              <input
                type="text"
                placeholder="e.g. Acme Corp"
                value={form.competitorName}
                onChange={(e) => setForm((f) => ({ ...f, competitorName: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Meta Page ID (optional)</label>
              <input
                type="text"
                placeholder="Facebook Page ID"
                value={form.metaPageId}
                onChange={(e) => setForm((f) => ({ ...f, metaPageId: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Meta Page Name (optional)</label>
              <input
                type="text"
                placeholder="@pagename"
                value={form.metaPageName}
                onChange={(e) => setForm((f) => ({ ...f, metaPageName: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
              <input
                type="text"
                placeholder="Any internal notes..."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white"
              />
            </div>
          </div>
          {formError && <p className="text-red-600 text-xs mt-2">{formError}</p>}
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleAdd}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Adding…" : "Add Competitor"}
            </button>
            <button
              onClick={() => { setShowForm(false); setFormError(null); }}
              className="px-4 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Competitor list */}
      {loading ? (
        <div className="p-8 text-center text-gray-400 text-sm">Loading competitors…</div>
      ) : competitors.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-16 text-center shadow-sm">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-gray-600 font-medium">No competitors tracked yet</p>
          <p className="text-gray-400 text-sm mt-1">Add competitors to track their Meta ad activity and creative strategies.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {competitors.map((c) => (
            <div key={c.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              {/* Header row */}
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {c.competitorName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{c.competitorName}</p>
                    <p className="text-xs text-gray-400">
                      {c.metaPageName ? `@${c.metaPageName}` : c.metaPageId ? `Page ID: ${c.metaPageId}` : "No page linked"}
                      {" · "}
                      {c.adSnapshots.length} ad{c.adSnapshots.length !== 1 ? "s" : ""} tracked
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {c.adSnapshots.filter((a) => a.isActive).length > 0 && (
                    <span className="text-xs bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full font-medium">
                      {c.adSnapshots.filter((a) => a.isActive).length} active
                    </span>
                  )}
                  <button
                    onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {expanded === c.id ? "Hide Ads ↑" : "View Ads →"}
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    disabled={deleting === c.id}
                    className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
                  >
                    {deleting === c.id ? "…" : "Remove"}
                  </button>
                </div>
              </div>

              {c.notes && (
                <div className="px-5 pb-3">
                  <p className="text-xs text-gray-500 italic">{c.notes}</p>
                </div>
              )}

              {/* Ad snapshots */}
              {expanded === c.id && c.adSnapshots.length > 0 && (
                <div className="border-t border-gray-100">
                  <div className="px-5 py-2 bg-gray-50 flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-600">Ad Snapshots ({c.adSnapshots.length})</p>
                    <p className="text-xs text-gray-400">From Meta Ad Library</p>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {c.adSnapshots.map((ad) => (
                      <div key={ad.id} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start gap-4">
                          <div className="flex-1 min-w-0">
                            {ad.adCreativeTitle && (
                              <p className="font-medium text-gray-900 text-sm truncate">{ad.adCreativeTitle}</p>
                            )}
                            {ad.adCreativeBody && (
                              <p className="text-sm text-gray-600 mt-1 line-clamp-2">{ad.adCreativeBody}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              {ad.mediaType && (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${MEDIA_COLORS[ad.mediaType] ?? "bg-gray-100 text-gray-600"}`}>
                                  {ad.mediaType}
                                </span>
                              )}
                              {ad.ctaType && (
                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                  CTA: {ad.ctaType.replace(/_/g, " ")}
                                </span>
                              )}
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ad.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                                {ad.isActive ? "Active" : "Inactive"}
                              </span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 text-xs text-gray-400 space-y-1">
                            {ad.estimatedSpendRange && (
                              <p>Spend: <span className="text-gray-600 font-medium">{ad.estimatedSpendRange}</span></p>
                            )}
                            {ad.estimatedImpressionRange && (
                              <p>Impr: <span className="text-gray-600 font-medium">{ad.estimatedImpressionRange}</span></p>
                            )}
                            <p>First: {new Date(ad.firstSeenAt).toLocaleDateString()}</p>
                            <p>Last: {new Date(ad.lastSeenAt).toLocaleDateString()}</p>
                            {ad.adSnapshotUrl && (
                              <a
                                href={ad.adSnapshotUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:text-blue-700 underline"
                              >
                                View in Library →
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {expanded === c.id && c.adSnapshots.length === 0 && (
                <div className="border-t border-gray-100 px-5 py-6 text-center">
                  <p className="text-sm text-gray-400">No ad snapshots recorded yet.</p>
                  <p className="text-xs text-gray-400 mt-0.5">Snapshots are collected during Asset Discovery sync.</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
