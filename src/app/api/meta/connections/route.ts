import { NextRequest } from "next/server";
import { requireClientAccess, handleAuthError } from "@/lib/auth/guards";
import { metaService } from "@/modules/meta/meta.service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    if (!clientId) {
      return Response.json({ error: "clientId required" }, { status: 400 });
    }
    await requireClientAccess(clientId);
    const connections = await metaService.listConnections(clientId);
    return Response.json({ connections });
  } catch (e) {
    return handleAuthError(e);
  }
}
