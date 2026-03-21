import { NextRequest, NextResponse } from "next/server";
import { requireClientAccess, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";
import { resolveDateRange } from "@/modules/insights/insights.service";

export async function GET(req: NextRequest) {
  try {
  const { searchParams } = req.nextUrl;
  const clientId = searchParams.get("clientId");
  const preset = (searchParams.get("preset") ?? "last_30d") as Parameters<typeof resolveDateRange>[0];

  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });
  await requireClientAccess(clientId);

  const range = resolveDateRange(preset);

  // Fetch WA campaigns for this client
  const waCampaigns = await prisma.whatsAppCampaign.findMany({
    where: { clientId },
    include: {
      campaign: { select: { id: true, name: true, effectiveStatus: true, objective: true } },
    },
  });

  if (waCampaigns.length > 0) {
    // ── Path A: WhatsAppCampaign records exist (Asset Discovery ran) ──
    const campaignIds = waCampaigns.map((w) => w.campaignId);

    const snapshots = await prisma.insightSnapshot.groupBy({
      by: ["campaignId"],
      where: {
        clientId,
        entityLevel: "adset",
        campaignId: { in: campaignIds },
        dateStart: { gte: range.since, lte: range.until },
      },
      _sum: {
        spend: true,
        leads: true,
        clicks: true,
        impressions: true,
        messagesStarted: true,
      },
    });

    const metricsMap = new Map<string, {
      spend: number; leads: number; clicks: number; impressions: number; messagesStarted: number;
    }>();

    for (const s of snapshots) {
      if (!s.campaignId) continue;
      metricsMap.set(s.campaignId, {
        spend: Number(s._sum.spend ?? 0),
        leads: Number(s._sum.leads ?? 0),
        clicks: Number(s._sum.clicks ?? 0),
        impressions: Number(s._sum.impressions ?? 0),
        messagesStarted: Number(s._sum.messagesStarted ?? 0),
      });
    }

    const trendRows = await prisma.insightSnapshot.findMany({
      where: {
        clientId,
        entityLevel: "adset",
        campaignId: { in: campaignIds },
        granularity: "hourly",
        dateStart: { gte: range.since, lte: range.until },
      },
      select: { dateStart: true, spend: true, messagesStarted: true, leads: true },
      orderBy: { dateStart: "asc" },
    });

    const byDate = new Map<string, { spend: number; messages: number; leads: number }>();
    for (const r of trendRows) {
      const key = r.dateStart.toISOString().slice(0, 10);
      const prev = byDate.get(key) ?? { spend: 0, messages: 0, leads: 0 };
      byDate.set(key, {
        spend: prev.spend + Number(r.spend ?? 0),
        messages: prev.messages + Number(r.messagesStarted ?? 0),
        leads: prev.leads + Number(r.leads ?? 0),
      });
    }
    const trend = Array.from(byDate.entries()).map(([date, vals]) => ({ date, ...vals }));

    const campaigns = waCampaigns.map((w) => {
      const m = metricsMap.get(w.campaignId) ?? { spend: 0, leads: 0, clicks: 0, impressions: 0, messagesStarted: 0 };
      const cpm = m.messagesStarted > 0 ? m.spend / m.messagesStarted : null;
      const cpl = m.leads > 0 ? m.spend / m.leads : null;
      return {
        id: w.id,
        campaignId: w.campaignId,
        campaignName: w.campaignName,
        waPhoneNumber: w.waPhoneNumber,
        waDisplayName: w.waDisplayName,
        trackingMethod: w.trackingMethod,
        status: w.status,
        campaign: w.campaign,
        metrics: { ...m, cpm, cpl },
      };
    });

    const totals = campaigns.reduce(
      (acc, c) => ({
        spend: acc.spend + c.metrics.spend,
        messages: acc.messages + c.metrics.messagesStarted,
        leads: acc.leads + c.metrics.leads,
      }),
      { spend: 0, messages: 0, leads: 0 }
    );

    return NextResponse.json({
      campaigns,
      trend,
      totals: {
        ...totals,
        costPerMessage: totals.messages > 0 ? totals.spend / totals.messages : null,
        cpl: totals.leads > 0 ? totals.spend / totals.leads : null,
      },
    });
  }

  // ── Path B: No WhatsAppCampaign records — fall back to InsightSnapshot ──
  // Query adsets that have messagesStarted > 0 for this client
  const adsetSnapshots = await prisma.insightSnapshot.groupBy({
    by: ["adSetId"],
    where: {
      clientId,
      entityLevel: "adset",
      granularity: "hourly",
      dateStart: { gte: range.since, lte: range.until },
      messagesStarted: { gt: 0 },
    },
    _sum: {
      spend: true,
      clicks: true,
      impressions: true,
      messagesStarted: true,
      leads: true,
    },
  });

  if (adsetSnapshots.length === 0) {
    return NextResponse.json({ campaigns: [], totals: null });
  }

  // Try to get adset names
  const adSetIds = adsetSnapshots.map((s) => s.adSetId).filter(Boolean) as string[];
  const adSets = await prisma.adSet.findMany({
    where: { id: { in: adSetIds } },
    select: { id: true, name: true, effectiveStatus: true },
  });
  const adSetMap = new Map(adSets.map((a) => [a.id, a]));

  // Trend data across all WA adsets
  const trendRows = await prisma.insightSnapshot.findMany({
    where: {
      clientId,
      entityLevel: "adset",
      granularity: "hourly",
      dateStart: { gte: range.since, lte: range.until },
      messagesStarted: { gt: 0 },
    },
    select: { dateStart: true, spend: true, messagesStarted: true, leads: true },
    orderBy: { dateStart: "asc" },
  });

  const byDate = new Map<string, { spend: number; messages: number; leads: number }>();
  for (const r of trendRows) {
    const key = r.dateStart.toISOString().slice(0, 10);
    const prev = byDate.get(key) ?? { spend: 0, messages: 0, leads: 0 };
    byDate.set(key, {
      spend: prev.spend + Number(r.spend ?? 0),
      messages: prev.messages + Number(r.messagesStarted ?? 0),
      leads: prev.leads + Number(r.leads ?? 0),
    });
  }
  const trend = Array.from(byDate.entries()).map(([date, vals]) => ({ date, ...vals }));

  const campaigns = adsetSnapshots.map((s) => {
    const adSet = s.adSetId ? adSetMap.get(s.adSetId) : null;
    const spend = Number(s._sum.spend ?? 0);
    const messagesStarted = Number(s._sum.messagesStarted ?? 0);
    const leads = Number(s._sum.leads ?? 0);
    const cpm = messagesStarted > 0 ? spend / messagesStarted : null;
    const cpl = leads > 0 ? spend / leads : null;
    return {
      id: s.adSetId ?? "unknown",
      campaignId: null,
      campaignName: adSet?.name ?? "Ad Set",
      waPhoneNumber: null,
      waDisplayName: null,
      trackingMethod: "auto",
      status: adSet?.effectiveStatus ?? "ACTIVE",
      campaign: null,
      metrics: {
        spend,
        messagesStarted,
        leads,
        clicks: Number(s._sum.clicks ?? 0),
        impressions: Number(s._sum.impressions ?? 0),
        cpm,
        cpl,
      },
    };
  });

  const totals = campaigns.reduce(
    (acc, c) => ({
      spend: acc.spend + c.metrics.spend,
      messages: acc.messages + c.metrics.messagesStarted,
      leads: acc.leads + c.metrics.leads,
    }),
    { spend: 0, messages: 0, leads: 0 }
  );

  return NextResponse.json({
    campaigns,
    trend,
    totals: {
      ...totals,
      costPerMessage: totals.messages > 0 ? totals.spend / totals.messages : null,
      cpl: totals.leads > 0 ? totals.spend / totals.leads : null,
    },
  });
  } catch (e) {
    return handleAuthError(e);
  }
}
