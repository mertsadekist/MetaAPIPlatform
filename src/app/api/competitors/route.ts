import { NextRequest, NextResponse } from "next/server";
import { requireClientAccess, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";
import { z } from "zod";

const createSchema = z.object({
  clientId: z.string().uuid(),
  competitorName: z.string().min(1).max(200),
  metaPageId: z.string().max(100).nullable().optional(),
  metaPageName: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get("clientId");
    if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });
    await requireClientAccess(clientId);

    const competitors = await prisma.competitorProfile.findMany({
      where: { clientId, isActive: true },
      include: {
        adSnapshots: {
          orderBy: { lastSeenAt: "desc" },
          take: 20,
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ competitors });
  } catch (e) {
    return handleAuthError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

    const { clientId, ...rest } = parsed.data;
    await requireClientAccess(clientId);

    const competitor = await prisma.competitorProfile.create({
      data: { clientId, ...rest },
      include: { adSnapshots: true },
    });

    return NextResponse.json({ competitor }, { status: 201 });
  } catch (e) {
    return handleAuthError(e);
  }
}
