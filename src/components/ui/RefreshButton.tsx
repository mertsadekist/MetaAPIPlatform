"use client";

import { useState, useEffect } from "react";
import { RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

type SyncState = "idle" | "syncing" | "success" | "error";

interface RefreshButtonProps {
  clientId: string;
}

export function RefreshButton({ clientId }: RefreshButtonProps) {
  const [state, setState] = useState<SyncState>("idle");
  const [message, setMessage] = useState<string>("");
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  // Load last synced time from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(`lastSync_${clientId}`);
    if (stored) setLastSynced(stored);
  }, [clientId]);

  async function handleRefresh() {
    if (state === "syncing") return;
    setState("syncing");
    setMessage("");

    try {
      // Run metrics sync + asset discovery in parallel for complete refresh
      const [syncRes, discoverRes] = await Promise.allSettled([
        fetch(`/api/clients/${clientId}/sync`,     { method: "POST" }).then((r) => r.json()),
        fetch(`/api/clients/${clientId}/discover`, { method: "POST" }).then((r) => r.json()),
      ]);

      const syncData     = syncRes.status     === "fulfilled" ? syncRes.value     : null;
      const discoverData = discoverRes.status === "fulfilled" ? discoverRes.value : null;
      const snapshotsCount = syncData?.itemsProcessed    ?? 0;
      const adsCount       = discoverData?.itemsProcessed ?? 0;

      const now = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      setLastSynced(now);
      localStorage.setItem(`lastSync_${clientId}`, now);
      setMessage(`${snapshotsCount} metrics · ${adsCount} ads`);
      setState("success");
      // Reload page after 1.5s so all sections reflect new data
      setTimeout(() => { window.location.reload(); }, 1500);
    } catch {
      setMessage("Network error");
      setState("error");
      setTimeout(() => setState("idle"), 4000);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Last synced label */}
      {lastSynced && state === "idle" && (
        <span className="text-xs text-gray-400 hidden sm:block">
          Updated {lastSynced}
        </span>
      )}

      {/* Status message */}
      {state === "success" && (
        <span className="text-xs text-green-600 font-medium hidden sm:block">
          ✓ {message}
        </span>
      )}
      {state === "error" && (
        <span className="text-xs text-red-500 font-medium hidden sm:block truncate max-w-[160px]">
          {message}
        </span>
      )}
      {state === "syncing" && (
        <span className="text-xs text-blue-600 font-medium hidden sm:block">
          Syncing…
        </span>
      )}

      {/* Button */}
      <button
        onClick={handleRefresh}
        disabled={state === "syncing"}
        title={
          state === "syncing"
            ? "Syncing data from Meta…"
            : "Refresh data from Meta Ads"
        }
        className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
          border transition-all duration-200 select-none
          ${state === "syncing"
            ? "border-blue-200 bg-blue-50 text-blue-500 cursor-not-allowed"
            : state === "success"
            ? "border-green-200 bg-green-50 text-green-600"
            : state === "error"
            ? "border-red-200 bg-red-50 text-red-500"
            : "border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 cursor-pointer"
          }
        `}
      >
        {state === "success" ? (
          <CheckCircle2 className="w-3.5 h-3.5" />
        ) : state === "error" ? (
          <AlertCircle className="w-3.5 h-3.5" />
        ) : (
          <RefreshCw
            className={`w-3.5 h-3.5 ${state === "syncing" ? "animate-spin" : ""}`}
          />
        )}
        <span>
          {state === "syncing" ? "Syncing…" : state === "success" ? "Done" : state === "error" ? "Failed" : "Refresh"}
        </span>
      </button>
    </div>
  );
}
