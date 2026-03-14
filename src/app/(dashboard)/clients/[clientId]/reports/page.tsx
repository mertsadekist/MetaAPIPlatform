"use client";

import { useState, useEffect, useRef } from "react";
import { use } from "react";

interface Report {
  id: string;
  reportType: string;
  dateRangeJson: { since: string; until: string };
  status: string;
  generatedAt: string | null;
  sentAt: string | null;
  recipientCount: number | null;
  errorMessage: string | null;
  createdAt: string;
}

const STATUS_STYLE: Record<string, string> = {
  queued:     "bg-gray-100 text-gray-600",
  generating: "bg-blue-100 text-blue-700 animate-pulse",
  completed:  "bg-green-100 text-green-700",
  failed:     "bg-red-100 text-red-700",
};

const TYPE_OPTIONS = ["daily", "weekly", "monthly"];

export default function ReportsPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState({
    reportType: "monthly",
    since: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    until: new Date().toISOString().slice(0, 10),
  });
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  function loadReports() {
    fetch(`/api/reports?clientId=${clientId}`)
      .then((r) => r.json())
      .then((d) => { setReports(d.reports ?? []); setLoading(false); });
  }

  useEffect(() => {
    loadReports();
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  // Poll while any report is generating
  useEffect(() => {
    const hasGenerating = reports.some((r) => r.status === "generating" || r.status === "queued");
    if (hasGenerating && !pollingRef.current) {
      pollingRef.current = setInterval(loadReports, 3000);
    } else if (!hasGenerating && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports]);

  async function handleGenerate() {
    setGenerating(true); setError(null);
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, ...form }),
    });
    const data = await res.json();
    if (res.ok) {
      setReports((prev) => [data.report, ...prev]);
    } else {
      setError(data.error ?? "Failed to generate report");
    }
    setGenerating(false);
  }

  async function viewReport(reportId: string) {
    const res = await fetch(`/api/reports/${reportId}`);
    const data = await res.json();
    if (data.report?.htmlContent) {
      const win = window.open("", "_blank");
      if (win) { win.document.write(data.report.htmlContent); win.document.close(); }
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>

      {/* Generate form */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Generate Report</h2>
        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Report Type</label>
            <select
              value={form.reportType}
              onChange={(e) => setForm((f) => ({ ...f, reportType: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700"
            >
              {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={form.since}
              onChange={(e) => setForm((f) => ({ ...f, since: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={form.until}
              onChange={(e) => setForm((f) => ({ ...f, until: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700"
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {generating ? "Queueing…" : "Generate Report"}
          </button>
        </div>
        {error && <p className="text-red-600 text-xs mt-2">{error}</p>}
      </div>

      {/* Reports list */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Report History</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 text-sm">No reports generated yet.</p>
            <p className="text-gray-400 text-xs mt-1">Use the form above to generate your first report.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Period</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Generated</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 capitalize font-medium">{r.reportType}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {r.dateRangeJson?.since} – {r.dateRangeJson?.until}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLE[r.status] ?? "bg-gray-100 text-gray-500"}`}>
                      {r.status}
                    </span>
                    {r.errorMessage && (
                      <p className="text-xs text-red-500 mt-0.5 max-w-48 truncate" title={r.errorMessage}>
                        {r.errorMessage}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {r.generatedAt ? new Date(r.generatedAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.status === "completed" && (
                      <button
                        onClick={() => viewReport(r.id)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        View →
                      </button>
                    )}
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
