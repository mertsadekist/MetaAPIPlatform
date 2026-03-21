import { NextRequest, NextResponse } from "next/server";
import { requireClientAccess, requireAuth, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";
import { z } from "zod";

const periodSchema = z.object({
  since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const compareSchema = z.object({
  clientId: z.string().uuid(),
  periodA: periodSchema,
  periodB: periodSchema,
  campaignIds: z.array(z.string()).optional(),
  saveName: z.string().max(200).optional(),
});

async function getPeriodMetrics(
  clientId: string,
  since: Date,
  until: Date,
  campaignIds?: string[]
) {
  const where = {
    clientId,
    dateStart: { gte: since, lte: until },
    entityLevel: "adset",
    granularity: "hourly",
    ...(campaignIds?.length ? { campaignId: { in: campaignIds } } : {}),
  };

  const snapshots = await prisma.insightSnapshot.findMany({ where });

  const totals = snapshots.reduce(
    (acc, s) => ({
      spend: acc.spend + Number(s.spend ?? 0),
      leads: acc.leads + Number(s.leads ?? 0),
      clicks: acc.clicks + Number(s.clicks ?? 0),
      impressions: acc.impressions + Number(s.impressions ?? 0),
      reach: acc.reach + Number(s.reach ?? 0),
    }),
    { spend: 0, leads: 0, clicks: 0, impressions: 0, reach: 0 }
  );

  const cpl = totals.leads > 0 ? totals.spend / totals.leads : null;
  const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : null;
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : null;
  const cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : null;

  // Active campaigns in this period
  const campaignSet = new Set(snapshots.map((s) => s.campaignId).filter(Boolean));

  return {
    spend: totals.spend,
    leads: totals.leads,
    clicks: totals.clicks,
    impressions: totals.impressions,
    reach: totals.reach,
    cpl,
    cpc,
    ctr,
    cpm,
    activeCampaigns: campaignSet.size,
    days: Math.ceil((until.getTime() - since.getTime()) / 86400000) + 1,
  };
}

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
    const parsed = compareSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

    const { clientId, periodA, periodB, campaignIds, saveName } = parsed.data;
    await requireClientAccess(clientId);

    const sinceA = new Date(periodA.since);
    const untilA = new Date(periodA.until);
    const sinceB = new Date(periodB.since);
    const untilB = new Date(periodB.until);

    const [metricsA, metricsB] = await Promise.all([
      getPeriodMetrics(clientId, sinceA, untilA, campaignIds),
      getPeriodMetrics(clientId, sinceB, untilB, campaignIds),
    ]);

    // Calculate % change (A is "current", B is "previous")
    function pctChange(current: number | null, previous: number | null) {
      if (current === null || previous === null || previous === 0) return null;
      return ((current - previous) / previous) * 100;
    }

    const deltas = {
      spend: pctChange(metricsA.spend, metricsB.spend),
      leads: pctChange(metricsA.leads, metricsB.leads),
      clicks: pctChange(metricsA.clicks, metricsB.clicks),
      impressions: pctChange(metricsA.impressions, metricsB.impressions),
      cpl: pctChange(metricsA.cpl, metricsB.cpl),
      cpc: pctChange(metricsA.cpc, metricsB.cpc),
      ctr: pctChange(metricsA.ctr, metricsB.ctr),
      cpm: pctChange(metricsA.cpm, metricsB.cpm),
    };

    // Optionally save the comparison
    let saved = null;
    if (saveName) {
      const session = await requireAuth();
      saved = await prisma.savedComparison.create({
        data: {
          clientId,
          name: saveName,
          filterPayload: { periodA, periodB, campaignIds: campaignIds ?? [] },
          createdBy: (session.user as { id: string }).id,
        },
      });
    }

    return NextResponse.json({
      periodA: { ...periodA, metrics: metricsA },
      periodB: { ...periodB, metrics: metricsB },
      deltas,
      saved,
    });
  } catch (e) {
    return handleAuthError(e);
  }
}

export async function GET(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get("clientId");
    if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });
    await requireClientAccess(clientId);

    const saved = await prisma.savedComparison.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ saved });
  } catch (e) {
    return handleAuthError(e);
  }
}
