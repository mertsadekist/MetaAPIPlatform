import { NextRequest, NextResponse } from "next/server";
import { requireClientAccess, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";
import { resolveDateRange } from "@/modules/insights/insights.service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ creativeId: string }> }
) {
  try {
    const { creativeId } = await params;
    const { searchParams } = req.nextUrl;
    const preset = (searchParams.get("preset") ?? "last_30d") as Parameters<typeof resolveDateRange>[0];
    const range = resolveDateRange(preset);

    const creative = await prisma.adCreative.findUnique({
      where: { id: creativeId },
      include: {
        analysis: true,
        fatigueSignals: {
          orderBy: { signalDate: "desc" },
          take: 14,
        },
        ads: {
          select: {
            id: true,
            name: true,
            effectiveStatus: true,
            campaignId: true,
            adSet: { select: { id: true, name: true } },
          },
          take: 20,
        },
      },
    });

    if (!creative) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await requireClientAccess(creative.clientId);

    // Enrich ads with campaign names
    const campaignIds = [...new Set(creative.ads.map((a) => a.campaignId))];
    const campaigns = await prisma.campaign.findMany({
      where: { id: { in: campaignIds } },
      select: { id: true, name: true },
    });
    const campaignMap = new Map(campaigns.map((c) => [c.id, c]));

    const adsEnriched = creative.ads.map((a) => ({
      id: a.id,
      name: a.name,
      effectiveStatus: a.effectiveStatus,
      campaign: campaignMap.get(a.campaignId) ?? null,
      adSet: a.adSet,
    }));

    // Metrics over selected range
    const snapshots = await prisma.insightSnapshot.findMany({
      where: {
        creativeId,
        entityLevel: "ad",
        dateStart: { gte: range.since, lte: range.until },
      },
      select: { dateStart: true, spend: true, leads: true, clicks: true, impressions: true },
      orderBy: { dateStart: "asc" },
    });

    const byDate = new Map<string, { spend: number; leads: number; clicks: number; impressions: number }>();
    for (const s of snapshots) {
      const key = s.dateStart.toISOString().slice(0, 10);
      const prev = byDate.get(key) ?? { spend: 0, leads: 0, clicks: 0, impressions: 0 };
      byDate.set(key, {
        spend: prev.spend + Number(s.spend ?? 0),
        leads: prev.leads + Number(s.leads ?? 0),
        clicks: prev.clicks + Number(s.clicks ?? 0),
        impressions: prev.impressions + Number(s.impressions ?? 0),
      });
    }

    const trend = Array.from(byDate.entries()).map(([date, vals]) => ({ date, ...vals }));
    const totalSpend = trend.reduce((a, b) => a + b.spend, 0);
    const totalLeads = trend.reduce((a, b) => a + b.leads, 0);
    const totalClicks = trend.reduce((a, b) => a + b.clicks, 0);
    const totalImpressions = trend.reduce((a, b) => a + b.impressions, 0);

    return NextResponse.json({
      creative: { ...creative, ads: adsEnriched },
      trend,
      metrics: {
        spend: totalSpend,
        leads: totalLeads,
        clicks: totalClicks,
        impressions: totalImpressions,
        cpl: totalLeads > 0 ? totalSpend / totalLeads : null,
        ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : null,
      },
    });
  } catch (e) {
    return handleAuthError(e);
  }
}
