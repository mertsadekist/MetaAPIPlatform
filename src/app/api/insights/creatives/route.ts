import { NextRequest } from "next/server";
import { requireClientAccess, handleAuthError, getAccessibleAdAccountIds } from "@/lib/auth/guards";
import { getCreativesList, resolveDateRange, type PresetRange } from "@/modules/insights/insights.service";
import prisma from "@/lib/db/client";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    if (!clientId) return Response.json({ error: "clientId required" }, { status: 400 });

    const session = await requireClientAccess(clientId);
    const allowedIds = await getAccessibleAdAccountIds(session, clientId);

    const preset = (searchParams.get("preset") ?? "last_30d") as PresetRange;
    const range = resolveDateRange(preset);

    const [creatives, client] = await Promise.all([
      getCreativesList(clientId, range, allowedIds),
      prisma.client.findUnique({ where: { id: clientId }, select: { currencyCode: true } }),
    ]);
    const currency = client?.currencyCode ?? "USD";
    return Response.json({ creatives, currency });
  } catch (e) {
    return handleAuthError(e);
  }
}
