import { NextRequest, NextResponse } from "next/server";
import { requireClientAccess, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";

/**
 * GET /api/alerts/unread?clientId=...
 * Returns recent active alerts (last 10) plus count for notification bell.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId") ?? "";
    await requireClientAccess(clientId);

    const [alerts, count] = await Promise.all([
      prisma.alert.findMany({
        where: { clientId, status: "active" },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          alertType: true,
          severity: true,
          title: true,
          message: true,
          createdAt: true,
        },
      }),
      prisma.alert.count({ where: { clientId, status: "active" } }),
    ]);

    return NextResponse.json({ alerts, count });
  } catch (e) {
    return handleAuthError(e);
  }
}
