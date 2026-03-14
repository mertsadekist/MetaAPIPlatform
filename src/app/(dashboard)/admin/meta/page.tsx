"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Connection {
  id: string;
  connectionName: string;
  authMode: string;
  status: string;
  tokenLastValidatedAt: string | null;
  permissionsJson: { scopes?: string[]; missingScopes?: string[] } | null;
  createdAt: string;
}

interface Client {
  id: string;
  displayName: string;
}

export default function MetaConnectionsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [validating, setValidating] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [tokenInfo, setTokenInfo] = useState<{ name?: string; scopes?: string[] } | null>(null);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    connectionName: "",
    authMode: "system_user",
    accessToken: "",
    metaAppId: "",
  });

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((d) => setClients(d.clients ?? []));
  }, []);

  useEffect(() => {
    if (!selectedClientId) return;
    setLoading(true);
    fetch(`/api/meta/connections?clientId=${selectedClientId}`)
      .then((r) => r.json())
      .then((d) => setConnections(d.connections ?? []))
      .finally(() => setLoading(false));
  }, [selectedClientId]);

  async function handleValidate() {
    if (!form.accessToken) return;
    setValidating(true);
    setTokenValid(null);
    setTokenInfo(null);
    const res = await fetch("/api/meta/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: form.accessToken }),
    });
    const data = await res.json();
    setValidating(false);
    setTokenValid(data.valid);
    if (data.valid) setTokenInfo({ name: data.name, scopes: data.scopes });
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!selectedClientId) {
      setError("Select a client first");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/meta/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, clientId: selectedClientId }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Connection failed");
      return;
    }
    setShowForm(false);
    setForm({ connectionName: "", authMode: "system_user", accessToken: "", metaAppId: "" });
    setTokenValid(null);
    setTokenInfo(null);
    // Refresh connections
    const refreshed = await fetch(`/api/meta/connections?clientId=${selectedClientId}`).then((r) => r.json());
    setConnections(refreshed.connections ?? []);
  }

  async function handleDiscover() {
    if (!selectedClientId) return;
    const res = await fetch("/api/meta/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: selectedClientId }),
    });
    const data = await res.json();
    if (res.ok) {
      alert(`Asset discovery queued. Job ID: ${data.jobId}`);
    } else {
      alert(`Error: ${data.error}`);
    }
  }

  async function handleDelete(connectionId: string) {
    if (!confirm("Delete this connection?")) return;
    const res = await fetch(
      `/api/meta/connections/${connectionId}?clientId=${selectedClientId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setConnections((prev) => prev.filter((c) => c.id !== connectionId));
    }
  }

  const statusColor: Record<string, string> = {
    active: "text-green-600",
    error: "text-red-600",
    disconnected: "text-gray-500",
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Meta Connections</h1>
        {selectedClientId && (
          <div className="flex gap-2">
            <button
              onClick={handleDiscover}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
            >
              Discover Assets
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              + Add Connection
            </button>
          </div>
        )}
      </div>

      {/* Client selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Select Client</label>
        <select
          value={selectedClientId}
          onChange={(e) => setSelectedClientId(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64"
        >
          <option value="">-- Choose a client --</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.displayName}
            </option>
          ))}
        </select>
      </div>

      {/* Add connection form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold text-lg">New Meta Connection</h2>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleConnect} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Connection Name</label>
                <input
                  type="text"
                  required
                  value={form.connectionName}
                  onChange={(e) => setForm({ ...form, connectionName: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
                  placeholder="e.g. Main Account"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Auth Mode</label>
                <select
                  value={form.authMode}
                  onChange={(e) => setForm({ ...form, authMode: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
                >
                  <option value="system_user">System User</option>
                  <option value="user_token">User Token</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  required
                  value={form.accessToken}
                  onChange={(e) => {
                    setForm({ ...form, accessToken: e.target.value });
                    setTokenValid(null);
                    setTokenInfo(null);
                  }}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1"
                  placeholder="EAA..."
                />
                <button
                  type="button"
                  onClick={handleValidate}
                  disabled={validating || !form.accessToken}
                  className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-50"
                >
                  {validating ? "Validating..." : "Validate"}
                </button>
              </div>
              {tokenValid === true && tokenInfo && (
                <p className="text-green-600 text-xs mt-1">
                  ✓ Valid — {tokenInfo.name} · Scopes: {tokenInfo.scopes?.join(", ")}
                </p>
              )}
              {tokenValid === false && (
                <p className="text-red-600 text-xs mt-1">✗ Invalid token</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meta App ID (optional)</label>
              <input
                type="text"
                value={form.metaAppId}
                onChange={(e) => setForm({ ...form, metaAppId: e.target.value })}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
                placeholder="123456789"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Connecting..." : "Save Connection"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Connections list */}
      {selectedClientId && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-gray-500 text-sm">Loading...</div>
          ) : connections.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              No Meta connections yet. Add one to start syncing data.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Mode</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Last Validated</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Scopes</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {connections.map((conn) => (
                  <tr key={conn.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{conn.connectionName}</td>
                    <td className="px-4 py-3 text-gray-600">{conn.authMode}</td>
                    <td className={`px-4 py-3 font-medium ${statusColor[conn.status] ?? ""}`}>
                      {conn.status}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {conn.tokenLastValidatedAt
                        ? new Date(conn.tokenLastValidatedAt).toLocaleDateString()
                        : "Never"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {(conn.permissionsJson?.scopes ?? []).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(conn.id)}
                        className="text-red-600 hover:text-red-800 text-xs"
                      >
                        Delete
                      </button>
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
