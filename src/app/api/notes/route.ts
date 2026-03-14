import { NextRequest, NextResponse } from "next/server";
import { requireClientAccess, requireAuth, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";
import { z } from "zod";

const createSchema = z.object({
  clientId: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  content: z.string().min(1).max(10000),
  isPinned: z.boolean().optional().default(false),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const clientId = searchParams.get("clientId");
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");

    if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });
    await requireClientAccess(clientId);

    const where: Record<string, unknown> = { clientId };
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;

    const notes = await prisma.campaignNote.findMany({
      where,
      include: {
        author: { select: { id: true, displayName: true, email: true } },
      },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ notes });
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

    const { clientId, entityType, entityId, content, isPinned } = parsed.data;
    await requireClientAccess(clientId);

    const note = await prisma.campaignNote.create({
      data: {
        clientId,
        entityType,
        entityId,
        content,
        isPinned,
        authorId: session.user.id as string,
      },
      include: {
        author: { select: { id: true, displayName: true, email: true } },
      },
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (e) {
    return handleAuthError(e);
  }
}
