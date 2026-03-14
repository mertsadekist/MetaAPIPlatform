import { NextRequest, NextResponse } from "next/server";
import { requireClientAccess, requirePermission, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";
import { z } from "zod";

const upsertSchema = z.object({
  monthYear: z.string().regex(/^\d{4}-\d{2}$/),
  targetLeads: z.number().int().positive().nullable().optional(),
  targetBudget: z.number().positive().nullable().optional(),
  targetCpl: z.number().positive().nullable().optional(),
  targetRoas: z.number().positive().nullable().optional(),
  targetCpql: z.number().positive().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    await requireClientAccess(clientId);
    const targets = await prisma.clientKpiTarget.findMany({
      where: { clientId },
      orderBy: { monthYear: "desc" },
      take: 13,
    });
    return NextResponse.json({ targets });
  } catch (e) {
    return handleAuthError(e);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    await requirePermission("CONFIGURE_ALERTS", clientId);
    let body: unknown;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
    const parsed = upsertSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    const { monthYear, ...rest } = parsed.data;
    const target = await prisma.clientKpiTarget.upsert({
      where: { clientId_monthYear: { clientId, monthYear } },
      create: { clientId, monthYear, ...rest },
      update: rest,
    });
    return NextResponse.json({ target });
  } catch (e) {
    return handleAuthError(e);
  }
}
