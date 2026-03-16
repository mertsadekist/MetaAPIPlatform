"use client";

import { useEffect, useState } from "react";
import {
  Settings,
  Mail,
  Bot,
  MessageSquare,
  Globe,
  CheckCircle,
  XCircle,
  RefreshCw,
  Play,
  Info,
  Send,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SettingsData {
  config: {
    meta: {
      appIdConfigured: boolean;
      appSecretConfigured: boolean;
      graphApiVersion: string;
      adLibraryEnabled: boolean;
      adLibraryCountries: string;
    };
    email: {
      smtpHost: string | null;
      smtpPort: string;
      smtpUserConfigured: boolean;
      smtpPasswordConfigured: boolean;
      fromEmail: string | null;
      fromName: string | null;
    };
    ai: {
      provider: string;
      apiKeyConfigured: boolean;
      textModel: string;
      visionModel: string;
    };
    whatsapp: {
      provider: string;
      twilioConfigured: boolean;
      fromPhone: string | null;
    };
    telegram: {
      enabled: boolean;
      botConfigured: boolean;
    };
    app: {
      appUrl: string;
      sharedLinkExpiryDays: number;
      nodeEnv: string;
      logLevel: string;
    };
  };
  stats: {
    clientCount: number;
    userCount: number;
    syncJobQueued: number;
    syncJobRunning: number;
    totalRuns: number;
  };
  recentRuns: Array<{
    jobType: string;
    status: string;
    startedAt: string;
    durationMs: number | null;
  }>;
}

interface Client {
  id: string;
  displayName: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full ${
        ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
      }`}
    >
      {ok ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {label}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <div className="text-sm font-medium text-gray-800">{children}</div>
    </div>
  );
}

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 bg-gray-50">
        <Icon className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-semibold text-gray-700">{title}</span>
      </div>
      <div className="px-5 py-2">{children}</div>
    </div>
  );
}

const JOB_LABELS: Record<string, string> = {
  asset_discovery: "Asset Discovery",
  hourly_sync: "Hourly Sync",
  daily_reconcile: "Daily Reconcile",
  budget_pacing: "Budget Pacing",
  creative_fatigue: "Creative Fatigue",
  creative_analysis: "Creative Analysis",
  alert_dispatch: "Alert Dispatch",
};

const STATUS_COLORS: Record<string, string> = {
  succeeded: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-600",
  running: "bg-blue-100 text-blue-700",
  queued: "bg-yellow-100 text-yellow-700",
};

function fmtDur(ms: number | null) {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview", label: "Overview", icon: Info },
  { id: "email", label: "Email / SMTP", icon: Mail },
  { id: "integrations", label: "Integrations", icon: Globe },
  { id: "scheduler", label: "Scheduler", icon: RefreshCw },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminSettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("overview");

  // Email test state
  const [testEmail, setTestEmail] = useState("");
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testEmailMsg, setTestEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Trigger job state
  const [triggerJobType, setTriggerJobType] = useState("alert_dispatch");
  const [triggerClientId, setTriggerClientId] = useState("");
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [settingsRes, clientsRes] = await Promise.all([
        fetch("/api/admin/settings"),
        fetch("/api/clients?limit=200"),
      ]);
      if (settingsRes.ok) setData(await settingsRes.json());
      if (clientsRes.ok) {
        const d = await clientsRes.json();
        setClients(d.clients ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function sendTestEmail() {
    if (!testEmail.trim()) return;
    setTestEmailLoading(true);
    setTestEmailMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test_email", to: testEmail.trim() }),
      });
      const d = await res.json();
      setTestEmailMsg({ ok: res.ok, text: d.message ?? d.error ?? "Done" });
    } finally {
      setTestEmailLoading(false);
    }
  }

  async function triggerJob() {
    setTriggerLoading(true);
    setTriggerMsg(null);
    const globalJobs = ["alert_dispatch"];
    const body: Record<string, string> = { jobType: triggerJobType };
    if (!globalJobs.includes(triggerJobType)) body.clientId = triggerClientId;

    try {
      const res = await fetch("/api/admin/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      setTriggerMsg({ ok: res.ok, text: res.ok ? `Job queued: ${d.job?.id}` : d.error ?? "Failed" });
      if (res.ok) load();
    } finally {
      setTriggerLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-red-600 font-medium">Failed to load settings.</div>
    );
  }

  const { config, stats, recentRuns } = data;

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="w-6 h-6" />
          System Settings
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Runtime configuration status — edit values in your{" "}
          <code className="bg-gray-100 px-1 rounded text-xs">.env</code> file.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Overview ── */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Active Clients", value: stats.clientCount },
              { label: "Active Users", value: stats.userCount },
              { label: "Queued Jobs", value: stats.syncJobQueued },
              { label: "Running Jobs", value: stats.syncJobRunning },
              { label: "Total Runs", value: stats.totalRuns },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">{s.value}</div>
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card title="Application" icon={Globe}>
              <Row label="App URL">{config.app.appUrl}</Row>
              <Row label="Environment">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  config.app.nodeEnv === "production"
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}>
                  {config.app.nodeEnv}
                </span>
              </Row>
              <Row label="Log Level">{config.app.logLevel}</Row>
              <Row label="Shared Link Expiry">{config.app.sharedLinkExpiryDays} days</Row>
            </Card>

            <Card title="Meta API" icon={Globe}>
              <Row label="App ID">
                <StatusBadge ok={config.meta.appIdConfigured} label={config.meta.appIdConfigured ? "Configured" : "Missing"} />
              </Row>
              <Row label="App Secret">
                <StatusBadge ok={config.meta.appSecretConfigured} label={config.meta.appSecretConfigured ? "Configured" : "Missing"} />
              </Row>
              <Row label="Graph API Version">{config.meta.graphApiVersion}</Row>
              <Row label="Ad Library">
                <StatusBadge ok={config.meta.adLibraryEnabled} label={config.meta.adLibraryEnabled ? "Enabled" : "Disabled"} />
              </Row>
              <Row label="Countries">{config.meta.adLibraryCountries}</Row>
            </Card>

            <Card title="AI Provider" icon={Bot}>
              <Row label="Provider">{config.ai.provider}</Row>
              <Row label="API Key">
                <StatusBadge ok={config.ai.apiKeyConfigured} label={config.ai.apiKeyConfigured ? "Configured" : "Missing"} />
              </Row>
              <Row label="Text Model">{config.ai.textModel}</Row>
              <Row label="Vision Model">{config.ai.visionModel}</Row>
            </Card>

            <Card title="Notifications" icon={MessageSquare}>
              <Row label="SMTP Host">{config.email.smtpHost ?? <span className="text-gray-400 italic">Not set</span>}</Row>
              <Row label="SMTP Credentials">
                <StatusBadge
                  ok={config.email.smtpUserConfigured && config.email.smtpPasswordConfigured}
                  label={config.email.smtpUserConfigured && config.email.smtpPasswordConfigured ? "Configured" : "Incomplete"}
                />
              </Row>
              <Row label="WhatsApp (Twilio)">
                <StatusBadge ok={config.whatsapp.twilioConfigured} label={config.whatsapp.twilioConfigured ? "Configured" : "Missing"} />
              </Row>
              <Row label="Telegram">
                <StatusBadge
                  ok={config.telegram.enabled && config.telegram.botConfigured}
                  label={config.telegram.enabled && config.telegram.botConfigured ? "Active" : config.telegram.enabled ? "No Token" : "Disabled"}
                />
              </Row>
            </Card>
          </div>

          {/* Recent runs */}
          {recentRuns.length > 0 && (
            <Card title="Recent Sync Runs (last 20)" icon={RefreshCw}>
              <div className="-mx-5">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-5 py-2 text-left font-medium text-gray-500">Job</th>
                      <th className="px-5 py-2 text-left font-medium text-gray-500">Status</th>
                      <th className="px-5 py-2 text-left font-medium text-gray-500">Duration</th>
                      <th className="px-5 py-2 text-left font-medium text-gray-500">Started</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {recentRuns.map((r, i) => (
                      <tr key={i}>
                        <td className="px-5 py-2.5 font-medium text-gray-800">
                          {JOB_LABELS[r.jobType] ?? r.jobType}
                        </td>
                        <td className="px-5 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-5 py-2.5 text-gray-600">{fmtDur(r.durationMs)}</td>
                        <td className="px-5 py-2.5 text-gray-500 text-xs">
                          {new Date(r.startedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── TAB: Email ── */}
      {tab === "email" && (
        <div className="space-y-6">
          <Card title="SMTP Configuration" icon={Mail}>
            <Row label="SMTP Host">
              {config.email.smtpHost ?? <span className="text-gray-400 italic">Not configured</span>}
            </Row>
            <Row label="SMTP Port">{config.email.smtpPort}</Row>
            <Row label="SMTP User">
              <StatusBadge ok={config.email.smtpUserConfigured} label={config.email.smtpUserConfigured ? "Set" : "Missing"} />
            </Row>
            <Row label="SMTP Password">
              <StatusBadge ok={config.email.smtpPasswordConfigured} label={config.email.smtpPasswordConfigured ? "Set" : "Missing"} />
            </Row>
            <Row label="From Email">
              {config.email.fromEmail ?? <span className="text-gray-400 italic">Not set</span>}
            </Row>
            <Row label="From Name">
              {config.email.fromName ?? <span className="text-gray-400 italic">Not set</span>}
            </Row>
          </Card>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Send className="w-4 h-4" />
              Send Test Email
            </h3>
            <div className="flex gap-3">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="recipient@example.com"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={sendTestEmail}
                disabled={testEmailLoading || !testEmail.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {testEmailLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Send Test
              </button>
            </div>
            {testEmailMsg && (
              <p className={`mt-3 text-sm ${testEmailMsg.ok ? "text-green-600" : "text-red-600"}`}>
                {testEmailMsg.ok ? "✓" : "✗"} {testEmailMsg.text}
              </p>
            )}
            {!config.email.smtpHost && (
              <p className="mt-3 text-sm text-amber-600 flex items-center gap-1">
                <Info className="w-3.5 h-3.5" />
                SMTP is not configured. Set{" "}
                <code className="bg-amber-50 px-1 rounded text-xs">SMTP_HOST</code>,{" "}
                <code className="bg-amber-50 px-1 rounded text-xs">SMTP_USER</code>, and{" "}
                <code className="bg-amber-50 px-1 rounded text-xs">SMTP_PASSWORD</code> in your .env.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: Integrations ── */}
      {tab === "integrations" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card title="Meta Marketing API" icon={Globe}>
              <Row label="App ID">
                <StatusBadge ok={config.meta.appIdConfigured} label={config.meta.appIdConfigured ? "Configured" : "Missing"} />
              </Row>
              <Row label="App Secret">
                <StatusBadge ok={config.meta.appSecretConfigured} label={config.meta.appSecretConfigured ? "Configured" : "Missing"} />
              </Row>
              <Row label="API Version">{config.meta.graphApiVersion}</Row>
              <Row label="Ad Library Enabled">
                <StatusBadge ok={config.meta.adLibraryEnabled} label={config.meta.adLibraryEnabled ? "Yes" : "No"} />
              </Row>
              <Row label="Default Countries">{config.meta.adLibraryCountries}</Row>
            </Card>

            <Card title="AI Provider" icon={Bot}>
              <Row label="Provider">{config.ai.provider}</Row>
              <Row label="API Key">
                <StatusBadge ok={config.ai.apiKeyConfigured} label={config.ai.apiKeyConfigured ? "Configured" : "Missing"} />
              </Row>
              <Row label="Text Model">{config.ai.textModel}</Row>
              <Row label="Vision Model">{config.ai.visionModel}</Row>
            </Card>

            <Card title="WhatsApp (Twilio)" icon={MessageSquare}>
              <Row label="Provider">{config.whatsapp.provider}</Row>
              <Row label="Credentials">
                <StatusBadge ok={config.whatsapp.twilioConfigured} label={config.whatsapp.twilioConfigured ? "Configured" : "Missing"} />
              </Row>
              <Row label="From Phone">
                {config.whatsapp.fromPhone ?? <span className="text-gray-400 italic">Not set</span>}
              </Row>
            </Card>

            <Card title="Telegram" icon={MessageSquare}>
              <Row label="Enabled">
                <StatusBadge ok={config.telegram.enabled} label={config.telegram.enabled ? "Yes" : "No"} />
              </Row>
              <Row label="Bot Token">
                <StatusBadge ok={config.telegram.botConfigured} label={config.telegram.botConfigured ? "Configured" : "Missing"} />
              </Row>
            </Card>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
            <p className="font-medium mb-1">How to configure integrations</p>
            <p>
              All integration credentials are read from environment variables. Edit your{" "}
              <code className="bg-blue-100 px-1 rounded text-xs">.env</code> file and restart the
              server to apply changes. Never expose API keys in the UI.
            </p>
          </div>
        </div>
      )}

      {/* ── TAB: Scheduler ── */}
      {tab === "scheduler" && (
        <div className="space-y-6">
          {/* Trigger Manual Job */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Play className="w-4 h-4" />
              Trigger Manual Job
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Job Type</label>
                <select
                  value={triggerJobType}
                  onChange={(e) => setTriggerJobType(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(JOB_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>

              {triggerJobType !== "alert_dispatch" && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Client</label>
                  <select
                    value={triggerClientId}
                    onChange={(e) => setTriggerClientId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Select client —</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.displayName}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-end">
                <button
                  onClick={triggerJob}
                  disabled={
                    triggerLoading ||
                    (triggerJobType !== "alert_dispatch" && !triggerClientId)
                  }
                  className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {triggerLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Queue Job
                </button>
              </div>
            </div>

            {triggerMsg && (
              <p className={`mt-3 text-sm ${triggerMsg.ok ? "text-green-600" : "text-red-600"}`}>
                {triggerMsg.ok ? "✓" : "✗"} {triggerMsg.text}
              </p>
            )}
          </div>

          {/* Job Schedule Reference */}
          <Card title="Job Schedule Reference" icon={RefreshCw}>
            {[
              { type: "asset_discovery", interval: "Every 6 hours", scope: "Per Client" },
              { type: "hourly_sync", interval: "Every 1 hour", scope: "Per Client" },
              { type: "daily_reconcile", interval: "Every 24 hours", scope: "Per Client" },
              { type: "budget_pacing", interval: "Every 1 hour", scope: "Per Client" },
              { type: "creative_fatigue", interval: "Every 24 hours", scope: "Per Client" },
              { type: "creative_analysis", interval: "Every 24 hours", scope: "Per Client" },
              { type: "alert_dispatch", interval: "Every 15 minutes", scope: "Global" },
            ].map((j) => (
              <div key={j.type} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                <div>
                  <div className="text-sm font-medium text-gray-800">{JOB_LABELS[j.type]}</div>
                  <div className="text-xs text-gray-400">{j.type}</div>
                </div>
                <div className="flex items-center gap-2 text-right">
                  <span className="text-sm text-gray-600">{j.interval}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    j.scope === "Global"
                      ? "bg-purple-100 text-purple-700"
                      : "bg-blue-100 text-blue-700"
                  }`}>
                    {j.scope}
                  </span>
                </div>
              </div>
            ))}
          </Card>

          {/* Recent runs summary */}
          {recentRuns.length > 0 && (
            <Card title="Recent Activity" icon={RefreshCw}>
              <div className="-mx-5">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-5 py-2 text-left font-medium text-gray-500">Job</th>
                      <th className="px-5 py-2 text-left font-medium text-gray-500">Status</th>
                      <th className="px-5 py-2 text-left font-medium text-gray-500">Duration</th>
                      <th className="px-5 py-2 text-left font-medium text-gray-500">Started</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {recentRuns.slice(0, 10).map((r, i) => (
                      <tr key={i}>
                        <td className="px-5 py-2.5 font-medium text-gray-800">
                          {JOB_LABELS[r.jobType] ?? r.jobType}
                        </td>
                        <td className="px-5 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-5 py-2.5 text-gray-600">{fmtDur(r.durationMs)}</td>
                        <td className="px-5 py-2.5 text-gray-500 text-xs">
                          {new Date(r.startedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
