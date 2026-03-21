import { requireClientAccess } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import NotesPanel from "@/components/notes/NotesPanel";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:      "bg-green-100 text-green-700",
  PAUSED:      "bg-yellow-100 text-yellow-700",
  ARCHIVED:    "bg-gray-100 text-gray-500",
  IN_PROCESS:  "bg-blue-100 text-blue-700",
  WITH_ISSUES: "bg-red-100 text-red-700",
};

function fmt(n: number, type: "currency" | "number" | "percent", currency = "USD") {
  if (type === "currency") return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  if (type === "percent") return `${n.toFixed(2)}%`;
  return n.toLocaleString();
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ clientId: string; campaignId: string }>;
}) {
  const { clientId, campaignId } = await params;
  await requireClientAccess(clientId);

  const [campaign, clientRecord] = await Promise.all([
    prisma.campaign.findFirst({
      where: { id: campaignId, clientId },
      include: {
        adSets: {
          include: { ads: { select: { id: true, name: true, effectiveStatus: true } } },
          orderBy: { name: "asc" },
        },
      },
    }),
    prisma.client.findUnique({ where: { id: clientId }, select: { currencyCode: true } }),
  ]);
  const clientCurrency = clientRecord?.currencyCode ?? "USD";

  if (!campaign) notFound();

  // Aggregate metrics from InsightSnapshot at campaign level (last 30 days)
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const snapshots = await prisma.insightSnapshot.findMany({
    where: {
      clientId,
      campaignId,
      entityLevel: "campaign",
      dateStart: { gte: since },
    },
  });

  const totals = snapshots.reduce(
    (acc, s) => ({
      spend:       acc.spend       + Number(s.spend       ?? 0),
      leads:       acc.leads       + Number(s.leads       ?? 0),
      clicks:      acc.clicks      + Number(s.clicks      ?? 0),
      impressions: acc.impressions + Number(s.impressions ?? 0),
      reach:       acc.reach       + Number(s.reach       ?? 0),
    }),
    { spend: 0, leads: 0, clicks: 0, impressions: 0, reach: 0 }
  );

  const cpl = totals.leads       > 0 ? totals.spend / totals.leads : null;
  const cpc = totals.clicks      > 0 ? totals.spend / totals.clicks : null;
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : null;
  const cpm = totals.impressions > 0 ? (totals.spend  / totals.impressions) * 1000 : null;

  const kpis = [
    { label: "Spend (30d)",       value: fmt(totals.spend, "currency", clientCurrency),              color: "text-gray-900" },
    { label: "Leads (30d)",       value: totals.leads.toLocaleString(),                             color: "text-blue-600" },
    { label: "CPL",               value: cpl != null ? fmt(cpl, "currency", clientCurrency) : "—", color: "text-purple-600" },
    { label: "CPC",               value: cpc != null ? fmt(cpc, "currency", clientCurrency) : "—", color: "text-orange-600" },
    { label: "CTR",               value: ctr != null ? fmt(ctr, "percent")  : "—",                 color: "text-green-600" },
    { label: "CPM",               value: cpm != null ? fmt(cpm, "currency", clientCurrency) : "—", color: "text-pink-600" },
    { label: "Impressions (30d)", value: totals.impressions.toLocaleString(),                       color: "text-gray-700" },
    { label: "Reach (30d)",       value: totals.reach.toLocaleString(),                             color: "text-gray-700" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href={`/clients/${clientId}/campaigns`} className="text-sm text-gray-500 hover:text-gray-700">
              ← Campaigns
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[campaign.effectiveStatus ?? ""] ?? "bg-gray-100 text-gray-500"}`}>
              {campaign.effectiveStatus ?? "Unknown"}
            </span>
            {campaign.objective && (
              <span className="text-xs text-gray-500">{campaign.objective}</span>
            )}
            {campaign.buyingType && (
              <span className="text-xs text-gray-400">{campaign.buyingType}</span>
            )}
          </div>
        </div>

        {/* Budget chips */}
        <div className="flex gap-3">
          {campaign.dailyBudget && (
            <div className="text-right">
              <p className="text-xs text-gray-400">Daily Budget</p>
              <p className="text-sm font-semibold text-gray-800">{fmt(Number(campaign.dailyBudget), "currency", clientCurrency)}</p>
            </div>
          )}
          {campaign.lifetimeBudget && (
            <div className="text-right">
              <p className="text-xs text-gray-400">Lifetime Budget</p>
              <p className="text-sm font-semibold text-gray-800">{fmt(Number(campaign.lifetimeBudget), "currency", clientCurrency)}</p>
            </div>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className={`text-xl font-bold mt-1 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Ad Sets */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700">
            Ad Sets ({campaign.adSets.length})
          </h2>
        </div>

        {campaign.adSets.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">
            No ad sets synced yet. Run Asset Discovery to populate.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Ad Set", "Status", "Optimization", "Billing", "Budget", "Ads"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {campaign.adSets.map((adSet) => (
                <tr key={adSet.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{adSet.name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[adSet.effectiveStatus ?? ""] ?? "bg-gray-100 text-gray-500"}`}>
                      {adSet.effectiveStatus ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{adSet.optimizationGoal ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{adSet.billingEvent ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-700 text-xs">
                    {adSet.dailyBudget
                      ? `${fmt(Number(adSet.dailyBudget), "currency")}/day`
                      : adSet.lifetimeBudget
                      ? `${fmt(Number(adSet.lifetimeBudget), "currency")} lifetime`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600 font-medium">
                    {adSet.ads.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Timeline */}
      {(campaign.startTime || campaign.stopTime) && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Schedule</h2>
          <div className="flex gap-8">
            {campaign.startTime && (
              <div>
                <p className="text-xs text-gray-400">Start Date</p>
                <p className="text-sm font-medium text-gray-800">
                  {new Date(campaign.startTime).toLocaleDateString(undefined, { dateStyle: "medium" })}
                </p>
              </div>
            )}
            {campaign.stopTime && (
              <div>
                <p className="text-xs text-gray-400">End Date</p>
                <p className="text-sm font-medium text-gray-800">
                  {new Date(campaign.stopTime).toLocaleDateString(undefined, { dateStyle: "medium" })}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      <NotesPanel
        clientId={clientId}
        entityType="campaign"
        entityId={campaignId}
        title="Campaign Notes"
      />
    </div>
  );
}
