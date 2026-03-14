import { NextRequest } from "next/server";
import { requireClientAccess, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";
import { startOfMonth, endOfMonth } from "date-fns";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    if (!clientId) {
      return Response.json({ error: "clientId required" }, { status: 400 });
    }

    await requireClientAccess(clientId);

    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // Latest pacing snapshot per ad account this month
    const snapshots = await prisma.budgetPacingSnapshot.findMany({
      where: {
        clientId,
        month: { gte: monthStart, lte: monthEnd },
      },
      include: {
        adAccount: { select: { metaAdAccountId: true, name: true, currency: true } },
      },
      orderBy: { createdAt: "desc" },
      distinct: ["adAccountId"],
    });

    return Response.json({ snapshots });
  } catch (e) {
    return handleAuthError(e);
  }
}
