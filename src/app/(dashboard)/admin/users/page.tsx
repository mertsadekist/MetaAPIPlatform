"use client";

import { useState, useEffect } from "react";
import { Plus, User, Pencil, KeyRound, Trash2, X, Check } from "lucide-react";

interface UserRow {
  id: string;
  username: string;
  email: string | null;
  displayName: string | null;
  role: string;
  isActive: boolean;
  is2faEnabled: boolean;
  createdAt: string;
  _count: { clientAccess: number };
}

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700",
  analyst: "bg-blue-100 text-blue-700",
  client_manager: "bg-green-100 text-green-700",
  client_viewer: "bg-gray-100 text-gray-700",
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  analyst: "Analyst",
  client_manager: "Client Manager",
  client_viewer: "Client Viewer",
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: "", email: "", password: "", displayName: "", role: "client_viewer" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ displayName: "", email: "", role: "client_viewer", isActive: true });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // Password change
  const [passwordUserId, setPasswordUserId] = useState<string | null>(null);
  const [pwForm, setPwForm] = useState({ password: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");

  // Delete
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toggle active
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then(setUsers)
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        setCreateError(data.error ?? "Failed to create user");
        return;
      }
      const newUser = await res.json();
      setUsers((prev) => [newUser, ...prev]);
      setShowForm(false);
      setForm({ username: "", email: "", password: "", displayName: "", role: "client_viewer" });
    } finally {
      setCreating(false);
    }
  }

  function openEdit(user: UserRow) {
    if (editingId === user.id) { setEditingId(null); return; }
    setPasswordUserId(null);
    setEditingId(user.id);
    setEditForm({ displayName: user.displayName ?? "", email: user.email ?? "", role: user.role, isActive: user.isActive });
    setEditError("");
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setEditSaving(true);
    setEditError("");
    try {
      const res = await fetch(`/api/users/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const data = await res.json();
        setEditError(data.error ?? "Failed to save");
        return;
      }
      const updated = await res.json();
      setUsers((prev) => prev.map((u) => u.id === editingId ? { ...u, ...updated } : u));
      setEditingId(null);
    } finally {
      setEditSaving(false);
    }
  }

  function openPassword(user: UserRow) {
    if (passwordUserId === user.id) { setPasswordUserId(null); return; }
    setEditingId(null);
    setPasswordUserId(user.id);
    setPwForm({ password: "", confirm: "" });
    setPwError("");
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordUserId) return;
    if (pwForm.password !== pwForm.confirm) { setPwError("Passwords do not match"); return; }
    setPwSaving(true);
    setPwError("");
    try {
      const res = await fetch(`/api/users/${passwordUserId}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwForm.password }),
      });
      if (!res.ok) {
        const data = await res.json();
        setPwError(data.error ?? "Failed to change password");
        return;
      }
      setPasswordUserId(null);
    } finally {
      setPwSaving(false);
    }
  }

  async function handleToggleActive(user: UserRow) {
    setTogglingId(user.id);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      if (res.ok) {
        setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, isActive: !u.isActive } : u));
      }
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(userId: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        setDeleteConfirmId(null);
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-500 text-sm mt-1">{users.length} total users</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setCreateError(""); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {/* ── Create form ─────────────────────────────────────── */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-6 mb-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">New User</h2>
          {createError && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{createError}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
              <input type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="johndoe" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
              <input type="text" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="John Doe" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="john@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Min 8 characters" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="owner">Owner</option>
                <option value="analyst">Analyst</option>
                <option value="client_manager">Client Manager</option>
                <option value="client_viewer">Client Viewer</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={creating}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2 rounded-lg disabled:opacity-50">
              {creating ? "Creating..." : "Create User"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-600 px-4 py-2">Cancel</button>
          </div>
        </form>
      )}

      {/* ── Table ───────────────────────────────────────────── */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">User</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Role</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Clients</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Status</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((user) => (
                <>
                  {/* ── Main row ── */}
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-gray-500" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{user.displayName ?? user.username}</div>
                          <div className="text-xs text-gray-400">@{user.username}{user.email ? ` · ${user.email}` : ""}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[user.role] ?? "bg-gray-100 text-gray-700"}`}>
                        {ROLE_LABELS[user.role] ?? user.role}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-500">{user._count.clientAccess}</td>

                    {/* Status toggle */}
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleActive(user)}
                        disabled={togglingId === user.id}
                        title={user.isActive ? "Click to deactivate" : "Click to activate"}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${user.isActive ? "bg-green-500" : "bg-gray-300"} ${togglingId === user.id ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${user.isActive ? "translate-x-4" : "translate-x-0.5"}`} />
                      </button>
                      <span className={`ml-2 text-xs ${user.isActive ? "text-green-600" : "text-gray-400"}`}>
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        {deleteConfirmId === user.id ? (
                          <>
                            <span className="text-xs text-red-600 mr-2 font-medium">Delete user?</span>
                            <button onClick={() => handleDelete(user.id)} disabled={deleting}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg disabled:opacity-50 transition-colors">
                              <Check className="w-3.5 h-3.5" /> Yes
                            </button>
                            <button onClick={() => setDeleteConfirmId(null)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-300 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors">
                              <X className="w-3.5 h-3.5" /> Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => openEdit(user)} title="Edit user"
                              className={`p-1.5 rounded-lg transition-colors ${editingId === user.id ? "bg-blue-100 text-blue-700" : "text-gray-400 hover:text-blue-600 hover:bg-blue-50"}`}>
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => openPassword(user)} title="Change password"
                              className={`p-1.5 rounded-lg transition-colors ${passwordUserId === user.id ? "bg-amber-100 text-amber-700" : "text-gray-400 hover:text-amber-600 hover:bg-amber-50"}`}>
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setDeleteConfirmId(user.id)} title="Delete user"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* ── Edit panel ── */}
                  {editingId === user.id && (
                    <tr key={`edit-${user.id}`}>
                      <td colSpan={5} className="px-6 py-4 bg-blue-50 border-b border-blue-100">
                        <form onSubmit={handleEdit} className="space-y-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Pencil className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-semibold text-blue-900">Edit {user.username}</span>
                          </div>
                          {editError && <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-700">{editError}</div>}
                          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Display Name</label>
                              <input type="text" value={editForm.displayName} onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="John Doe" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                              <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="email@example.com" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                              <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="owner">Owner</option>
                                <option value="analyst">Analyst</option>
                                <option value="client_manager">Client Manager</option>
                                <option value="client_viewer">Client Viewer</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                              <select value={editForm.isActive ? "true" : "false"} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.value === "true" })}
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="true">Active</option>
                                <option value="false">Inactive</option>
                              </select>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button type="submit" disabled={editSaving}
                              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-4 py-1.5 rounded-lg disabled:opacity-50">
                              {editSaving ? "Saving..." : "Save Changes"}
                            </button>
                            <button type="button" onClick={() => setEditingId(null)} className="text-xs text-gray-600 px-3 py-1.5">Cancel</button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )}

                  {/* ── Password panel ── */}
                  {passwordUserId === user.id && (
                    <tr key={`pw-${user.id}`}>
                      <td colSpan={5} className="px-6 py-4 bg-amber-50 border-b border-amber-100">
                        <form onSubmit={handlePasswordChange} className="space-y-3">
                          <div className="flex items-center gap-2 mb-2">
                            <KeyRound className="w-4 h-4 text-amber-600" />
                            <span className="text-sm font-semibold text-amber-900">Change password for {user.username}</span>
                          </div>
                          {pwError && <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-700">{pwError}</div>}
                          <div className="grid grid-cols-2 gap-3 max-w-md">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">New Password</label>
                              <input type="password" value={pwForm.password} onChange={(e) => setPwForm({ ...pwForm, password: e.target.value })} required minLength={8}
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" placeholder="Min 8 characters" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Confirm Password</label>
                              <input type="password" value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} required
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" placeholder="Repeat password" />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button type="submit" disabled={pwSaving}
                              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium px-4 py-1.5 rounded-lg disabled:opacity-50">
                              {pwSaving ? "Changing..." : "Change Password"}
                            </button>
                            <button type="button" onClick={() => setPasswordUserId(null)} className="text-xs text-gray-600 px-3 py-1.5">Cancel</button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="text-center py-16 text-gray-400 text-sm">No users found. Create one above.</div>
          )}
        </div>
      )}
    </div>
  );
}
