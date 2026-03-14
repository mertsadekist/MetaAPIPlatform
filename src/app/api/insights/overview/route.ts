import { NextRequest } from "next/server";
import { requireClientAccess, handleAuthError } from "@/lib/auth/guards";
import { getClientOverview, resolveDateRange, type PresetRange } from "@/modules/insights/insights.service";

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

    const overview = await getClientOverview(clientId, range);
    return Response.json({ overview });
  } catch (e) {
    return handleAuthError(e);
  }
}
