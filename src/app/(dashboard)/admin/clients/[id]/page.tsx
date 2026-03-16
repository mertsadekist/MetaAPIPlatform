"use client";

import { useState, useEffect } from "react";
import { use } from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  UserPlus,
  Trash2,
  ExternalLink,
  ArrowLeft,
  BarChart2,
} from "lucide-react";

interface ClientDetail {
  id: string;
  displayName: string;
  slug: string | null;
  timezone: string | null;
  currency: string | null;
  monthlyBudget: number | null;
  isActive: boolean;
  createdAt: string;
  _count: { adAccounts: number; leads: number; campaigns: number };
}

interface ClientUser {
  userId: string;
  accessLevel: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    displayName: string | null;
    email: string | null;
    role: string;
  };
}

interface AllUser {
  id: string;
  username: string;
  displayName: string | null;
  email: string | null;
  role: string;
}

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700",
  analyst: "bg-blue-100 text-blue-700",
  client_manager: "bg-green-100 text-green-700",
  client_viewer: "bg-gray-100 text-gray-700",
};

const ACCESS_COLORS: Record<string, string> = {
  full: "bg-green-100 text-green-700",
  read_only: "bg-gray-100 text-gray-600",
};

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [users, setUsers] = useState<ClientUser[]>([]);
  const [allUsers, setAllUsers] = useState<AllUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [addUserId, setAddUserId] = useState("");
  const [addAccessLevel, setAddAccessLevel] = useState("full");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  const [removing, setRemoving] = useState<string | null>(null);

  async function load() {
    const [clientRes, usersRes, allUsersRes] = await Promise.all([
      fetch(`/api/clients/${id}`),
      fetch(`/api/clients/${id}/users`),
      fetch(`/api/users`),
    ]);
    if (clientRes.ok) {
      const d = await clientRes.json();
      setClient(d.client ?? d);
    }
    if (usersRes.ok) setUsers(await usersRes.json());
    if (allUsersRes.ok) setAllUsers(await allUsersRes.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  const assignedIds = new Set(users.map((u) => u.userId));
  const unassignedUsers = allUsers.filter((u) => !assignedIds.has(u.id) && u.role !== "owner" && u.role !== "analyst");

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!addUserId) return;
    setAdding(true);
    setAddError("");
    const res = await fetch(`/api/clients/${id}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: addUserId, accessLevel: addAccessLevel }),
    });
    const data = await res.json();
    if (res.ok) {
      setAddUserId("");
      await load();
    } else {
      setAddError(data.error ?? "Failed to assign user");
    }
    setAdding(false);
  }

  async function handleRemove(userId: string) {
    setRemoving(userId);
    await fetch(`/api/clients/${id}/users`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setUsers((prev) => prev.filter((u) => u.userId !== userId));
    setRemoving(null);
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!client) {
    return <div className="p-8 text-red-600">Client not found.</div>;
  }

  return (
    <div className="p-8 max-w-4xl space-y-6">
      {/* Back + header */}
      <div>
        <Link href="/admin/clients" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Clients
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-lg font-bold text-white uppercase">{client.displayName[0]}</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{client.displayName}</h1>
              {client.slug && <p className="text-sm text-gray-500">/{client.slug}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${client.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
              {client.isActive ? "Active" : "Inactive"}
            </span>
            <Link
              href={`/clients/${id}/overview`}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View Portal
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Ad Accounts", value: client._count.adAccounts, icon: BarChart2 },
          { label: "Campaigns", value: client._count.campaigns, icon: BarChart2 },
          { label: "Leads", value: client._count.leads, icon: Users },
          { label: "Users Assigned", value: users.length, icon: Users },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Client Info */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 bg-gray-50">
          <Building2 className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">Client Details</span>
          <Link href={`/admin/clients/${id}/kpi-targets`} className="ml-auto text-xs text-blue-600 hover:underline">
            Manage KPI Targets →
          </Link>
        </div>
        <div className="px-5 py-2 divide-y divide-gray-100">
          {[
            { label: "Display Name", value: client.displayName },
            { label: "Timezone", value: client.timezone ?? "—" },
            { label: "Currency", value: client.currency ?? "—" },
            { label: "Monthly Budget", value: client.monthlyBudget ? `$${Number(client.monthlyBudget).toLocaleString()}` : "—" },
            { label: "Created", value: new Date(client.createdAt).toLocaleDateString() },
          ].map((r) => (
            <div key={r.label} className="flex items-center justify-between py-3">
              <span className="text-sm text-gray-500">{r.label}</span>
              <span className="text-sm font-medium text-gray-800">{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* User Assignment */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 bg-gray-50">
          <Users className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">
            Assigned Users ({users.length})
          </span>
        </div>

        {/* Assign new user form */}
        <div className="px-5 py-4 border-b border-gray-100 bg-blue-50/50">
          <form onSubmit={handleAssign} className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-48">
              <label className="block text-xs font-medium text-gray-600 mb-1">Add User</label>
              <select
                value={addUserId}
                onChange={(e) => setAddUserId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">— Select user to assign —</option>
                {unassignedUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName ?? u.username} (@{u.username}) · {u.role}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Access Level</label>
              <select
                value={addAccessLevel}
                onChange={(e) => setAddAccessLevel(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="full">Full Access</option>
                <option value="read_only">Read Only</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={adding || !addUserId}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <UserPlus className="w-4 h-4" />
              {adding ? "Assigning…" : "Assign"}
            </button>
          </form>
          {addError && <p className="text-red-600 text-xs mt-2">{addError}</p>}
          {unassignedUsers.length === 0 && (
            <p className="text-xs text-gray-400 mt-2">
              All eligible users are already assigned, or no users exist. Owners and analysts have global access.
            </p>
          )}
        </div>

        {/* Users list */}
        {users.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">
            No users assigned yet. Owners and analysts have access to all clients by default.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-5 py-2.5 text-left font-medium text-gray-500">User</th>
                <th className="px-5 py-2.5 text-left font-medium text-gray-500">Role</th>
                <th className="px-5 py-2.5 text-left font-medium text-gray-500">Access Level</th>
                <th className="px-5 py-2.5 text-left font-medium text-gray-500">Assigned</th>
                <th className="px-5 py-2.5 text-right font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((cu) => (
                <tr key={cu.userId} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="font-medium text-gray-900">{cu.user.displayName ?? cu.user.username}</div>
                    <div className="text-xs text-gray-400">@{cu.user.username}{cu.user.email && ` · ${cu.user.email}`}</div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[cu.user.role] ?? "bg-gray-100 text-gray-600"}`}>
                      {cu.user.role.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACCESS_COLORS[cu.accessLevel] ?? "bg-gray-100 text-gray-600"}`}>
                      {cu.accessLevel.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500">
                    {new Date(cu.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => handleRemove(cu.userId)}
                      disabled={removing === cu.userId}
                      className="text-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
                      title="Remove access"
                    >
                      {removing === cu.userId ? (
                        <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
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
