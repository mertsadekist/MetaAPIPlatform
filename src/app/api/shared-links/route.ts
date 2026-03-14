import { NextRequest, NextResponse } from "next/server";
import { requireClientAccess, requireAuth, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";
import { logAuditEvent } from "@/lib/audit";
import { z } from "zod";
import crypto from "crypto";

const createSchema = z.object({
  clientId: z.string().min(1),
  label: z.string().max(200).optional(),
  dateRange: z.object({
    preset: z.string().optional(),
    since: z.string().optional(),
    until: z.string().optional(),
  }),
  scope: z.array(z.string()).default(["overview", "campaigns", "creatives"]),
  expiresInDays: z.number().int().min(1).max(365).default(30),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const clientId = searchParams.get("clientId");
    if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });
    await requireClientAccess(clientId);

    const links = await prisma.sharedDashboardLink.findMany({
      where: { clientId, isActive: true },
      include: {
        createdByUser: { select: { id: true, displayName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ links });
  } catch (e) {
    return handleAuthError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();

    let body: unknown;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

    const { clientId, label, dateRange, scope, expiresInDays } = parsed.data;
    await requireClientAccess(clientId);

    const token = crypto.randomBytes(32).toString("hex"); // 64-char hex token
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    const link = await prisma.sharedDashboardLink.create({
      data: {
        clientId,
        createdBy: session.user.id as string,
        token,
        label,
        dateRange,
        scope,
        expiresAt,
      },
    });

    await logAuditEvent({
      eventType: "shared_link.created",
      userId: session.user.id as string,
      clientId,
      entityRefId: link.id,
    });

    const shareUrl = `${process.env.NEXTAUTH_URL ?? ""}/shared/${token}`;

    return NextResponse.json({ link, shareUrl }, { status: 201 });
  } catch (e) {
    return handleAuthError(e);
  }
}
