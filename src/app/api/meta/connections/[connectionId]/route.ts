import { NextRequest } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/auth/guards";
import { metaService } from "@/modules/meta/meta.service";

type Params = { params: Promise<{ connectionId: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("MANAGE_META_CONNECTIONS");
    const { connectionId } = await params;
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    if (!clientId) {
      return Response.json({ error: "clientId required" }, { status: 400 });
    }
    await metaService.disconnect(connectionId, clientId, session.user.id as string);
    return Response.json({ success: true });
  } catch (e) {
    return handleAuthError(e);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await requirePermission("MANAGE_META_CONNECTIONS");
    const { connectionId } = await params;
    const result = await metaService.revalidate(connectionId, session.user.id as string);
    return Response.json(result);
  } catch (e) {
    return handleAuthError(e);
  }
}
