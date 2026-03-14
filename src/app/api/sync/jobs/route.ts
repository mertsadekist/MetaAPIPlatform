import { NextRequest } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);

    const jobs = await prisma.syncJob.findMany({
      where: {
        ...(clientId ? { clientId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return Response.json({ jobs });
  } catch (e) {
    return handleAuthError(e);
  }
}
