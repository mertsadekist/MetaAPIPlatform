import { NextRequest } from "next/server";
import { requireClientAccess, handleAuthError } from "@/lib/auth/guards";
import { getCampaignList, resolveDateRange, type PresetRange } from "@/modules/insights/insights.service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    if (!clientId) return Response.json({ error: "clientId required" }, { status: 400 });

    await requireClientAccess(clientId);

    const preset = (searchParams.get("preset") ?? "last_7d") as PresetRange;
    const range = resolveDateRange(preset);

    const campaigns = await getCampaignList(clientId, range);
    return Response.json({ campaigns });
  } catch (e) {
    return handleAuthError(e);
  }
}
