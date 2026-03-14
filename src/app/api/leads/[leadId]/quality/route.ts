import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";
import { z } from "zod";

const schema = z.object({
  qualityStatus: z.enum(["new", "contacted", "qualified", "unqualified", "converted", "duplicate"]),
  qualityNote: z.string().max(2000).optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const session = await requireAuth();
    const { leadId } = await params;
    let body: unknown;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

    const lead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        qualityStatus: parsed.data.qualityStatus,
        qualityNote: parsed.data.qualityNote,
        qualityUpdatedAt: new Date(),
        qualityUpdatedById: session.user.id as string,
      },
    });
    return NextResponse.json({ lead });
  } catch (e) {
    return handleAuthError(e);
  }
}
