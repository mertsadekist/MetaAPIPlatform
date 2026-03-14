"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { format, subMonths, addMonths } from "date-fns";

function getCurrentMonth() {
  return format(new Date(), "yyyy-MM");
}

export default function KpiTargetsPage() {
  const { id: clientId } = useParams<{ id: string }>();
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [form, setForm] = useState({
    targetLeads: "",
    targetBudget: "",
    targetCpl: "",
    targetRoas: "",
    targetCpql: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadTarget() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/clients/${clientId}/kpi-targets/${selectedMonth}`
        );
        if (res.ok) {
          const data = await res.json();
          setForm({
            targetLeads: data.targetLeads?.toString() ?? "",
            targetBudget: data.targetBudget?.toString() ?? "",
            targetCpl: data.targetCpl?.toString() ?? "",
            targetRoas: data.targetRoas?.toString() ?? "",
            targetCpql: data.targetCpql?.toString() ?? "",
            notes: data.notes ?? "",
          });
        } else {
          setForm({
            targetLeads: "",
            targetBudget: "",
            targetCpl: "",
            targetRoas: "",
            targetCpql: "",
            notes: "",
          });
        }
      } finally {
        setLoading(false);
      }
    }
    loadTarget();
  }, [clientId, selectedMonth]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      const body: Record<string, unknown> = {};
      if (form.targetLeads) body.targetLeads = parseInt(form.targetLeads);
      if (form.targetBudget) body.targetBudget = parseFloat(form.targetBudget);
      if (form.targetCpl) body.targetCpl = parseFloat(form.targetCpl);
      if (form.targetRoas) body.targetRoas = parseFloat(form.targetRoas);
      if (form.targetCpql) body.targetCpql = parseFloat(form.targetCpql);
      if (form.notes) body.notes = form.notes;

      const res = await fetch(
        `/api/clients/${clientId}/kpi-targets/${selectedMonth}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to save KPI targets");
      } else {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  }

  const prevMonth = format(subMonths(new Date(selectedMonth + "-01"), 1), "yyyy-MM");
  const nextMonth = format(addMonths(new Date(selectedMonth + "-01"), 1), "yyyy-MM");

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">KPI Targets</h1>
        <p className="text-gray-500 text-sm mt-1">
          Set monthly performance targets for this client
        </p>
      </div>

      {/* Month Selector */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => setSelectedMonth(prevMonth)}
          className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100"
        >
          ← {prevMonth}
        </button>
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
          <span className="text-sm font-semibold text-gray-900">{selectedMonth}</span>
        </div>
        <button
          onClick={() => setSelectedMonth(nextMonth)}
          className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100"
        >
          {nextMonth} →
        </button>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
            KPI targets saved successfully
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Target Leads" value={form.targetLeads} onChange={(v) => setForm({ ...form, targetLeads: v })} placeholder="e.g. 100" type="number" />
              <Field label="Monthly Budget ($)" value={form.targetBudget} onChange={(v) => setForm({ ...form, targetBudget: v })} placeholder="e.g. 5000" type="number" />
              <Field label="Target CPL ($)" value={form.targetCpl} onChange={(v) => setForm({ ...form, targetCpl: v })} placeholder="e.g. 50" type="number" />
              <Field label="Target ROAS" value={form.targetRoas} onChange={(v) => setForm({ ...form, targetRoas: v })} placeholder="e.g. 3.5" type="number" />
              <Field label="Target CPQL ($)" value={form.targetCpql} onChange={(v) => setForm({ ...form, targetCpql: v })} placeholder="e.g. 150" type="number" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Optional notes for this month..."
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-6 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Targets"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        step="any"
        min="0"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
