import prisma from "@/lib/db/client";
import Link from "next/link";
import { Plus, Building2 } from "lucide-react";

async function getClients() {
  return prisma.client.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { adAccounts: true, leads: true } },
    },
  });
}

export default async function ClientsPage() {
  const clients = await getClients();

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500 text-sm mt-1">{clients.length} total clients</p>
        </div>
        <Link
          href="/admin/clients/new"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Client
        </Link>
      </div>

      {clients.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No clients yet</h3>
          <p className="text-gray-500 text-sm mb-6">
            Create your first client to get started
          </p>
          <Link
            href="/admin/clients/new"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Client
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                  Client
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                  Industry
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                  Ad Accounts
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                  Leads
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                  Status
                </th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <span className="text-xs font-bold text-blue-700">
                          {client.displayName[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {client.displayName}
                        </div>
                        <div className="text-xs text-gray-500">{client.currencyCode} · {client.timezone}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {client.industry ?? "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {client._count.adAccounts}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {client._count.leads}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        client.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {client.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/clients/${client.id}/overview`}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium mr-4"
                    >
                      View
                    </Link>
                    <Link
                      href={`/admin/clients/${client.id}/kpi-targets`}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      KPI Targets
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
