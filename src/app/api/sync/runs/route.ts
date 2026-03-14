import { NextRequest } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId") ?? undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);

    const runs = await prisma.syncRun.findMany({
      where: clientId ? { clientId } : {},
      orderBy: { startedAt: "desc" },
      take: limit,
    });

    return Response.json({ runs });
  } catch (e) {
    return handleAuthError(e);
  }
}
