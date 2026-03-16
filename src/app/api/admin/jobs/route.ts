import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";

/**
 * GET /api/admin/jobs
 * Lists all sync jobs with latest run info.
 */
export async function GET() {
  try {
    await requirePermission("TRIGGER_SYNC");

    const jobs = await prisma.syncJob.findMany({
      orderBy: { scheduledFor: "asc" },
    });

    // Get latest run for each job
    const runMap = new Map<string, { status: string; completedAt: Date | null; durationMs: number | null }>();
    if (jobs.length > 0) {
      const jobIds = jobs.map((j) => j.id);
      const runs = await prisma.syncRun.findMany({
        where: { syncJobId: { in: jobIds } },
        orderBy: { startedAt: "desc" },
        select: { syncJobId: true, status: true, completedAt: true, durationMs: true },
      });
      for (const r of runs) {
        if (r.syncJobId && !runMap.has(r.syncJobId)) {
          runMap.set(r.syncJobId, {
            status: r.status,
            completedAt: r.completedAt,
            durationMs: r.durationMs,
          });
        }
      }
    }

    const result = jobs.map((j) => ({
      ...j,
      latestRun: runMap.get(j.id) ?? null,
    }));

    return NextResponse.json({ jobs: result });
  } catch (e) {
    return handleAuthError(e);
  }
}

/**
 * POST /api/admin/jobs
 * Trigger a manual sync job for a client.
 * Body: { clientId, jobType }
 */
export async function POST(req: NextRequest) {
  try {
    await requirePermission("TRIGGER_SYNC");
    const { clientId, jobType } = await req.json();

    if (!jobType) {
      return NextResponse.json({ error: "Missing jobType" }, { status: 400 });
    }

    const validJobTypes = [
      "asset_discovery",
      "hourly_sync",
      "daily_reconcile",
      "budget_pacing",
      "creative_fatigue",
      "creative_analysis",
      "alert_dispatch",
    ];
    if (!validJobTypes.includes(jobType)) {
      return NextResponse.json({ error: "Invalid jobType" }, { status: 400 });
    }

    // Global jobs don't need clientId
    const globalJobs = ["alert_dispatch"];
    if (!globalJobs.includes(jobType) && !clientId) {
      return NextResponse.json({ error: "clientId required for this job type" }, { status: 400 });
    }

    // Queue the job
    const job = await prisma.syncJob.create({
      data: {
        clientId: clientId ?? null,
        jobType,
        status: "queued",
        scheduledFor: new Date(),
      },
    });

    return NextResponse.json({ success: true, job });
  } catch (e) {
    return handleAuthError(e);
  }
}
