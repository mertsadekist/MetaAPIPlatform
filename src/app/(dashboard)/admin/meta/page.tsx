"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Link2,
  RefreshCw,
  Plus,
  Trash2,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  LayoutGrid,
  AlertTriangle,
  Info,
} from "lucide-react";

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

  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [adAccountsTotal, setAdAccountsTotal] = useState(0);
  const [adAccountsActive, setAdAccountsActive] = useState(0);
  const [adAccountsLoading, setAdAccountsLoading] = useState(false);
  const [showAdAccounts, setShowAdAccounts] = useState(false);
  const [discoverLoading, setDiscoverLoading] = useState(false);

  const [form, setForm] = useState({
    connectionName: "",
    authMode: "system_user",
    accessToken: "",
    metaAppId: "",
  });

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((d) => setClients(Array.isArray(d) ? d : (d.clients ?? [])));
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
    if (!selectedClientId) { setError("Select a client first"); return; }
    setLoading(true);
    const res = await fetch("/api/meta/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, clientId: selectedClientId }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Connection failed"); return; }
    setShowForm(false);
    setForm({ connectionName: "", authMode: "system_user", accessToken: "", metaAppId: "" });
    setTokenValid(null);
    setTokenInfo(null);
    await loadConnections(selectedClientId);
  }

  async function handleOAuthConnect() {
    if (!selectedClientId) { setError("Select a client first"); return; }
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
      const popup = window.open(data.url, "fbOAuth", "width=640,height=720,scrollbars=yes,resizable=yes,top=100,left=200");
      if (!popup) { setError("Popup was blocked. Please allow popups for this site."); setOauthConnecting(false); return; }
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
      const pollClosed = setInterval(() => {
        if (popup.closed) { clearInterval(pollClosed); setOauthConnecting(false); window.removeEventListener("message", handler); }
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
      setOauthConnecting(false);
    }
  }

  async function handleDiscover() {
    if (!selectedClientId) return;
    setDiscoverLoading(true);
    const res = await fetch("/api/meta/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: selectedClientId }),
    });
    const data = await res.json();
    setDiscoverLoading(false);
    if (res.ok) {
      setSuccessMsg(`Asset discovery queued (Job ID: ${data.jobId}). This may take a few minutes.`);
      setTimeout(() => loadAdAccounts(), 3000);
    } else {
      setError(data.error ?? "Discovery failed");
    }
  }

  async function handleDelete(connectionId: string) {
    if (!confirm("Delete this connection? This will stop data sync for this account.")) return;
    const res = await fetch(`/api/meta/connections/${connectionId}?clientId=${selectedClientId}`, { method: "DELETE" });
    if (res.ok) setConnections((prev) => prev.filter((c) => c.id !== connectionId));
  }

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const activeConnections = connections.filter((c) => c.status === "active").length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
              <Link2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Meta Connections</h1>
              <p className="text-sm text-gray-500">Connect clients to their Facebook & Instagram ad accounts</p>
            </div>
          </div>

          {/* Stats strip when client selected */}
          {selectedClientId && !loading && (
            <div className="flex items-center gap-3">
              <div className="text-center px-4 py-2 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-xs text-gray-500 font-medium">Connections</p>
                <p className="text-lg font-bold text-gray-900">{connections.length}</p>
              </div>
              <div className="text-center px-4 py-2 bg-green-50 rounded-xl border border-green-200">
                <p className="text-xs text-green-600 font-medium">Active</p>
                <p className="text-lg font-bold text-green-700">{activeConnections}</p>
              </div>
              {adAccountsTotal > 0 && (
                <div className="text-center px-4 py-2 bg-purple-50 rounded-xl border border-purple-200">
                  <p className="text-xs text-purple-600 font-medium">Ad Accounts</p>
                  <p className="text-lg font-bold text-purple-700">{adAccountsTotal}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-6 space-y-6">

        {/* Alerts */}
        {successMsg && (
          <div className="flex items-start gap-3 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl text-sm">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-green-600" />
            <span className="flex-1">{successMsg}</span>
            <button onClick={() => setSuccessMsg("")} className="text-green-500 hover:text-green-700 font-medium">✕</button>
          </div>
        )}
        {error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm">
            <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError("")} className="text-red-400 hover:text-red-600 font-medium">✕</button>
          </div>
        )}

        {/* Client selector + action buttons */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex-1 max-w-xs">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select Client
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => {
                  setSelectedClientId(e.target.value);
                  setShowAdAccounts(false);
                  setAdAccounts([]);
                  setSuccessMsg("");
                  setError("");
                }}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
              >
                <option value="">-- Choose a client --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.displayName}</option>
                ))}
              </select>
            </div>

            {selectedClientId && (
              <div className="flex flex-wrap gap-2">
                {/* Facebook OAuth */}
                <button
                  onClick={handleOAuthConnect}
                  disabled={oauthConnecting}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                  style={{ backgroundColor: "#1877F2" }}
                >
                  <svg className="w-4 h-4 fill-white shrink-0" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  {oauthConnecting ? "Connecting…" : "Connect with Facebook"}
                </button>

                <button
                  onClick={handleDiscover}
                  disabled={discoverLoading || connections.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  <Layers className="w-4 h-4" />
                  {discoverLoading ? "Queuing…" : "Discover Assets"}
                </button>

                <button
                  onClick={loadAdAccounts}
                  disabled={adAccountsLoading || connections.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  <LayoutGrid className="w-4 h-4" />
                  Ad Accounts
                </button>

                <button
                  onClick={() => setShowForm((v) => !v)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-semibold transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Manual Token
                </button>
              </div>
            )}
          </div>

          {/* Hint when no client selected */}
          {!selectedClientId && (
            <p className="mt-3 text-xs text-gray-400 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              Select a client above to manage their Meta ad account connections
            </p>
          )}
        </div>

        {/* ── HOW-TO GUIDE (shown only when no client is selected) ── */}
        {!selectedClientId && (
          <div className="space-y-4">
            {/* Steps */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">How It Works</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Follow these 4 steps to connect a client and start syncing their Meta advertising data
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
                {[
                  {
                    step: "01",
                    icon: <ChevronRight className="w-5 h-5 text-blue-600" />,
                    bg: "bg-blue-50",
                    border: "border-blue-100",
                    title: "Select Client",
                    desc: "Choose the client you want to link. Each client can have multiple Meta connections (e.g. different ad accounts).",
                  },
                  {
                    step: "02",
                    icon: (
                      <svg className="w-5 h-5 fill-[#1877F2]" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                      </svg>
                    ),
                    bg: "bg-blue-50",
                    border: "border-blue-100",
                    title: "Connect Facebook",
                    desc: "Click 'Connect with Facebook' — a popup opens, you log in and grant ads_read, leads_retrieval, and pages_show_list permissions.",
                  },
                  {
                    step: "03",
                    icon: <Layers className="w-5 h-5 text-emerald-600" />,
                    bg: "bg-emerald-50",
                    border: "border-emerald-100",
                    title: "Discover Assets",
                    desc: "Click 'Discover Assets' to scan the linked Facebook account and import all ad accounts, campaigns, ad sets, ads, and creatives.",
                  },
                  {
                    step: "04",
                    icon: <LayoutGrid className="w-5 h-5 text-violet-600" />,
                    bg: "bg-violet-50",
                    border: "border-violet-100",
                    title: "Verify & Done",
                    desc: "Click 'Ad Accounts' to confirm what was imported. The platform now syncs data automatically every hour in the background.",
                  },
                ].map((item) => (
                  <div key={item.step} className="p-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl ${item.bg} border ${item.border} flex items-center justify-center shrink-0`}>
                        {item.icon}
                      </div>
                      <span className="text-xs font-bold text-gray-400 tracking-widest">STEP {item.step}</span>
                    </div>
                    <p className="text-sm font-bold text-gray-900">{item.title}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Auth method comparison */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-blue-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-bold rounded-full">RECOMMENDED</span>
                  <span className="text-sm font-bold text-gray-900">Facebook OAuth</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed mb-3">
                  Opens a Facebook login popup. The platform automatically retrieves a long-lived User Token that lasts ~60 days and auto-refreshes.
                  Best for agencies managing client accounts.
                </p>
                <ul className="space-y-1">
                  {["No manual token copy-paste", "Auto token refresh", "Works with Business Manager", "Supports lead ads & pages"].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-xs text-gray-600">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs font-bold rounded-full">ADVANCED</span>
                  <span className="text-sm font-bold text-gray-900">Manual System User Token</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed mb-3">
                  Paste a System User access token generated in Business Manager. Never expires. Best for server-to-server integrations where you control the token lifecycle.
                </p>
                <ul className="space-y-1">
                  {["Non-expiring token", "Full API scope control", "Business Manager setup required", "Token generated manually"].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-xs text-gray-600">
                      <CheckCircle2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Prerequisites warning */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-4">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-900 mb-1">Prerequisites — Meta App Setup</p>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Before connecting, ensure <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono">META_APP_ID</code> and{" "}
                  <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono">META_APP_SECRET</code> are set in your environment variables.
                  Your Meta App must have the <strong>Marketing API</strong> and <strong>Facebook Login</strong> products enabled.
                  The OAuth redirect URI{" "}
                  <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono">{"{NEXT_PUBLIC_APP_URL}"}/api/meta/oauth/callback</code>{" "}
                  must be whitelisted under <strong>Facebook Login → Settings → Valid OAuth Redirect URIs</strong> in the Meta Developer Console.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── MANUAL TOKEN FORM ── */}
        {showForm && selectedClientId && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="text-sm font-bold text-gray-900">New Connection — Manual Token</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                For {selectedClient?.displayName ?? "selected client"} · System User or User Token
              </p>
            </div>
            <form onSubmit={handleConnect} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Connection Name *</label>
                  <input
                    type="text"
                    required
                    value={form.connectionName}
                    onChange={(e) => setForm({ ...form, connectionName: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g. Main Ad Account"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Auth Mode *</label>
                  <select
                    value={form.authMode}
                    onChange={(e) => setForm({ ...form, authMode: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="system_user">System User</option>
                    <option value="user_token">User Token</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Access Token *</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    required
                    value={form.accessToken}
                    onChange={(e) => { setForm({ ...form, accessToken: e.target.value }); setTokenValid(null); setTokenInfo(null); }}
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="EAAxxxxxxxxxxxxx..."
                  />
                  <button
                    type="button"
                    onClick={handleValidate}
                    disabled={validating || !form.accessToken}
                    className="px-4 py-2.5 bg-gray-100 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    {validating ? "Checking…" : "Validate Token"}
                  </button>
                </div>
                {tokenValid === true && tokenInfo && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Valid — <strong>{tokenInfo.name}</strong> · Scopes: {tokenInfo.scopes?.join(", ")}
                  </div>
                )}
                {tokenValid === false && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                    <XCircle className="w-3.5 h-3.5" />
                    Invalid token — check it and try again
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Meta App ID <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.metaAppId}
                  onChange={(e) => setForm({ ...form, metaAppId: e.target.value })}
                  className="w-full sm:w-64 px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="123456789012345"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
                >
                  {loading ? "Saving…" : "Save Connection"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── CONNECTIONS TABLE ── */}
        {selectedClientId && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-gray-900">
                  Meta Connections
                  {selectedClient && <span className="font-normal text-gray-500"> · {selectedClient.displayName}</span>}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {connections.length === 0 ? "No connections yet" : `${connections.length} connection${connections.length !== 1 ? "s" : ""}, ${activeConnections} active`}
                </p>
              </div>
              <button
                onClick={() => loadConnections(selectedClientId)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-400">Loading connections…</p>
              </div>
            ) : connections.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                  <Link2 className="w-6 h-6 text-gray-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">No Meta connections yet</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Click <strong>Connect with Facebook</strong> above to link this client&apos;s ad account,<br />
                    or use <strong>Manual Token</strong> if you have a System User token.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Auth Mode</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Validated</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Scopes</th>
                      <th className="px-6 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {connections.map((conn) => (
                      <tr key={conn.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-semibold text-gray-900">{conn.connectionName}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700">
                            {conn.authMode === "system_user" ? "System User" : "User Token"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {conn.status === "active" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-green-100 text-green-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Active
                            </span>
                          ) : conn.status === "error" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-100 text-red-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Error
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" /> Disconnected
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                            <Clock className="w-3.5 h-3.5" />
                            {conn.tokenLastValidatedAt
                              ? new Date(conn.tokenLastValidatedAt).toLocaleDateString()
                              : "Never"}
                          </span>
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                          <span className="text-xs text-gray-500 truncate block">
                            {(conn.permissionsJson?.scopes ?? []).join(", ") || "—"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleDelete(conn.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete connection"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── AD ACCOUNTS TABLE ── */}
        {showAdAccounts && selectedClientId && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-gray-900">Discovered Ad Accounts</h2>
                {!adAccountsLoading && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {adAccountsTotal} total · {adAccountsActive} active
                  </p>
                )}
              </div>
              <button
                onClick={loadAdAccounts}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>

            {adAccountsLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-400">Loading ad accounts…</p>
              </div>
            ) : adAccounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
                <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center">
                  <LayoutGrid className="w-6 h-6 text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">No ad accounts found</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Click <strong>Discover Assets</strong> to import ad accounts from Meta.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ad Account ID</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Business Manager</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Currency</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Synced</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {adAccounts.map((account) => (
                      <tr key={account.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <code className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded-lg">
                            act_{account.metaAdAccountId}
                          </code>
                        </td>
                        <td className="px-6 py-4 font-semibold text-gray-900">{account.name}</td>
                        <td className="px-6 py-4 text-xs text-gray-500">
                          {account.businessManager?.name ?? <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded-lg">
                            {account.currency}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {account.isActive ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-green-100 text-green-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-500">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" /> Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-400">
                          {account.lastSyncedAt
                            ? new Date(account.lastSyncedAt).toLocaleString()
                            : <span className="text-gray-300">Never synced</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
