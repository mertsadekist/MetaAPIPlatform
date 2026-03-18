"use client";

import { useState, useEffect } from "react";
import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Users,
  UserPlus,
  Trash2,
  ExternalLink,
  ArrowLeft,
  BarChart2,
  Pencil,
  ChevronDown,
  ChevronUp,
  Shield,
  Check,
  X,
} from "lucide-react";
import { PLANS, getEffectiveAdAccountLimit, type SubscriptionPlan } from "@/lib/subscriptions/plans";

interface ClientDetail {
  id: string;
  displayName: string;
  industry: string | null;
  timezone: string;
  currencyCode: string;
  logoUrl: string | null;
  isActive: boolean;
  notes: string | null;
  subscriptionPlan: string;
  maxAdAccounts: number | null;
  createdAt: string;
  adAccounts: Array<{ id: string; name: string; metaAdAccountId: string; isAssigned: boolean; isActive: boolean }>;
  _count: { leads: number; competitors: number };
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

const TIMEZONES = [
  "UTC", "America/New_York", "America/Los_Angeles", "America/Chicago", "Europe/London",
  "Europe/Paris", "Europe/Berlin", "Asia/Dubai", "Asia/Riyadh", "Africa/Cairo",
  "Asia/Kuwait", "Asia/Qatar", "Asia/Bahrain", "Asia/Amman", "Asia/Beirut",
];

const INDUSTRIES = [
  "Real Estate", "Education", "E-Commerce", "Healthcare", "Finance",
  "Technology", "Retail", "Hospitality", "Automotive", "Other",
];

const CURRENCIES = ["USD", "EUR", "GBP", "AED", "SAR", "EGP", "KWD", "QAR", "BHD", "JOD", "LBP"];

const PLAN_BADGE_COLORS: Record<string, string> = {
  starter: "bg-gray-100 text-gray-700",
  pro: "bg-blue-100 text-blue-700",
  enterprise: "bg-purple-100 text-purple-700",
};

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700",
  analyst: "bg-blue-100 text-blue-700",
  client_manager: "bg-green-100 text-green-700",
  client_viewer: "bg-gray-100 text-gray-700",
};

const ACCESS_COLORS: Record<string, string> = {
  read: "bg-gray-100 text-gray-600",
  manage: "bg-green-100 text-green-700",
  full: "bg-green-100 text-green-700",
  read_only: "bg-gray-100 text-gray-600",
};

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [users, setUsers] = useState<ClientUser[]>([]);
  const [allUsers, setAllUsers] = useState<AllUser[]>([]);
  const [loading, setLoading] = useState(true);

  // User assignment
  const [addUserId, setAddUserId] = useState("");
  const [addAccessLevel, setAddAccessLevel] = useState("manage");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);

  // Edit client
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    displayName: "", industry: "", timezone: "UTC", currencyCode: "USD",
    notes: "", subscriptionPlan: "pro", maxAdAccounts: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // Delete client
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Toggle active
  const [toggling, setToggling] = useState(false);

  // Per-user ad account restrictions
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [userRestrictions, setUserRestrictions] = useState<Record<string, {
    adAccountIds: string[];
    permissionLevel: string;
    loaded: boolean;
  }>>({});
  const [savingRestrictions, setSavingRestrictions] = useState<string | null>(null);

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
      body: JSON.stringify({ userId: addUserId, accessLevel: addAccessLevel === "full" ? "manage" : "read" }),
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

  function openEdit() {
    if (!client) return;
    setEditForm({
      displayName: client.displayName,
      industry: client.industry ?? "",
      timezone: client.timezone ?? "UTC",
      currencyCode: client.currencyCode ?? "USD",
      notes: client.notes ?? "",
      subscriptionPlan: client.subscriptionPlan ?? "pro",
      maxAdAccounts: client.maxAdAccounts !== null ? String(client.maxAdAccounts) : "",
    });
    setEditError("");
    setShowEdit(true);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    setEditSaving(true);
    setEditError("");
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          maxAdAccounts: editForm.maxAdAccounts === "" ? null : Number(editForm.maxAdAccounts),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setEditError(data.error ?? "Failed to save");
        return;
      }
      const updated = await res.json();
      setClient((prev) => prev ? { ...prev, ...updated } : prev);
      setShowEdit(false);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleToggleActive() {
    if (!client) return;
    setToggling(true);
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !client.isActive }),
      });
      if (res.ok) {
        setClient((prev) => prev ? { ...prev, isActive: !prev.isActive } : prev);
      }
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/admin/clients");
      }
    } finally {
      setDeleting(false);
    }
  }

  async function loadUserRestrictions(userId: string) {
    const res = await fetch(`/api/users/${userId}/ad-accounts?clientId=${id}`);
    if (res.ok) {
      const data = await res.json();
      setUserRestrictions((prev) => ({
        ...prev,
        [userId]: {
          adAccountIds: data.restrictions.map((r: { adAccountId: string }) => r.adAccountId),
          permissionLevel: data.restrictions[0]?.permissionLevel ?? "view",
          loaded: true,
        },
      }));
    }
  }

  async function toggleExpandUser(userId: string) {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      return;
    }
    setExpandedUserId(userId);
    if (!userRestrictions[userId]?.loaded) {
      await loadUserRestrictions(userId);
    }
  }

  function toggleAccountInRestriction(userId: string, accountId: string) {
    setUserRestrictions((prev) => {
      const current = prev[userId] ?? { adAccountIds: [], permissionLevel: "view", loaded: true };
      const ids = current.adAccountIds.includes(accountId)
        ? current.adAccountIds.filter((id) => id !== accountId)
        : [...current.adAccountIds, accountId];
      return { ...prev, [userId]: { ...current, adAccountIds: ids } };
    });
  }

  async function saveUserRestrictions(userId: string) {
    const restriction = userRestrictions[userId];
    if (!restriction) return;
    setSavingRestrictions(userId);
    try {
      await fetch(`/api/users/${userId}/ad-accounts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: id,
          adAccountIds: restriction.adAccountIds,
          permissionLevel: restriction.permissionLevel,
        }),
      });
      setExpandedUserId(null);
    } finally {
      setSavingRestrictions(null);
    }
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

  const plan = (client.subscriptionPlan ?? "pro") as SubscriptionPlan;
  const adAccountLimit = getEffectiveAdAccountLimit(plan, client.maxAdAccounts);
  const assignedAccountsCount = client.adAccounts?.filter((a) => a.isAssigned).length ?? 0;

  return (
    <div className="p-8 max-w-4xl space-y-6">
      {/* ── Back + Header ─────────────────────────────────── */}
      <div>
        <Link href="/admin/clients" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Clients
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-lg font-bold text-white uppercase">{client.displayName[0]}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{client.displayName}</h1>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_BADGE_COLORS[plan] ?? "bg-gray-100 text-gray-600"}`}>
                  {PLANS[plan]?.label ?? plan}
                </span>
              </div>
              {client.industry && <p className="text-sm text-gray-400">{client.industry}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status toggle */}
            <button
              onClick={handleToggleActive}
              disabled={toggling}
              title={client.isActive ? "Click to deactivate" : "Click to activate"}
              className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-all cursor-pointer ${client.isActive ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-200" : "bg-red-100 text-red-600 border-red-200 hover:bg-red-200"} ${toggling ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {toggling ? "..." : client.isActive ? "Active" : "Inactive"}
            </button>

            {/* Edit button */}
            <button onClick={openEdit}
              className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors ${showEdit ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
              <Pencil className="w-3.5 h-3.5" /> Edit Client
            </button>

            {/* Delete button */}
            {deleteConfirm ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-red-600 font-medium">Delete?</span>
                <button onClick={handleDelete} disabled={deleting}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg disabled:opacity-50">
                  <Check className="w-3.5 h-3.5" /> Yes
                </button>
                <button onClick={() => setDeleteConfirm(false)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-300 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50">
                  <X className="w-3.5 h-3.5" /> No
                </button>
              </div>
            ) : (
              <button onClick={() => setDeleteConfirm(true)}
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            )}

            <Link href={`/clients/${id}/overview`}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5">
              <ExternalLink className="w-3.5 h-3.5" /> View Portal
            </Link>
          </div>
        </div>
      </div>

      {/* ── Inline Edit Form ──────────────────────────────── */}
      {showEdit && (
        <form onSubmit={handleEdit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Edit Client</h2>
          {editError && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{editError}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Display Name *</label>
              <input type="text" value={editForm.displayName} onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Industry</label>
              <select value={editForm.industry} onChange={(e) => setEditForm({ ...editForm, industry: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Select industry —</option>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Timezone</label>
              <select value={editForm.timezone} onChange={(e) => setEditForm({ ...editForm, timezone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Currency</label>
              <select value={editForm.currencyCode} onChange={(e) => setEditForm({ ...editForm, currencyCode: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Subscription */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-semibold text-gray-800">Subscription Plan</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Plan</label>
                <select value={editForm.subscriptionPlan} onChange={(e) => setEditForm({ ...editForm, subscriptionPlan: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="starter">Starter — up to 3 ad accounts</option>
                  <option value="pro">Pro — up to 15 ad accounts</option>
                  <option value="enterprise">Enterprise — unlimited ad accounts</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Custom Ad Account Limit <span className="font-normal text-gray-400">(leave blank to use plan default)</span>
                </label>
                <input type="number" min={1} value={editForm.maxAdAccounts}
                  onChange={(e) => setEditForm({ ...editForm, maxAdAccounts: e.target.value })}
                  placeholder={`Plan default: ${PLANS[editForm.subscriptionPlan as SubscriptionPlan]?.maxAdAccounts ?? "unlimited"}`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            {/* Plan features */}
            {(() => {
              const p = PLANS[editForm.subscriptionPlan as SubscriptionPlan];
              if (!p) return null;
              return (
                <div className="flex flex-wrap gap-2 text-xs">
                  {[
                    { label: "AI Features", val: p.aiFeatures },
                    { label: "Reports", val: p.reports },
                    { label: "Alerts", val: p.alerts },
                    { label: "Shared Links", val: p.sharedLinks },
                  ].map((f) => (
                    <span key={f.label} className={`px-2 py-0.5 rounded-full font-medium ${f.val ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400 line-through"}`}>
                      {f.label}
                    </span>
                  ))}
                </div>
              );
            })()}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={editSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2 rounded-lg disabled:opacity-50">
              {editSaving ? "Saving..." : "Save Changes"}
            </button>
            <button type="button" onClick={() => setShowEdit(false)} className="text-sm text-gray-600 px-4 py-2">Cancel</button>
          </div>
        </form>
      )}

      {/* ── Stats ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">
            {assignedAccountsCount}
            {adAccountLimit !== null && (
              <span className="text-base font-normal text-gray-400"> / {adAccountLimit}</span>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            Ad Accounts {adAccountLimit === null ? "(unlimited)" : "assigned"}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">{client._count.leads}</div>
          <div className="text-xs text-gray-500 mt-0.5">Total Leads</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">{client._count.competitors}</div>
          <div className="text-xs text-gray-500 mt-0.5">Competitors Tracked</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">{users.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Users Assigned</div>
        </div>
      </div>

      {/* ── Client Info ──────────────────────────────────── */}
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
            { label: "Industry", value: client.industry ?? "—" },
            { label: "Timezone", value: client.timezone ?? "—" },
            { label: "Currency", value: client.currencyCode ?? "—" },
            { label: "Subscription Plan", value: PLANS[plan]?.label ?? plan },
            { label: "Ad Account Quota", value: adAccountLimit !== null ? `${assignedAccountsCount} / ${adAccountLimit} used` : "Unlimited" },
            { label: "Notes", value: client.notes ?? "—" },
            { label: "Created", value: new Date(client.createdAt).toLocaleDateString() },
          ].map((r) => (
            <div key={r.label} className="flex items-start justify-between py-3">
              <span className="text-sm text-gray-500">{r.label}</span>
              <span className="text-sm font-medium text-gray-800 text-right max-w-xs">{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── User Assignment ──────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 bg-gray-50">
          <Users className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">Assigned Users ({users.length})</span>
        </div>

        {/* Assign form */}
        <div className="px-5 py-4 border-b border-gray-100 bg-blue-50/50">
          <form onSubmit={handleAssign} className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-48">
              <label className="block text-xs font-medium text-gray-600 mb-1">Add User</label>
              <select value={addUserId} onChange={(e) => setAddUserId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
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
              <select value={addAccessLevel} onChange={(e) => setAddAccessLevel(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="manage">Full Access</option>
                <option value="read">Read Only</option>
              </select>
            </div>
            <button type="submit" disabled={adding || !addUserId}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              <UserPlus className="w-4 h-4" />
              {adding ? "Assigning…" : "Assign"}
            </button>
          </form>
          {addError && <p className="text-red-600 text-xs mt-2">{addError}</p>}
          {unassignedUsers.length === 0 && (
            <p className="text-xs text-gray-400 mt-2">
              All eligible users are already assigned. Owners and analysts have global access.
            </p>
          )}
        </div>

        {/* Users list */}
        {users.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">
            No users assigned. Owners and analysts have access to all clients by default.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {users.map((cu) => (
              <div key={cu.userId}>
                {/* User row */}
                <div className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {cu.user.displayName ?? cu.user.username}
                    </div>
                    <div className="text-xs text-gray-400">@{cu.user.username}{cu.user.email ? ` · ${cu.user.email}` : ""}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${ROLE_COLORS[cu.user.role] ?? "bg-gray-100 text-gray-600"}`}>
                    {cu.user.role.replace(/_/g, " ")}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${ACCESS_COLORS[cu.accessLevel] ?? "bg-gray-100 text-gray-600"}`}>
                    {cu.accessLevel === "manage" || cu.accessLevel === "full" ? "Full Access" : "Read Only"}
                  </span>
                  <span className="text-xs text-gray-400 flex-shrink-0">{new Date(cu.createdAt).toLocaleDateString()}</span>

                  {/* Restrict accounts button */}
                  {client.adAccounts && client.adAccounts.length > 0 && (
                    <button
                      onClick={() => toggleExpandUser(cu.userId)}
                      className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-colors flex-shrink-0 ${expandedUserId === cu.userId ? "bg-indigo-100 text-indigo-700 border-indigo-200" : "border-gray-200 text-gray-500 hover:border-indigo-200 hover:text-indigo-600"}`}
                      title="Restrict ad account access">
                      <Shield className="w-3 h-3" />
                      Accounts
                      {expandedUserId === cu.userId ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  )}

                  <button onClick={() => handleRemove(cu.userId)} disabled={removing === cu.userId}
                    className="text-red-400 hover:text-red-600 transition-colors disabled:opacity-40 flex-shrink-0" title="Remove access">
                    {removing === cu.userId
                      ? <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>

                {/* Ad account restriction panel */}
                {expandedUserId === cu.userId && (
                  <div className="px-5 py-4 bg-indigo-50 border-t border-indigo-100">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="text-xs font-semibold text-indigo-900">
                        Ad Account Access for {cu.user.displayName ?? cu.user.username}
                      </span>
                      <span className="text-xs text-indigo-500 font-normal">
                        — No restrictions = user sees all assigned accounts
                      </span>
                    </div>

                    {!userRestrictions[cu.userId]?.loaded ? (
                      <div className="text-xs text-gray-400">Loading...</div>
                    ) : (
                      <>
                        {/* Permission level */}
                        <div className="flex items-center gap-4 mb-3">
                          <span className="text-xs font-medium text-gray-700">Permission:</span>
                          {["view", "manage"].map((level) => (
                            <label key={level} className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name={`perm-${cu.userId}`}
                                value={level}
                                checked={(userRestrictions[cu.userId]?.permissionLevel ?? "view") === level}
                                onChange={() => setUserRestrictions((prev) => ({
                                  ...prev,
                                  [cu.userId]: { ...(prev[cu.userId] ?? { adAccountIds: [], loaded: true }), permissionLevel: level }
                                }))}
                                className="accent-indigo-600"
                              />
                              <span className="text-xs text-gray-700 capitalize">{level === "view" ? "View only" : "Full manage"}</span>
                            </label>
                          ))}
                        </div>

                        {/* Account checkboxes */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-3">
                          {/* "No restriction" option */}
                          <label className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:bg-white transition-colors bg-white border-indigo-300">
                            <input
                              type="checkbox"
                              checked={(userRestrictions[cu.userId]?.adAccountIds ?? []).length === 0}
                              onChange={() => {
                                setUserRestrictions((prev) => ({
                                  ...prev,
                                  [cu.userId]: { ...(prev[cu.userId] ?? { permissionLevel: "view", loaded: true }), adAccountIds: [] }
                                }));
                              }}
                              className="accent-indigo-600"
                            />
                            <span className="text-xs font-medium text-indigo-700">All accounts (no restriction)</span>
                          </label>
                          {client.adAccounts.filter((a) => a.isAssigned).map((acc) => {
                            const isChecked = (userRestrictions[cu.userId]?.adAccountIds ?? []).includes(acc.id);
                            return (
                              <label key={acc.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:bg-white transition-colors ${isChecked ? "bg-white border-indigo-400" : "bg-white/60 border-gray-200"}`}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleAccountInRestriction(cu.userId, acc.id)}
                                  className="accent-indigo-600"
                                />
                                <div className="min-w-0">
                                  <div className="text-xs font-medium text-gray-800 truncate">{acc.name}</div>
                                  <div className="text-xs text-gray-400">{acc.metaAdAccountId}</div>
                                </div>
                              </label>
                            );
                          })}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => saveUserRestrictions(cu.userId)}
                            disabled={savingRestrictions === cu.userId}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-4 py-1.5 rounded-lg disabled:opacity-50">
                            {savingRestrictions === cu.userId ? "Saving..." : "Save Access"}
                          </button>
                          <button onClick={() => setExpandedUserId(null)} className="text-xs text-gray-500 px-3 py-1.5">Cancel</button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
