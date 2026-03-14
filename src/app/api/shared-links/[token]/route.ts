import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";
import { logAuditEvent } from "@/lib/audit";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const session = await requireAuth();
    const { token } = await params;

    const link = await prisma.sharedDashboardLink.findUnique({ where: { token } });
    if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.sharedDashboardLink.update({
      where: { token },
      data: { isActive: false },
    });

    await logAuditEvent({
      eventType: "shared_link.deleted",
      userId: session.user.id as string,
      clientId: link.clientId,
      entityRefId: link.id,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    return handleAuthError(e);
  }
}
