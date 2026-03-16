import { NextRequest, NextResponse } from "next/server";
import { requireClientAccess, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";

/**
 * GET /api/leads/export?clientId=...&status=...&since=...&until=...
 * Streams all matching leads as a CSV file.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId") ?? "";
    const status = searchParams.get("status") ?? undefined;
    const since = searchParams.get("since") ?? undefined;
    const until = searchParams.get("until") ?? undefined;

    await requireClientAccess(clientId);

    const where: Record<string, unknown> = { clientId };
    if (status && status !== "all") where.qualityStatus = status;
    if (since || until) {
      where.receivedAt = {
        ...(since ? { gte: new Date(since) } : {}),
        ...(until ? { lte: new Date(until + "T23:59:59Z") } : {}),
      };
    }

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        leadSource: true,
        qualityStatus: true,
        qualityNote: true,
        receivedAt: true,
        createdAt: true,
        campaign: { select: { name: true } },
        ad: { select: { name: true } },
      },
      take: 10000, // hard cap
    });

    const escape = (v: string | null | undefined) => {
      if (v == null) return "";
      const s = String(v);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const headers = [
      "ID",
      "Name",
      "Email",
      "Phone",
      "Lead Source",
      "Quality Status",
      "Quality Note",
      "Campaign",
      "Ad",
      "Received At",
      "Created At",
    ];

    const rows = leads.map((l) => [
      l.id,
      l.name,
      l.email,
      l.phone,
      l.leadSource,
      l.qualityStatus,
      l.qualityNote,
      l.campaign?.name,
      l.ad?.name,
      l.receivedAt ? new Date(l.receivedAt).toISOString() : "",
      l.createdAt ? new Date(l.createdAt).toISOString() : "",
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map(escape).join(","))
      .join("\r\n");

    const date = new Date().toISOString().slice(0, 10);
    const filename = `leads-${clientId.slice(0, 8)}-${date}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return handleAuthError(e);
  }
}
