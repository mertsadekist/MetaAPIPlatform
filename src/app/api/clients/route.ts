import { NextRequest, NextResponse } from "next/server";
import { requireRole, requireAuth, handleAuthError } from "@/lib/auth/guards";
import { clientService } from "@/modules/clients/client.service";
import { createClientSchema } from "@/modules/clients/client.schema";
import { logAuditEvent } from "@/lib/audit";
import logger from "@/lib/logger";

export async function GET() {
  try {
    const session = await requireAuth();
    const clients = await clientService.listClients(
      session.user?.id ?? undefined,
      (session.user as any).role
    );
    return NextResponse.json(clients);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(["owner"]);
    const body = await req.json();
    const data = createClientSchema.parse(body);

    const client = await clientService.createClient(data);

    await logAuditEvent({
      eventType: "client.created",
      userId: session.user?.id ?? undefined,
      entityRefId: client.id,
      eventScope: "clients",
      metadata: { displayName: client.displayName },
    });

    logger.info({ clientId: client.id }, "Client created");
    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Invalid input", details: error.message }, { status: 400 });
    }
    return handleAuthError(error);
  }
}
