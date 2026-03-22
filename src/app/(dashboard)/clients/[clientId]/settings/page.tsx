"use client";

import { useState, useEffect } from "react";
import { use } from "react";

// ─── Types ────────────────────────────────────────────────────────
interface KpiTarget {
  id: string;
  monthYear: string;
  targetLeads: number | null;
  targetBudget: number | null;
  targetCpl: number | null;
  targetRoas: number | null;
  targetCpql: number | null;
  notes: string | null;
}

interface AlertRecipient {
  id: string;
  channel: string;
  identifier: string;
  displayName: string | null;
  isActive: boolean;
  alertTypes: string[] | null;
}

interface SharedLink {
  id: string;
  token: string;
  label: string | null;
  expiresAt: string;
  viewCount: number;
  isActive: boolean;
  createdByUser: { displayName: string | null; email: string | null };
}

type Tab = "kpi" | "alerts" | "links";

const THIS_MONTH = new Date().toISOString().slice(0, 7);

// ─── Main Component ───────────────────────────────────────────────
export default function SettingsPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);
  const [tab, setTab] = useState<Tab>("kpi");

  const TABS: { id: Tab; label: string }[] = [
    { id: "kpi", label: "KPI Targets" },
    { id: "alerts", label: "Alert Recipients" },
    { id: "links", label: "Shared Links" },
  ];

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Tab bar */}
      <div className="border-b border-gray-200 flex gap-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "kpi"    && <KpiTargetSection clientId={clientId} />}
      {tab === "alerts" && <AlertRecipientsSection clientId={clientId} />}
      {tab === "links"  && <SharedLinksSection clientId={clientId} />}
    </div>
  );
}

// ─── KPI Targets ─────────────────────────────────────────────────
function KpiTargetSection({ clientId }: { clientId: string }) {
  const [targets, setTargets] = useState<KpiTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [monthYear, setMonthYear] = useState(THIS_MONTH);
  const [form, setForm] = useState({
    targetBudget: "", targetLeads: "", targetCpl: "", targetRoas: "", targetCpql: "", notes: "",
  });
  const [saved, setSaved] = useState(false);
  const [currency, setCurrency] = useState("USD");

  const fmtC = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);

  useEffect(() => {
    fetch(`/api/clients/${clientId}`)
      .then((r) => r.json())
      .then((d) => { if (d?.currencyCode) setCurrency(d.currencyCode); })
      .catch(() => {});
    fetch(`/api/clients/${clientId}/kpi-targets`)
      .then((r) => r.json())
      .then((d) => {
        setTargets(d.targets ?? []);
        setLoading(false);
        // Pre-fill form from current month if exists
        const cur = d.targets?.find((t: KpiTarget) => t.monthYear === THIS_MONTH);
        if (cur) {
          setForm({
            targetBudget: cur.targetBudget ?? "",
            targetLeads: cur.targetLeads ?? "",
            targetCpl: cur.targetCpl ?? "",
            targetRoas: cur.targetRoas ?? "",
            targetCpql: cur.targetCpql ?? "",
            notes: cur.notes ?? "",
          });
        }
      });
  }, [clientId]);

  async function handleSave() {
    setSaving(true);
    const body: Record<string, unknown> = { monthYear };
    if (form.targetBudget) body.targetBudget = parseFloat(form.targetBudget);
    if (form.targetLeads) body.targetLeads = parseInt(form.targetLeads);
    if (form.targetCpl) body.targetCpl = parseFloat(form.targetCpl);
    if (form.targetRoas) body.targetRoas = parseFloat(form.targetRoas);
    if (form.targetCpql) body.targetCpql = parseFloat(form.targetCpql);
    if (form.notes) body.notes = form.notes;

    const res = await fetch(`/api/clients/${clientId}/kpi-targets`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      setTargets((prev) => {
        const idx = prev.findIndex((t) => t.monthYear === monthYear);
        if (idx >= 0) { const next = [...prev]; next[idx] = data.target; return next; }
        return [data.target, ...prev];
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      {/* Form */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-gray-700">Set Monthly KPI Targets</h2>
          <input
            type="month"
            value={monthYear}
            onChange={(e) => {
              setMonthYear(e.target.value);
              const cur = targets.find((t) => t.monthYear === e.target.value);
              setForm({
                targetBudget: String(cur?.targetBudget ?? ""),
                targetLeads: String(cur?.targetLeads ?? ""),
                targetCpl: String(cur?.targetCpl ?? ""),
                targetRoas: String(cur?.targetRoas ?? ""),
                targetCpql: String(cur?.targetCpql ?? ""),
                notes: cur?.notes ?? "",
              });
            }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { key: "targetBudget", label: `Monthly Budget (${currency})` },
            { key: "targetLeads",  label: "Target Leads" },
            { key: "targetCpl",    label: `Target CPL (${currency})` },
            { key: "targetRoas",   label: "Target ROAS" },
            { key: "targetCpql",   label: `Target CPQL (${currency})` },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs text-gray-500 mb-1">{label}</label>
              <input
                type="number"
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder="—"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
        </div>

        <div className="mt-4">
          <label className="block text-xs text-gray-500 mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={2}
            placeholder="Optional notes for this month's targets"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Targets"}
          </button>
          {saved && <span className="text-green-600 text-sm font-medium">Saved ✓</span>}
        </div>
      </div>

      {/* History */}
      {!loading && targets.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">Target History</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Month", "Budget", "Leads", "CPL", "ROAS", "CPQL"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {targets.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => {
                  setMonthYear(t.monthYear);
                  setForm({
                    targetBudget: String(t.targetBudget ?? ""),
                    targetLeads: String(t.targetLeads ?? ""),
                    targetCpl: String(t.targetCpl ?? ""),
                    targetRoas: String(t.targetRoas ?? ""),
                    targetCpql: String(t.targetCpql ?? ""),
                    notes: t.notes ?? "",
                  });
                }}>
                  <td className="px-4 py-2.5 font-medium">{t.monthYear}</td>
                  <td className="px-4 py-2.5">{t.targetBudget ? fmtC(Number(t.targetBudget)) : "—"}</td>
                  <td className="px-4 py-2.5">{t.targetLeads ?? "—"}</td>
                  <td className="px-4 py-2.5">{t.targetCpl ? fmtC(Number(t.targetCpl)) : "—"}</td>
                  <td className="px-4 py-2.5">{t.targetRoas ? `${Number(t.targetRoas).toFixed(2)}x` : "—"}</td>
                  <td className="px-4 py-2.5">{t.targetCpql ? fmtC(Number(t.targetCpql)) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Alert Recipients ─────────────────────────────────────────────
function AlertRecipientsSection({ clientId }: { clientId: string }) {
  const [recipients, setRecipients] = useState<AlertRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ channel: "email", identifier: "", displayName: "" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/alerts/recipients?clientId=${clientId}`)
      .then((r) => r.json())
      .then((d) => { setRecipients(d.recipients ?? []); setLoading(false); });
  }, [clientId]);

  async function handleAdd() {
    setAdding(true); setError(null);
    const res = await fetch("/api/alerts/recipients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, ...form }),
    });
    const data = await res.json();
    if (res.ok) {
      setRecipients((prev) => [data.recipient, ...prev]);
      setForm({ channel: "email", identifier: "", displayName: "" });
    } else {
      setError(data.error ?? "Failed to add recipient");
    }
    setAdding(false);
  }

  const CHANNELS = ["email", "whatsapp", "telegram"];

  return (
    <div className="space-y-5">
      {/* Add form */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Add Alert Recipient</h2>
        <div className="flex gap-3 flex-wrap">
          <select
            value={form.channel}
            onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700"
          >
            {CHANNELS.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
          </select>
          <input
            type={form.channel === "email" ? "email" : "text"}
            value={form.identifier}
            onChange={(e) => setForm((f) => ({ ...f, identifier: e.target.value }))}
            placeholder={form.channel === "email" ? "email@example.com" : "+1234567890 or @username"}
            className="flex-1 min-w-48 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            value={form.displayName}
            onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
            placeholder="Display name (optional)"
            className="flex-1 min-w-40 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !form.identifier}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
        {error && <p className="text-red-600 text-xs mt-2">{error}</p>}
      </div>

      {/* List */}
      {!loading && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          {recipients.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No recipients added yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Channel</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Identifier</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recipients.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 capitalize">{r.channel}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.identifier}</td>
                    <td className="px-4 py-3 text-gray-600">{r.displayName ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {r.isActive ? "Active" : "Paused"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Shared Links ─────────────────────────────────────────────────
function SharedLinksSection({ clientId }: { clientId: string }) {
  const [links, setLinks] = useState<SharedLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ label: "", expiresInDays: "30", preset: "last_30d" });
  const [newUrl, setNewUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/shared-links?clientId=${clientId}`)
      .then((r) => r.json())
      .then((d) => { setLinks(d.links ?? []); setLoading(false); });
  }, [clientId]);

  async function handleCreate() {
    setCreating(true); setNewUrl(null);
    const res = await fetch("/api/shared-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        label: form.label || undefined,
        dateRange: { preset: form.preset },
        expiresInDays: parseInt(form.expiresInDays),
        scope: ["overview", "campaigns"],
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setLinks((prev) => [data.link, ...prev]);
      setNewUrl(data.shareUrl);
      setForm({ label: "", expiresInDays: "30", preset: "last_30d" });
    }
    setCreating(false);
  }

  async function handleRevoke(token: string) {
    const res = await fetch(`/api/shared-links/${token}`, { method: "DELETE" });
    if (res.ok) setLinks((prev) => prev.filter((l) => l.token !== token));
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  return (
    <div className="space-y-5">
      {/* Create form */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Create Shared Dashboard Link</h2>
        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Label</label>
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="e.g. Client Review Q1"
              className="w-56 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Date Range</label>
            <select
              value={form.preset}
              onChange={(e) => setForm((f) => ({ ...f, preset: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700"
            >
              <option value="last_7d">Last 7 days</option>
              <option value="last_14d">Last 14 days</option>
              <option value="last_30d">Last 30 days</option>
              <option value="last_90d">Last 90 days</option>
              <option value="this_month">This month</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Expires in (days)</label>
            <input
              type="number"
              min={1}
              max={365}
              value={form.expiresInDays}
              onChange={(e) => setForm((f) => ({ ...f, expiresInDays: e.target.value }))}
              className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create Link"}
          </button>
        </div>

        {newUrl && (
          <div className="mt-4 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <span className="text-xs text-green-800 font-mono flex-1 break-all">{newUrl}</span>
            <button
              onClick={() => copyUrl(newUrl)}
              className="text-xs text-green-700 font-semibold hover:text-green-900 flex-shrink-0"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
        )}
      </div>

      {/* Links list */}
      {!loading && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          {links.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No shared links created yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Label</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Created by</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Expires</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Views</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {links.map((l) => {
                  const shareUrl = `${window.location.origin}/shared/${l.token}`;
                  const expired = new Date(l.expiresAt) < new Date();
                  return (
                    <tr key={l.id}>
                      <td className="px-4 py-3 font-medium">{l.label ?? <span className="text-gray-400 italic">Unlabeled</span>}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{l.createdByUser?.displayName ?? l.createdByUser?.email ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs ${expired ? "text-red-500" : "text-gray-600"}`}>
                          {expired ? "Expired " : ""}{new Date(l.expiresAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{l.viewCount}</td>
                      <td className="px-4 py-3 text-right flex items-center justify-end gap-2">
                        <button
                          onClick={() => copyUrl(shareUrl)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Copy
                        </button>
                        <button
                          onClick={() => handleRevoke(l.token)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
