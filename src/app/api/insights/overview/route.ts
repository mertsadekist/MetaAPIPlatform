import { NextRequest } from "next/server";
import { requireClientAccess, handleAuthError } from "@/lib/auth/guards";
import { getClientOverview, resolveDateRange, type PresetRange } from "@/modules/insights/insights.service";
import prisma from "@/lib/db/client";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    if (!clientId) return Response.json({ error: "clientId required" }, { status: 400 });

    await requireClientAccess(clientId);

    const preset = (searchParams.get("preset") ?? "last_7d") as PresetRange;
    const since = searchParams.get("since");
    const until = searchParams.get("until");

    const range = since && until
      ? { since: new Date(since), until: new Date(until) }
      : resolveDateRange(preset);

    const [overview, assignedAccount] = await Promise.all([
      getClientOverview(clientId, range),
      prisma.adAccount.findFirst({
        where: { clientId, isAssigned: true },
        select: { currency: true },
        orderBy: { name: "asc" },
      }),
    ]);
    const currency = assignedAccount?.currency ?? "USD";
    return Response.json({ overview: { ...overview, currency } });
  } catch (e) {
    return handleAuthError(e);
  }
}
