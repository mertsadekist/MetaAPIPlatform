import { NextRequest, NextResponse } from "next/server";
import {
  requireClientAccess,
  requireRole,
  handleAuthError,
} from "@/lib/auth/guards";
import { clientService } from "@/modules/clients/client.service";
import { updateClientSchema } from "@/modules/clients/client.schema";
import { logAuditEvent } from "@/lib/audit";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    await requireClientAccess(clientId);
    const client = await clientService.getClient(clientId);
    if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(client);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const session = await requireRole(["owner"]);
    const body = await req.json();
    const data = updateClientSchema.parse(body);

    const client = await clientService.updateClient(clientId, data);

    await logAuditEvent({
      eventType: "client.updated",
      userId: session.user?.id ?? undefined,
      entityRefId: clientId,
      eventScope: "clients",
    });

    return NextResponse.json(client);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const session = await requireRole(["owner"]);
    await clientService.deleteClient(clientId);

    await logAuditEvent({
      eventType: "client.deleted",
      userId: session.user?.id ?? undefined,
      entityRefId: clientId,
      eventScope: "clients",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
