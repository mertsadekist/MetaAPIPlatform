import { auth } from "@/lib/auth/auth";
import prisma from "@/lib/db/client";
import Link from "next/link";
import { Building2, Users, RefreshCw, Activity } from "lucide-react";

async function getStats() {
  const [clientCount, userCount, syncJobCount] = await Promise.all([
    prisma.client.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.syncJob.count({ where: { status: "queued" } }),
  ]);
  return { clientCount, userCount, syncJobCount };
}

export default async function AdminDashboard() {
  const session = await auth();
  const stats = await getStats();
  const username = (session?.user as any)?.displayName ?? (session?.user as any)?.username ?? "Admin";

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome, {username}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Meta Ads Intelligence Platform — Admin Dashboard
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="Active Clients"
          value={stats.clientCount}
          icon={Building2}
          href="/admin/clients"
          color="blue"
        />
        <StatCard
          title="Active Users"
          value={stats.userCount}
          icon={Users}
          href="/admin/users"
          color="green"
        />
        <StatCard
          title="Queued Sync Jobs"
          value={stats.syncJobCount}
          icon={RefreshCw}
          href="/admin/sync-logs"
          color="orange"
        />
      </div>

      {/* Quick Links */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickLink href="/admin/clients/new" label="Add Client" />
          <QuickLink href="/admin/users" label="Manage Users" />
          <QuickLink href="/admin/sync-logs" label="View Sync Logs" />
          <QuickLink href="/admin/audit-logs" label="Audit Trail" />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  href,
  color,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  href: string;
  color: "blue" | "green" | "orange";
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    orange: "bg-orange-50 text-orange-600",
  };

  return (
    <Link
      href={href}
      className="bg-white rounded-xl border border-gray-200 p-6 hover:border-gray-300 transition-colors group"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <Activity className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors" />
      </div>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{title}</div>
    </Link>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-center px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm font-medium text-gray-700 transition-colors"
    >
      {label}
    </Link>
  );
}
