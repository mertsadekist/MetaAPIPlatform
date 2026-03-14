import { NextRequest } from "next/server";
import { requireClientAccess, handleAuthError } from "@/lib/auth/guards";
import { getCreativesList, resolveDateRange, type PresetRange } from "@/modules/insights/insights.service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    if (!clientId) return Response.json({ error: "clientId required" }, { status: 400 });

    await requireClientAccess(clientId);

    const preset = (searchParams.get("preset") ?? "last_30d") as PresetRange;
    const range = resolveDateRange(preset);

    const creatives = await getCreativesList(clientId, range);
    return Response.json({ creatives });
  } catch (e) {
    return handleAuthError(e);
  }
}
