import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";
import { z } from "zod";

const updateSchema = z.object({
  content: z.string().min(1).max(10000).optional(),
  isPinned: z.boolean().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const session = await requireAuth();
    const { noteId } = await params;

    const note = await prisma.campaignNote.findUnique({ where: { id: noteId } });
    if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (note.authorId !== (session.user.id as string)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: unknown;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

    const updated = await prisma.campaignNote.update({
      where: { id: noteId },
      data: parsed.data,
      include: { author: { select: { id: true, displayName: true, email: true } } },
    });

    return NextResponse.json({ note: updated });
  } catch (e) {
    return handleAuthError(e);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const session = await requireAuth();
    const { noteId } = await params;

    const note = await prisma.campaignNote.findUnique({ where: { id: noteId } });
    if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (note.authorId !== (session.user.id as string)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.campaignNote.delete({ where: { id: noteId } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return handleAuthError(e);
  }
}
