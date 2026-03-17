"use client";

import { useState, useEffect, useCallback } from "react";
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

interface AdAccount {
  id: string;
  metaAdAccountId: string;
  name: string;
  currency: string;
  timezone: string;
  isActive: boolean;
  effectiveStatus: string | null;
  lastSyncedAt: string | null;
  businessManager: { id: string; name: string; metaBusinessId: string } | null;
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
  const [oauthConnecting, setOauthConnecting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Ad accounts state
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [adAccountsTotal, setAdAccountsTotal] = useState(0);
  const [adAccountsActive, setAdAccountsActive] = useState(0);
  const [adAccountsLoading, setAdAccountsLoading] = useState(false);
  const [showAdAccounts, setShowAdAccounts] = useState(false);

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

  const loadConnections = useCallback(async (clientId: string) => {
    if (!clientId) return;
    setLoading(true);
    const d = await fetch(`/api/meta/connections?clientId=${clientId}`).then((r) => r.json());
    setConnections(d.connections ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!selectedClientId) return;
    loadConnections(selectedClientId);
  }, [selectedClientId, loadConnections]);

  async function loadAdAccounts() {
    if (!selectedClientId) return;
    setAdAccountsLoading(true);
    setShowAdAccounts(true);
    const res = await fetch(`/api/admin/ad-accounts?clientId=${selectedClientId}`);
    const data = await res.json();
    setAdAccounts(data.adAccounts ?? []);
    setAdAccountsTotal(data.total ?? 0);
    setAdAccountsActive(data.active ?? 0);
    setAdAccountsLoading(false);
  }

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
    await loadConnections(selectedClientId);
  }

  async function handleOAuthConnect() {
    if (!selectedClientId) {
      setError("Select a client first");
      return;
    }
    setError("");
    setSuccessMsg("");
    setOauthConnecting(true);

    try {
      const res = await fetch(`/api/meta/oauth?clientId=${selectedClientId}`);
      const data = await res.json();

      if (!res.ok || !data.url) {
        setError(data.error ?? "Failed to generate OAuth URL");
        setOauthConnecting(false);
        return;
      }

      const popup = window.open(
        data.url,
        "fbOAuth",
        "width=640,height=720,scrollbars=yes,resizable=yes,top=100,left=200"
      );

      if (!popup) {
        setError("Popup was blocked. Please allow popups for this site.");
        setOauthConnecting(false);
        return;
      }

      const handler = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type !== "META_OAUTH_RESULT") return;

        window.removeEventListener("message", handler);
        setOauthConnecting(false);

        if (event.data.success) {
          setSuccessMsg("Facebook account connected successfully!");
          loadConnections(selectedClientId);
          loadAdAccounts();
        } else {
          setError(event.data.error ?? "Facebook connection failed");
        }
      };

      window.addEventListener("message", handler);

      // Fallback: stop spinner if popup is closed without sending a message
      const pollClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollClosed);
          setOauthConnecting(false);
          window.removeEventListener("message", handler);
        }
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
      setOauthConnecting(false);
    }
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
      loadAdAccounts();
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

  const statusBadge: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    error: "bg-red-100 text-red-600",
    disconnected: "bg-gray-100 text-gray-500",
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Meta Connections</h1>
        {selectedClientId && (
          <div className="flex flex-wrap gap-2">
            {/* Facebook OAuth button */}
            <button
              onClick={handleOAuthConnect}
              disabled={oauthConnecting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60 transition-colors"
              style={{ backgroundColor: oauthConnecting ? "#5b7fba" : "#1877F2" }}
            >
              {/* Facebook icon */}
              <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              {oauthConnecting ? "Connecting…" : "Connect with Facebook"}
            </button>

            <button
              onClick={handleDiscover}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
            >
              Discover Assets
            </button>

            <button
              onClick={loadAdAccounts}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
            >
              View Ad Accounts
            </button>

            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              + Manual Token
            </button>
          </div>
        )}
      </div>

      {/* Status messages */}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <span>✓</span> {successMsg}
          <button onClick={() => setSuccessMsg("")} className="ml-auto text-green-500 hover:text-green-700">✕</button>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <span>✗</span> {error}
          <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Client selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Select Client</label>
        <select
          value={selectedClientId}
          onChange={(e) => {
            setSelectedClientId(e.target.value);
            setShowAdAccounts(false);
            setAdAccounts([]);
            setSuccessMsg("");
            setError("");
          }}
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

      {/* Manual token form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold text-lg">New Meta Connection (Manual Token)</h2>
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
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">Meta Connections</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-500 text-sm">Loading...</div>
          ) : connections.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              No Meta connections yet. Use <strong>Connect with Facebook</strong> or add a token manually.
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
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[conn.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {conn.status}
                      </span>
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

      {/* Ad Accounts section */}
      {showAdAccounts && selectedClientId && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">Discovered Ad Accounts</h2>
              {!adAccountsLoading && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {adAccountsTotal} total · {adAccountsActive} active
                </p>
              )}
            </div>
            <button
              onClick={loadAdAccounts}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Refresh
            </button>
          </div>

          {adAccountsLoading ? (
            <div className="p-8 text-center">
              <div className="inline-block w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500 mt-2">Loading ad accounts…</p>
            </div>
          ) : adAccounts.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              No ad accounts discovered yet.
              <br />
              <span className="text-xs">Click <strong>Discover Assets</strong> to sync from Meta.</span>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Ad Account ID</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Account Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Business Manager</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Currency</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Last Synced</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {adAccounts.map((account) => (
                  <tr key={account.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">
                      act_{account.metaAdAccountId}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{account.name}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {account.businessManager?.name ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{account.currency}</td>
                    <td className="px-4 py-3">
                      {account.isActive ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {account.lastSyncedAt
                        ? new Date(account.lastSyncedAt).toLocaleString()
                        : "Never"}
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
