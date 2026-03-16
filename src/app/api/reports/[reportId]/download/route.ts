import { NextRequest, NextResponse } from "next/server";
import { requireClientAccess, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";

/**
 * GET /api/reports/[reportId]/download
 * Returns the report HTML as a downloadable file.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const { reportId } = await params;
    const report = await prisma.report.findUnique({ where: { id: reportId } });
    if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await requireClientAccess(report.clientId);

    if (!report.htmlContent) {
      return NextResponse.json({ error: "Report content not yet available" }, { status: 404 });
    }

    // Build a safe filename from reportType
    const title = (report.reportType ?? "report")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const dateStr = report.createdAt
      ? new Date(report.createdAt).toISOString().slice(0, 10)
      : "unknown";
    const filename = `${title}-${dateStr}.html`;

    return new NextResponse(report.htmlContent, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return handleAuthError(e);
  }
}
