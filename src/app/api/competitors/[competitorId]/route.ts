import { NextRequest, NextResponse } from "next/server";
import { requireClientAccess, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";
import { z } from "zod";

const updateSchema = z.object({
  competitorName: z.string().min(1).max(200).optional(),
  metaPageId: z.string().max(100).nullable().optional(),
  metaPageName: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ competitorId: string }> }
) {
  try {
    const { competitorId } = await params;
    const competitor = await prisma.competitorProfile.findUnique({ where: { id: competitorId } });
    if (!competitor) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await requireClientAccess(competitor.clientId);

    let body: unknown;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

    const updated = await prisma.competitorProfile.update({
      where: { id: competitorId },
      data: parsed.data,
      include: { adSnapshots: { orderBy: { lastSeenAt: "desc" }, take: 20 } },
    });

    return NextResponse.json({ competitor: updated });
  } catch (e) {
    return handleAuthError(e);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ competitorId: string }> }
) {
  try {
    const { competitorId } = await params;
    const competitor = await prisma.competitorProfile.findUnique({ where: { id: competitorId } });
    if (!competitor) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await requireClientAccess(competitor.clientId);

    // Soft delete
    await prisma.competitorProfile.update({
      where: { id: competitorId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    return handleAuthError(e);
  }
}
