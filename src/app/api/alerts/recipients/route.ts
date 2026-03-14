import { NextRequest } from "next/server";
import { requireClientAccess, requirePermission, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";
import { z } from "zod";

const createSchema = z.object({
  clientId: z.string().uuid(),
  channel: z.enum(["whatsapp", "telegram", "email"]),
  identifier: z.string().min(1),
  displayName: z.string().optional(),
  alertTypes: z.array(z.string()).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    if (!clientId) return Response.json({ error: "clientId required" }, { status: 400 });

    await requireClientAccess(clientId);

    const recipients = await prisma.alertRecipient.findMany({
      where: { clientId, isActive: true },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ recipients });
  } catch (e) {
    return handleAuthError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission("CONFIGURE_ALERTS");
    const body = await req.json();
    const input = createSchema.parse(body);

    const recipient = await prisma.alertRecipient.create({
      data: {
        clientId: input.clientId,
        channel: input.channel,
        identifier: input.identifier,
        displayName: input.displayName,
        alertTypes: (input.alertTypes as object) ?? null,
        isActive: true,
      },
    });

    return Response.json({ recipient }, { status: 201 });
  } catch (e) {
    return handleAuthError(e);
  }
}
