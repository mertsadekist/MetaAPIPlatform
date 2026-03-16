import { requirePermission } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";
import Link from "next/link";

const SCOPE_COLORS: Record<string, string> = {
  auth:     "bg-blue-100 text-blue-700",
  client:   "bg-purple-100 text-purple-700",
  admin:    "bg-red-100 text-red-600",
  system:   "bg-gray-100 text-gray-600",
  api:      "bg-orange-100 text-orange-700",
};

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; scope?: string; userId?: string }>;
}) {
  await requirePermission("VIEW_AUDIT_LOGS");

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1"));
  const scope = sp.scope ?? undefined;
  const userId = sp.userId ?? undefined;
  const limit = 50;
  const skip = (page - 1) * limit;

  const where = {
    ...(scope ? { eventScope: scope } : {}),
    ...(userId ? { userId } : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { displayName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const scopes = await prisma.auditLog.groupBy({
    by: ["eventScope"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total.toLocaleString()} total events
          </p>
        </div>
        <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">← Back to Admin</Link>
      </div>

      {/* Scope filter pills */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/audit-logs"
          className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${!scope ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-600 hover:border-gray-400"}`}
        >
          All ({total.toLocaleString()})
        </Link>
        {scopes.map((s) => (
          <Link
            key={s.eventScope}
            href={`/admin/audit-logs?scope=${s.eventScope}`}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${scope === s.eventScope ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-600 hover:border-gray-400"}`}
          >
            {s.eventScope ?? "unknown"} ({s._count.id})
          </Link>
        ))}
      </div>

      {/* Logs table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">No audit logs found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Timestamp", "Event", "Scope", "User", "Client", "IP Address"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-gray-800 text-xs">
                    {log.eventType}
                  </td>
                  <td className="px-4 py-2.5">
                    {log.eventScope && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SCOPE_COLORS[log.eventScope] ?? "bg-gray-100 text-gray-600"}`}>
                        {log.eventScope}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 text-xs">
                    {log.user ? (log.user.displayName ?? log.user.email) : (log.userId ? log.userId.slice(0, 8) + "…" : <span className="text-gray-300">system</span>)}
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">
                    {log.clientId ? log.clientId.slice(0, 8) + "…" : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">
                    {log.ipAddress ?? "—"}
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
          <p className="text-gray-500">
            Page {page} of {totalPages} · {total.toLocaleString()} events
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/admin/audit-logs?page=${page - 1}${scope ? `&scope=${scope}` : ""}`}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                ← Prev
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/admin/audit-logs?page=${page + 1}${scope ? `&scope=${scope}` : ""}`}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
