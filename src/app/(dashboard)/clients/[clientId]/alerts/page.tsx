"use client";

import { useState, useEffect } from "react";
import { use } from "react";

interface Recommendation {
  id: string;
  ruleId: string | null;
  severity: string;
  title: string;
  suggestion: string;
  expectedEffect: string | null;
  evidenceJson: Record<string, unknown>;
  entityLevel: string;
  generatedAt: string;
  status: string;
}

const SEVERITY_STYLE: Record<string, { badge: string; border: string; dot: string }> = {
  critical: { badge: "bg-red-100 text-red-700", border: "border-red-200", dot: "bg-red-500" },
  high:     { badge: "bg-orange-100 text-orange-700", border: "border-orange-200", dot: "bg-orange-500" },
  medium:   { badge: "bg-yellow-100 text-yellow-700", border: "border-yellow-200", dot: "bg-yellow-400" },
  low:      { badge: "bg-blue-100 text-blue-700", border: "border-blue-200", dot: "bg-blue-400" },
};

export default function AlertsPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("active");
  const [running, setRunning] = useState(false);

  function load(status: string) {
    setLoading(true);
    fetch(`/api/recommendations?clientId=${clientId}&status=${status}`)
      .then((r) => r.json())
      .then((d) => { setRecommendations(d.recommendations ?? []); setLoading(false); });
  }

  useEffect(() => { load(activeTab); }, [clientId, activeTab]);

  async function handleDismiss(id: string) {
    await fetch(`/api/recommendations/${id}/dismiss`, { method: "POST" });
    setRecommendations((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleRunEngine() {
    setRunning(true);
    await fetch("/api/recommendations/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    });
    setRunning(false);
    load(activeTab);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Recommendations & Alerts</h1>
        <button
          onClick={handleRunEngine}
          disabled={running}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {running ? "Running..." : "Run Analysis"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {["active", "dismissed"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize -mb-px border-b-2 transition-colors ${
              activeTab === tab
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-24 animate-pulse" />
          ))}
        </div>
      ) : recommendations.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-gray-500 text-sm">
            {activeTab === "active"
              ? "No active recommendations. Run analysis to check for issues."
              : "No dismissed recommendations."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {recommendations.map((rec) => {
            const style = SEVERITY_STYLE[rec.severity] ?? SEVERITY_STYLE.low;
            return (
              <div key={rec.id} className={`bg-white border rounded-xl p-4 shadow-sm ${style.border}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${style.dot}`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase ${style.badge}`}>
                          {rec.severity}
                        </span>
                        <span className="text-xs text-gray-400 uppercase">{rec.entityLevel}</span>
                      </div>
                      <h3 className="font-semibold text-gray-900">{rec.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{rec.suggestion}</p>
                      {rec.expectedEffect && (
                        <p className="text-xs text-gray-400 mt-1 italic">
                          Expected: {rec.expectedEffect}
                        </p>
                      )}
                      {rec.evidenceJson && Object.keys(rec.evidenceJson).length > 0 && (
                        <div className="flex gap-3 mt-2 flex-wrap">
                          {Object.entries(rec.evidenceJson).map(([k, v]) => (
                            <span key={k} className="text-xs bg-gray-50 border border-gray-200 rounded px-2 py-0.5">
                              <span className="text-gray-500">{k}:</span>{" "}
                              <span className="font-medium text-gray-700">{String(v)}</span>
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        Generated {new Date(rec.generatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {activeTab === "active" && (
                    <button
                      onClick={() => handleDismiss(rec.id)}
                      className="text-xs text-gray-400 hover:text-gray-600 whitespace-nowrap"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
