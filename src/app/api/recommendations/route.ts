import { NextRequest } from "next/server";
import { requireClientAccess, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    if (!clientId) return Response.json({ error: "clientId required" }, { status: 400 });

    await requireClientAccess(clientId);

    const status = searchParams.get("status") ?? "active";
    const severity = searchParams.get("severity") ?? undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);

    const recommendations = await prisma.recommendation.findMany({
      where: {
        clientId,
        status,
        ...(severity ? { severity } : {}),
      },
      orderBy: [
        { severity: "asc" }, // critical first (alphabetically: critical < high < low < medium)
        { generatedAt: "desc" },
      ],
      take: limit,
    });

    return Response.json({ recommendations });
  } catch (e) {
    return handleAuthError(e);
  }
}
