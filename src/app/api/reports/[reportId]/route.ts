import { NextRequest, NextResponse } from "next/server";
import { requireClientAccess, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const { reportId } = await params;
    const report = await prisma.report.findUnique({ where: { id: reportId } });
    if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await requireClientAccess(report.clientId);
    return NextResponse.json({ report });
  } catch (e) {
    return handleAuthError(e);
  }
}
