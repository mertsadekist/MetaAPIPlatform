/**
 * Insights Service — queries aggregated performance data from DB.
 */

import prisma from "@/lib/db/client";
import { subDays } from "date-fns";

async function getAssignedAdAccountIds(
  clientId: string,
  intersectWith: string[] | null = null
): Promise<string[]> {
  const accounts = await prisma.adAccount.findMany({
    where: { clientId, isAssigned: true },
    select: { id: true },
  });
  const ids = accounts.map((a) => a.id);
  if (intersectWith === null) return ids;
  // Intersect: only IDs the user is allowed to see AND are assigned
  return ids.filter((id) => intersectWith.includes(id));
}

export interface DateRange {
  since: Date;
  until: Date;
}

export type PresetRange = "last_7d" | "last_14d" | "last_30d" | "last_90d" | "this_month";

export function resolveDateRange(preset: PresetRange): DateRange {
  const now = new Date();
  const map: Record<PresetRange, DateRange> = {
    last_7d: { since: subDays(now, 7), until: now },
    last_14d: { since: subDays(now, 14), until: now },
    last_30d: { since: subDays(now, 30), until: now },
    last_90d: { since: subDays(now, 90), until: now },
    this_month: {
      since: new Date(now.getFullYear(), now.getMonth(), 1),
      until: now,
    },
  };
  return map[preset];
}

export async function getClientOverview(
  clientId: string,
  range: DateRange,
  restrictToIds: string[] | null = null
) {
  const assignedIds = await getAssignedAdAccountIds(clientId, restrictToIds);
  const accountFilter = assignedIds.length > 0 ? { adAccountId: { in: assignedIds } } : {};

  const [current, previous, latestPacing] = await Promise.all([
    // Current period metrics
    prisma.insightSnapshot.aggregate({
      where: {
        clientId,
        ...accountFilter,
        entityLevel: "adset",
        granularity: "hourly",
        dateStart: { gte: range.since, lte: range.until },
      },
      _sum: {
        spend: true,
        impressions: true,
        reach: true,
        clicks: true,
        leads: true,
        purchases: true,
        purchaseValue: true,
        messagesStarted: true,
      },
    }),

    // Previous equal period for delta
    prisma.insightSnapshot.aggregate({
      where: {
        clientId,
        ...accountFilter,
        entityLevel: "adset",
        granularity: "hourly",
        dateStart: {
          gte: subDays(range.since, Math.ceil((range.until.getTime() - range.since.getTime()) / 86400000)),
          lt: range.since,
        },
      },
      _sum: { spend: true, leads: true },
    }),

    // Latest budget pacing
    prisma.budgetPacingSnapshot.findFirst({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      include: { adAccount: { select: { metaAdAccountId: true, name: true, currency: true } } },
    }),
  ]);

  const spend = Number(current._sum.spend ?? 0);
  const leads = Number(current._sum.leads ?? 0);
  const cpl = leads > 0 ? spend / leads : null;
  const purchases = Number(current._sum.purchases ?? 0);
  const purchaseValue = Number(current._sum.purchaseValue ?? 0);
  const roas = spend > 0 ? purchaseValue / spend : null;

  const prevSpend = Number(previous._sum.spend ?? 0);
  const prevLeads = Number(previous._sum.leads ?? 0);
  const prevCpl = prevLeads > 0 ? prevSpend / prevLeads : null;

  return {
    spend,
    impressions: Number(current._sum.impressions ?? 0),
    reach: Number(current._sum.reach ?? 0),
    clicks: Number(current._sum.clicks ?? 0),
    leads,
    purchases,
    purchaseValue,
    messagesStarted: Number(current._sum.messagesStarted ?? 0),
    cpl,
    roas,
    ctr: Number(current._sum.impressions ?? 0) > 0 ? (Number(current._sum.clicks ?? 0) / Number(current._sum.impressions ?? 0)) * 100 : 0,
    cpc: Number(current._sum.clicks ?? 0) > 0 ? spend / Number(current._sum.clicks ?? 0) : 0,
    cpm: Number(current._sum.impressions ?? 0) > 0 ? (spend / Number(current._sum.impressions ?? 0)) * 1000 : 0,
    deltas: {
      spend: prevSpend > 0 ? ((spend - prevSpend) / prevSpend) * 100 : null,
      leads: prevLeads > 0 ? ((leads - prevLeads) / prevLeads) * 100 : null,
      cpl: prevCpl && cpl ? ((cpl - prevCpl) / prevCpl) * 100 : null,
    },
    pacing: latestPacing,
  };
}

export async function getCampaignList(
  clientId: string,
  range: DateRange,
  restrictToIds: string[] | null = null
) {
  const assignedIds = await getAssignedAdAccountIds(clientId, restrictToIds);
  const accountFilter = assignedIds.length > 0 ? { adAccountId: { in: assignedIds } } : {};

  // ── Path A: Campaign records exist (Asset Discovery ran) ──
  const campaigns = await prisma.campaign.findMany({
    where: { clientId },   // Note: clientId-only filter; adAccountId filter was causing misses
    include: {
      adAccount: { select: { name: true, currency: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (campaigns.length > 0) {
    // Aggregate metrics per campaign from InsightSnapshot
    const metricsMap = new Map<string, {
      spend: number; leads: number; clicks: number; impressions: number;
      messagesStarted: number; cpl: number | null; costPerMessage: number | null;
    }>();

    // Try by campaignId first
    const snapshotsByCampaign = await prisma.insightSnapshot.groupBy({
      by: ["campaignId"],
      where: {
        clientId,
        ...accountFilter,
        entityLevel: "adset",
        dateStart: { gte: range.since, lte: range.until },
        campaignId: { not: null },
      },
      _sum: { spend: true, leads: true, clicks: true, impressions: true, messagesStarted: true },
    });

    for (const s of snapshotsByCampaign) {
      if (!s.campaignId) continue;
      const spend = Number(s._sum.spend ?? 0);
      const leads = Number(s._sum.leads ?? 0);
      const messagesStarted = Number(s._sum.messagesStarted ?? 0);
      metricsMap.set(s.campaignId, {
        spend,
        leads,
        clicks: Number(s._sum.clicks ?? 0),
        impressions: Number(s._sum.impressions ?? 0),
        messagesStarted,
        cpl: leads > 0 ? spend / leads : null,
        costPerMessage: messagesStarted > 0 ? spend / messagesStarted : null,
      });
    }

    // If campaignId-based metrics are empty, try via adSetId → campaign
    if (metricsMap.size === 0) {
      const snapshotsByAdSet = await prisma.insightSnapshot.groupBy({
        by: ["adSetId"],
        where: {
          clientId,
          ...accountFilter,
          entityLevel: "adset",
          dateStart: { gte: range.since, lte: range.until },
          adSetId: { not: null },
        },
        _sum: { spend: true, leads: true, clicks: true, impressions: true, messagesStarted: true },
      });

      const adSetIds = snapshotsByAdSet.map((s) => s.adSetId).filter(Boolean) as string[];
      const adSets = await prisma.adSet.findMany({
        where: { id: { in: adSetIds } },
        select: { id: true, campaignId: true },
      });
      const adSetToCampaign = new Map(adSets.map((a) => [a.id, a.campaignId]));

      for (const s of snapshotsByAdSet) {
        if (!s.adSetId) continue;
        const campaignId = adSetToCampaign.get(s.adSetId);
        if (!campaignId) continue;
        const prev = metricsMap.get(campaignId) ?? { spend: 0, leads: 0, clicks: 0, impressions: 0, messagesStarted: 0, cpl: null, costPerMessage: null };
        const spend = prev.spend + Number(s._sum.spend ?? 0);
        const leads = prev.leads + Number(s._sum.leads ?? 0);
        const messagesStarted = prev.messagesStarted + Number(s._sum.messagesStarted ?? 0);
        metricsMap.set(campaignId, {
          spend,
          leads,
          clicks: prev.clicks + Number(s._sum.clicks ?? 0),
          impressions: prev.impressions + Number(s._sum.impressions ?? 0),
          messagesStarted,
          cpl: leads > 0 ? spend / leads : null,
          costPerMessage: messagesStarted > 0 ? spend / messagesStarted : null,
        });
      }
    }

    return campaigns.map((c) => ({
      ...c,
      metrics: metricsMap.get(c.id) ?? { spend: 0, leads: 0, clicks: 0, impressions: 0, messagesStarted: 0, cpl: null, costPerMessage: null },
    }));
  }

  // ── Path B: No Campaign records — build from InsightSnapshot → AdSet → Campaign ──
  const snapshotsByAdSet = await prisma.insightSnapshot.groupBy({
    by: ["adSetId"],
    where: {
      clientId,
      ...accountFilter,
      entityLevel: "adset",
      dateStart: { gte: range.since, lte: range.until },
      adSetId: { not: null },
    },
    _sum: { spend: true, leads: true, clicks: true, impressions: true, messagesStarted: true },
  });

  if (snapshotsByAdSet.length === 0) return [];

  const adSetIds = snapshotsByAdSet.map((s) => s.adSetId).filter(Boolean) as string[];
  const adSets = await prisma.adSet.findMany({
    where: { id: { in: adSetIds } },
    select: { id: true, campaignId: true, effectiveStatus: true },
  });

  // Get unique campaign IDs from adsets
  const campaignIdsFromAdSets = [...new Set(adSets.map((a) => a.campaignId).filter(Boolean))] as string[];

  let campaignRecords: Array<{
    id: string; name: string; effectiveStatus: string | null; objective: string | null;
    adAccountId: string;
    adAccount: { name: string; currency: string } | null;
  }> = [];

  if (campaignIdsFromAdSets.length > 0) {
    campaignRecords = await prisma.campaign.findMany({
      where: { id: { in: campaignIdsFromAdSets } },
      include: { adAccount: { select: { name: true, currency: true } } },
    }) as typeof campaignRecords;
  }

  const campaignDbMap = new Map(campaignRecords.map((c) => [c.id, c]));
  const adSetToCampaignId = new Map(adSets.map((a) => [a.id, a.campaignId]));

  // Aggregate metrics per campaign
  const campaignMetrics = new Map<string, { spend: number; leads: number; clicks: number; impressions: number; messagesStarted: number }>();
  for (const s of snapshotsByAdSet) {
    if (!s.adSetId) continue;
    const campaignId = adSetToCampaignId.get(s.adSetId);
    if (!campaignId) continue;
    const prev = campaignMetrics.get(campaignId) ?? { spend: 0, leads: 0, clicks: 0, impressions: 0, messagesStarted: 0 };
    campaignMetrics.set(campaignId, {
      spend: prev.spend + Number(s._sum.spend ?? 0),
      leads: prev.leads + Number(s._sum.leads ?? 0),
      clicks: prev.clicks + Number(s._sum.clicks ?? 0),
      impressions: prev.impressions + Number(s._sum.impressions ?? 0),
      messagesStarted: prev.messagesStarted + Number(s._sum.messagesStarted ?? 0),
    });
  }

  // If no campaign records found via adsets, aggregate all snapshots as one synthetic campaign
  if (campaignMetrics.size === 0) {
    const total = snapshotsByAdSet.reduce(
      (acc, s) => ({
        spend: acc.spend + Number(s._sum.spend ?? 0),
        leads: acc.leads + Number(s._sum.leads ?? 0),
        clicks: acc.clicks + Number(s._sum.clicks ?? 0),
        impressions: acc.impressions + Number(s._sum.impressions ?? 0),
        messagesStarted: acc.messagesStarted + Number(s._sum.messagesStarted ?? 0),
      }),
      { spend: 0, leads: 0, clicks: 0, impressions: 0, messagesStarted: 0 }
    );
    // Look up adAccount for currency
    const fallbackAccount = assignedIds.length > 0
      ? await prisma.adAccount.findUnique({ where: { id: assignedIds[0] }, select: { name: true, currency: true } })
      : null;
    return [{
      id: "synthetic",
      clientId,
      adAccountId: assignedIds[0] ?? "",
      metaCampaignId: "",
      name: "All Active Campaigns",
      objective: null,
      effectiveStatus: "ACTIVE",
      buyingType: null,
      dailyBudget: null,
      lifetimeBudget: null,
      startTime: null,
      stopTime: null,
      rawPayload: null,
      createdTimeMeta: null,
      updatedTimeMeta: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      adAccount: fallbackAccount,
      metrics: {
        ...total,
        cpl: total.leads > 0 ? total.spend / total.leads : null,
        costPerMessage: total.messagesStarted > 0 ? total.spend / total.messagesStarted : null,
      },
    }];
  }

  return Array.from(campaignMetrics.entries()).map(([campaignId, metrics]) => {
    const campaign = campaignDbMap.get(campaignId);
    const spend = metrics.spend;
    const leads = metrics.leads;
    const messagesStarted = metrics.messagesStarted;
    return {
      id: campaign?.id ?? campaignId,
      clientId,
      adAccountId: campaign?.adAccountId ?? (assignedIds[0] ?? ""),
      metaCampaignId: "",
      name: campaign?.name ?? "Campaign",
      objective: campaign?.objective ?? null,
      effectiveStatus: campaign?.effectiveStatus ?? "ACTIVE",
      buyingType: null,
      dailyBudget: null,
      lifetimeBudget: null,
      startTime: null,
      stopTime: null,
      rawPayload: null,
      createdTimeMeta: null,
      updatedTimeMeta: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      adAccount: campaign?.adAccount ?? null,
      metrics: {
        spend,
        leads,
        clicks: metrics.clicks,
        impressions: metrics.impressions,
        messagesStarted,
        cpl: leads > 0 ? spend / leads : null,
        costPerMessage: messagesStarted > 0 ? spend / messagesStarted : null,
      },
    };
  });
}

export async function getTrendData(
  clientId: string,
  metric: "spend" | "leads" | "cpl",
  range: DateRange,
  restrictToIds: string[] | null = null
) {
  const assignedIds = await getAssignedAdAccountIds(clientId, restrictToIds);
  const accountFilter = assignedIds.length > 0 ? { adAccountId: { in: assignedIds } } : {};

  const snapshots = await prisma.insightSnapshot.findMany({
    where: {
      clientId,
      ...accountFilter,
      entityLevel: "adset",
      granularity: "hourly",
      dateStart: { gte: range.since, lte: range.until },
    },
    select: { dateStart: true, spend: true, leads: true, cpl: true },
    orderBy: { dateStart: "asc" },
  });

  // Group by date
  const byDate = new Map<string, { spend: number; leads: number; cpl: number | null }>();
  for (const s of snapshots) {
    const key = s.dateStart.toISOString().slice(0, 10);
    const prev = byDate.get(key) ?? { spend: 0, leads: 0, cpl: null };
    const spend = prev.spend + Number(s.spend ?? 0);
    const leads = prev.leads + Number(s.leads ?? 0);
    byDate.set(key, { spend, leads, cpl: leads > 0 ? spend / leads : null });
  }

  return Array.from(byDate.entries()).map(([date, vals]) => ({
    date,
    value: metric === "cpl" ? vals.cpl : vals[metric],
  }));
}

export async function getCreativesList(
  clientId: string,
  range: DateRange,
  restrictToIds: string[] | null = null
) {
  const assignedIds = await getAssignedAdAccountIds(clientId, restrictToIds);
  const accountFilter = assignedIds.length > 0 ? { adAccountId: { in: assignedIds } } : {};

  const creatives = await prisma.adCreative.findMany({
    where: { clientId },
    include: {
      analysis: true,
      fatigueSignals: {
        orderBy: { signalDate: "desc" },
        take: 1,
      },
      ads: { select: { id: true, campaignId: true }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Aggregate metrics per creative
  const snapshots = await prisma.insightSnapshot.groupBy({
    by: ["creativeId"],
    where: {
      clientId,
      ...accountFilter,
      entityLevel: "ad",
      dateStart: { gte: range.since, lte: range.until },
      creativeId: { not: null },
    },
    _sum: { spend: true, leads: true, clicks: true, impressions: true },
  });

  const metricsMap = new Map<string, { spend: number; leads: number; clicks: number; impressions: number; cpl: number | null }>();
  for (const s of snapshots) {
    if (!s.creativeId) continue;
    const spend = Number(s._sum.spend ?? 0);
    const leads = Number(s._sum.leads ?? 0);
    metricsMap.set(s.creativeId, {
      spend,
      leads,
      clicks: Number(s._sum.clicks ?? 0),
      impressions: Number(s._sum.impressions ?? 0),
      cpl: leads > 0 ? spend / leads : null,
    });
  }

  return creatives.map((c) => ({
    ...c,
    metrics: metricsMap.get(c.id) ?? { spend: 0, leads: 0, clicks: 0, impressions: 0, cpl: null },
  }));
}
