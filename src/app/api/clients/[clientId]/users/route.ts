import { NextRequest, NextResponse } from "next/server";
import { requireRole, handleAuthError } from "@/lib/auth/guards";
import { clientService } from "@/modules/clients/client.service";
import { assignUserSchema } from "@/modules/clients/client.schema";
import { logAuditEvent } from "@/lib/audit";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    await requireRole(["owner"]);
    const users = await clientService.listUsers(clientId);
    return NextResponse.json(users);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const session = await requireRole(["owner"]);
    const body = await req.json();
    const data = assignUserSchema.parse(body);

    const access = await clientService.assignUser(clientId, data);

    await logAuditEvent({
      eventType: "client.user_assigned",
      userId: session.user?.id ?? undefined,
      clientId,
      entityRefId: data.userId,
      eventScope: "clients",
      metadata: { accessLevel: data.accessLevel },
    });

    return NextResponse.json(access, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const session = await requireRole(["owner"]);
    const { userId } = await req.json();

    await clientService.removeUser(clientId, userId);

    await logAuditEvent({
      eventType: "client.user_removed",
      userId: session.user?.id ?? undefined,
      clientId,
      entityRefId: userId,
      eventScope: "clients",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
