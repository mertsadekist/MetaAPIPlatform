import { NextRequest } from "next/server";
import { requireClientAccess, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    if (!clientId) return Response.json({ error: "clientId required" }, { status: 400 });

    await requireClientAccess(clientId);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);

    const [alerts, instantAlerts] = await Promise.all([
      prisma.alert.findMany({
        where: { clientId },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.instantAlert.findMany({
        where: { clientId },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
    ]);

    return Response.json({ alerts, instantAlerts });
  } catch (e) {
    return handleAuthError(e);
  }
}
