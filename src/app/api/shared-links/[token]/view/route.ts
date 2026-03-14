/**
 * Public endpoint — no auth required.
 * Validates the share token and returns the overview data for the shared scope.
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/client";
import { getClientOverview, getCampaignList, resolveDateRange } from "@/modules/insights/insights.service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const link = await prisma.sharedDashboardLink.findUnique({
    where: { token },
  });

  if (!link || !link.isActive) {
    return NextResponse.json({ error: "Link not found or expired" }, { status: 404 });
  }

  if (link.expiresAt < new Date()) {
    return NextResponse.json({ error: "This link has expired" }, { status: 410 });
  }

  // Fetch client info separately
  const client = await prisma.client.findUnique({
    where: { id: link.clientId },
    select: { id: true, displayName: true, industry: true },
  });

  // Increment view count
  await prisma.sharedDashboardLink.update({
    where: { token },
    data: { viewCount: { increment: 1 } },
  });

  const dateRange = link.dateRange as { preset?: string; since?: string; until?: string };
  const scope = link.scope as string[];

  const preset = (dateRange.preset ?? "last_30d") as Parameters<typeof resolveDateRange>[0];
  const range = resolveDateRange(preset);

  const clientId = link.clientId;
  const payload: Record<string, unknown> = {
    client: client ? { id: client.id, name: client.displayName, industry: client.industry } : null,
    label: link.label,
    scope,
    expiresAt: link.expiresAt,
  };

  // Fetch data for each enabled scope section
  const [overview, campaigns] = await Promise.all([
    scope.includes("overview") ? getClientOverview(clientId, range) : null,
    scope.includes("campaigns") ? getCampaignList(clientId, range) : null,
  ]);

  if (overview) payload.overview = overview;
  if (campaigns) {
    payload.campaigns = campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      effectiveStatus: c.effectiveStatus,
      objective: c.objective,
      metrics: c.metrics,
    }));
  }

  return NextResponse.json(payload);
}
