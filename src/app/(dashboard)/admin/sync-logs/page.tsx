import { requirePermission } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  succeeded: "bg-green-100 text-green-700",
  failed:    "bg-red-100 text-red-600",
  running:   "bg-blue-100 text-blue-700",
  queued:    "bg-gray-100 text-gray-500",
};

const JOB_LABELS: Record<string, string> = {
  asset_discovery:   "Asset Discovery",
  hourly_sync:       "Hourly Sync",
  daily_reconcile:   "Daily Reconcile",
  budget_pacing:     "Budget Pacing",
  creative_fatigue:  "Creative Fatigue",
  creative_analysis: "Creative Analysis",
  alert_dispatch:    "Alert Dispatch",
};

function fmtDuration(ms: number | null): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export default async function SyncLogsPage() {
  await requirePermission("TRIGGER_SYNC");

  const [runs, jobs] = await Promise.all([
    prisma.syncRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 100,
    }),
    prisma.syncJob.findMany({
      where: { status: "queued" },
      orderBy: [{ priority: "desc" }, { scheduledFor: "asc" }],
      take: 20,
    }),
  ]);

  // Stats
  const total = runs.length;
  const succeeded = runs.filter((r) => r.status === "succeeded").length;
  const failed = runs.filter((r) => r.status === "failed").length;
  const avgDuration =
    runs.filter((r) => r.durationMs).reduce((sum, r) => sum + (r.durationMs ?? 0), 0) /
    (runs.filter((r) => r.durationMs).length || 1);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sync Logs</h1>
          <p className="text-sm text-gray-500 mt-1">Background job history and queue status</p>
        </div>
        <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">← Back to Admin</Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Runs", value: total, color: "text-gray-900" },
          { label: "Succeeded", value: succeeded, color: "text-green-600" },
          { label: "Failed", value: failed, color: "text-red-600" },
          { label: "Avg Duration", value: fmtDuration(Math.round(avgDuration)), color: "text-blue-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Queue */}
      {jobs.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-blue-700">Queued Jobs ({jobs.length})</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Job Type", "Client", "Scheduled For", "Priority"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-700">
                    {JOB_LABELS[job.jobType] ?? job.jobType}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">
                    {job.clientId ? job.clientId.slice(0, 8) + "…" : <span className="text-purple-500">global</span>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">
                    {new Date(job.scheduledFor).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${job.priority >= 10 ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500"}`}>
                      {job.priority >= 10 ? "High" : "Normal"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Run history */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700">Run History (last 100)</h2>
        </div>
        {runs.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">No sync runs yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Job Type", "Status", "Client", "Started", "Duration", "Items", "Error"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {runs.map((run) => (
                <tr key={run.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-700">
                    {JOB_LABELS[run.jobType] ?? run.jobType}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[run.status] ?? "bg-gray-100 text-gray-500"}`}>
                      {run.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">
                    {run.clientId ? run.clientId.slice(0, 8) + "…" : <span className="text-purple-500">global</span>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">
                    {new Date(run.startedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 font-mono text-xs">
                    {fmtDuration(run.durationMs ?? null)}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 text-center">
                    {run.entitiesProcessed ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-red-500 text-xs max-w-xs truncate">
                    {run.errorMessage ?? ""}
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
