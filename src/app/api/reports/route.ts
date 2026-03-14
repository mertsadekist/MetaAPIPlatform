import { NextRequest, NextResponse } from "next/server";
import { requireClientAccess, requirePermission, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";
import { z } from "zod";

const generateSchema = z.object({
  clientId: z.string().min(1),
  reportType: z.enum(["daily", "weekly", "monthly"]),
  since: z.string(),
  until: z.string(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const clientId = searchParams.get("clientId");
    if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });
    await requireClientAccess(clientId);

    const reports = await prisma.report.findMany({
      where: { clientId },
      select: {
        id: true, reportType: true, dateRangeJson: true,
        status: true, generatedAt: true, sentAt: true,
        recipientCount: true, errorMessage: true, createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    return NextResponse.json({ reports });
  } catch (e) {
    return handleAuthError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

    const { clientId, reportType, since, until } = parsed.data;
    await requirePermission("TRIGGER_SYNC", clientId);

    const report = await prisma.report.create({
      data: {
        clientId,
        reportType,
        dateRangeJson: { since, until },
        status: "queued",
      },
    });

    // Async generation — run inline for now (could be queued via scheduler)
    generateReport(report.id, clientId, since, until).catch(console.error);

    return NextResponse.json({ report }, { status: 202 });
  } catch (e) {
    return handleAuthError(e);
  }
}

// Inline report generator (runs async)
async function generateReport(reportId: string, clientId: string, since: string, until: string) {
  try {
    await prisma.report.update({ where: { id: reportId }, data: { status: "generating" } });

    const range = { since: new Date(since), until: new Date(until) };

    const [overview, campaigns] = await Promise.all([
      prisma.insightSnapshot.aggregate({
        where: { clientId, entityLevel: "adset", dateStart: { gte: range.since, lte: range.until } },
        _sum: { spend: true, leads: true, clicks: true, impressions: true, messagesStarted: true },
      }),
      prisma.campaign.findMany({
        where: { clientId },
        include: { adAccount: { select: { name: true } } },
      }),
    ]);

    const spend = Number(overview._sum.spend ?? 0);
    const leads = Number(overview._sum.leads ?? 0);

    const summaryJson = {
      spend,
      leads,
      clicks: Number(overview._sum.clicks ?? 0),
      impressions: Number(overview._sum.impressions ?? 0),
      cpl: leads > 0 ? spend / leads : null,
      campaignCount: campaigns.length,
      since,
      until,
    };

    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: "completed",
        generatedAt: new Date(),
        summaryJson,
        htmlContent: buildReportHtml(summaryJson, since, until),
      },
    });
  } catch (err) {
    await prisma.report.update({
      where: { id: reportId },
      data: { status: "failed", errorMessage: String(err) },
    });
  }
}

function buildReportHtml(summary: Record<string, unknown>, since: string, until: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Performance Report ${since} – ${until}</title>
<style>body{font-family:system-ui,sans-serif;color:#111;max-width:700px;margin:32px auto;padding:0 16px}
h1{font-size:22px;font-weight:700}
.kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:24px 0}
.kpi{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px}
.kpi-label{font-size:12px;color:#6b7280}
.kpi-value{font-size:22px;font-weight:700;margin-top:4px}
</style></head>
<body>
<h1>Performance Report</h1>
<p style="color:#6b7280">${since} – ${until}</p>
<div class="kpi-grid">
  <div class="kpi"><div class="kpi-label">Total Spend</div><div class="kpi-value">$${Number(summary.spend).toLocaleString(undefined,{maximumFractionDigits:0})}</div></div>
  <div class="kpi"><div class="kpi-label">Leads</div><div class="kpi-value">${Number(summary.leads).toLocaleString()}</div></div>
  <div class="kpi"><div class="kpi-label">CPL</div><div class="kpi-value">${summary.cpl !== null ? `$${Number(summary.cpl).toFixed(2)}` : '—'}</div></div>
  <div class="kpi"><div class="kpi-label">Clicks</div><div class="kpi-value">${Number(summary.clicks).toLocaleString()}</div></div>
  <div class="kpi"><div class="kpi-label">Impressions</div><div class="kpi-value">${Number(summary.impressions).toLocaleString()}</div></div>
  <div class="kpi"><div class="kpi-label">Campaigns</div><div class="kpi-value">${Number(summary.campaignCount)}</div></div>
</div>
</body></html>`;
}
