/**
 * Insights Service — queries aggregated performance data from DB.
 */

import prisma from "@/lib/db/client";
import { subDays } from "date-fns";

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

export async function getClientOverview(clientId: string, range: DateRange) {
  const [current, previous, latestPacing] = await Promise.all([
    // Current period metrics
    prisma.insightSnapshot.aggregate({
      where: {
        clientId,
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
      _avg: { ctr: true, cpc: true, cpm: true },
    }),

    // Previous equal period for delta
    prisma.insightSnapshot.aggregate({
      where: {
        clientId,
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
    ctr: Number(current._avg.ctr ?? 0),
    cpc: Number(current._avg.cpc ?? 0),
    cpm: Number(current._avg.cpm ?? 0),
    deltas: {
      spend: prevSpend > 0 ? ((spend - prevSpend) / prevSpend) * 100 : null,
      leads: prevLeads > 0 ? ((leads - prevLeads) / prevLeads) * 100 : null,
      cpl: prevCpl && cpl ? ((cpl - prevCpl) / prevCpl) * 100 : null,
    },
    pacing: latestPacing,
  };
}

export async function getCampaignList(clientId: string, range: DateRange) {
  const campaigns = await prisma.campaign.findMany({
    where: { clientId },
    include: {
      adAccount: { select: { name: true, currency: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Aggregate metrics per campaign
  const metricsMap = new Map<string, {
    spend: number; leads: number; clicks: number; impressions: number; cpl: number | null;
  }>();

  const snapshots = await prisma.insightSnapshot.groupBy({
    by: ["campaignId"],
    where: {
      clientId,
      entityLevel: "adset",
      dateStart: { gte: range.since, lte: range.until },
      campaignId: { not: null },
    },
    _sum: { spend: true, leads: true, clicks: true, impressions: true },
  });

  for (const s of snapshots) {
    if (!s.campaignId) continue;
    const spend = Number(s._sum.spend ?? 0);
    const leads = Number(s._sum.leads ?? 0);
    metricsMap.set(s.campaignId, {
      spend,
      leads,
      clicks: Number(s._sum.clicks ?? 0),
      impressions: Number(s._sum.impressions ?? 0),
      cpl: leads > 0 ? spend / leads : null,
    });
  }

  return campaigns.map((c) => ({
    ...c,
    metrics: metricsMap.get(c.id) ?? { spend: 0, leads: 0, clicks: 0, impressions: 0, cpl: null },
  }));
}

export async function getTrendData(
  clientId: string,
  metric: "spend" | "leads" | "cpl",
  range: DateRange
) {
  const snapshots = await prisma.insightSnapshot.findMany({
    where: {
      clientId,
      entityLevel: "adset",
      granularity: "daily",
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

export async function getCreativesList(clientId: string, range: DateRange) {
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
