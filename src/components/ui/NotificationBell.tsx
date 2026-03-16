"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Bell, AlertTriangle, Info, Zap } from "lucide-react";

interface AlertItem {
  id: string;
  alertType: string;
  severity: string;
  title: string;
  message: string;
  createdAt: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-red-600",
  high:     "text-orange-500",
  medium:   "text-yellow-500",
  low:      "text-blue-500",
  info:     "text-gray-400",
};

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high:     "bg-orange-400",
  medium:   "bg-yellow-400",
  low:      "bg-blue-400",
  info:     "bg-gray-300",
};

function SeverityIcon({ severity }: { severity: string }) {
  const cls = `w-3.5 h-3.5 ${SEVERITY_COLORS[severity] ?? "text-gray-400"}`;
  if (severity === "critical" || severity === "high") return <AlertTriangle className={cls} />;
  if (severity === "medium") return <Zap className={cls} />;
  return <Info className={cls} />;
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationBell({ clientId }: { clientId: string }) {
  const [count, setCount] = useState(0);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await fetch(`/api/alerts/unread?clientId=${clientId}`);
    if (res.ok) {
      const d = await res.json();
      setCount(d.count ?? 0);
      setAlerts(d.alerts ?? []);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, [clientId]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-800">Active Alerts</span>
            {count > 0 && (
              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                {count} active
              </span>
            )}
          </div>

          {/* Alert list */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {alerts.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No active alerts</p>
              </div>
            ) : (
              alerts.map((a) => (
                <div key={a.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-2.5">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${SEVERITY_DOT[a.severity] ?? "bg-gray-300"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <SeverityIcon severity={a.severity} />
                        <span className="text-xs font-semibold text-gray-800 truncate">{a.title}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.message}</p>
                      <span className="text-xs text-gray-400">{timeAgo(a.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
            <Link
              href={`/clients/${clientId}/alerts`}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              onClick={() => setOpen(false)}
            >
              View all alerts →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
