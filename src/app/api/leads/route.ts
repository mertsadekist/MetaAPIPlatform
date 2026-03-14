import { NextRequest, NextResponse } from "next/server";
import { requireClientAccess, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const clientId = searchParams.get("clientId");
    if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });
    await requireClientAccess(clientId);

    const page = parseInt(searchParams.get("page") ?? "1");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
    const skip = (page - 1) * limit;
    const status = searchParams.get("status");
    const campaignId = searchParams.get("campaignId");
    const since = searchParams.get("since");
    const until = searchParams.get("until");

    const where: Record<string, unknown> = { clientId };
    if (status) where.qualityStatus = status;
    if (campaignId) where.campaignId = campaignId;
    if (since || until) {
      where.receivedAt = {};
      if (since) (where.receivedAt as Record<string,unknown>).gte = new Date(since);
      if (until) (where.receivedAt as Record<string,unknown>).lte = new Date(until);
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          campaign: { select: { id: true, name: true } },
        },
        orderBy: { receivedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.lead.count({ where }),
    ]);

    // Status breakdown
    const statusBreakdown = await prisma.lead.groupBy({
      by: ["qualityStatus"],
      where: { clientId },
      _count: true,
    });

    return NextResponse.json({ leads, total, page, limit, statusBreakdown });
  } catch (e) {
    return handleAuthError(e);
  }
}
