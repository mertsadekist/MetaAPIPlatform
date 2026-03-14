/**
 * DB-polling Scheduler
 * Picks queued sync_jobs from the DB and dispatches them to the correct handler.
 * Each handler records a SyncRun entry with status, duration, and item count.
 */

import prisma from "@/lib/db/client";
import logger from "@/lib/logger";
import { runAssetDiscovery } from "./jobs/asset-discovery";
import { runHourlySync } from "./jobs/hourly-sync";
import { runDailyReconcile } from "./jobs/daily-reconcile";
import { runBudgetPacing } from "./jobs/budget-pacing";
import { runCreativeFatigue } from "./jobs/creative-fatigue";
import { runCreativeAnalysis } from "./jobs/creative-analysis";

type JobType =
  | "asset_discovery"
  | "hourly_sync"
  | "daily_reconcile"
  | "budget_pacing"
  | "creative_fatigue"
  | "creative_analysis";

const JOB_INTERVALS: Record<JobType, number> = {
  asset_discovery:   6 * 60 * 60 * 1000,   // 6 hours
  hourly_sync:       60 * 60 * 1000,        // 1 hour
  daily_reconcile:   24 * 60 * 60 * 1000,   // 24 hours
  budget_pacing:     60 * 60 * 1000,        // 1 hour
  creative_fatigue:  24 * 60 * 60 * 1000,   // 24 hours
  creative_analysis: 24 * 60 * 60 * 1000,   // 24 hours
};

async function executeJob(jobId: string, jobType: string, clientId: string | null) {
  const log = logger.child({ jobId, jobType, clientId });
  const startedAt = new Date();

  // Mark job as running
  await prisma.syncJob.update({
    where: { id: jobId },
    data: { status: "running", startedAt },
  });

  // Create SyncRun record
  const run = await prisma.syncRun.create({
    data: {
      syncJobId: jobId,
      clientId,
      jobType,
      status: "running",
      startedAt,
    },
  });

  try {
    let result = { success: false, itemsProcessed: 0, errors: [] as string[] };

    if (clientId) {
      switch (jobType as JobType) {
        case "asset_discovery":
          result = await runAssetDiscovery(clientId);
          break;
        case "hourly_sync":
          result = await runHourlySync(clientId);
          break;
        case "daily_reconcile":
          result = await runDailyReconcile(clientId);
          break;
        case "budget_pacing":
          result = await runBudgetPacing(clientId);
          break;
        case "creative_fatigue":
          result = await runCreativeFatigue(clientId);
          break;
        case "creative_analysis":
          result = await runCreativeAnalysis(clientId);
          break;
        default:
          throw new Error(`Unknown job type: ${jobType}`);
      }
    }

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();
    const status = result.success ? "succeeded" : "failed";

    await Promise.all([
      prisma.syncJob.update({
        where: { id: jobId },
        data: { status, completedAt, errorMessage: result.errors.join("; ") || null },
      }),
      prisma.syncRun.update({
        where: { id: run.id },
        data: {
          status,
          completedAt,
          durationMs,
          entitiesProcessed: result.itemsProcessed,
          errorMessage: result.errors.join("; ") || null,
        },
      }),
    ]);

    log.info({ status, durationMs, itemsProcessed: result.itemsProcessed }, "Job complete");

    // Schedule next run
    if (result.success && jobType in JOB_INTERVALS) {
      const nextRun = new Date(Date.now() + JOB_INTERVALS[jobType as JobType]);
      await prisma.syncJob.create({
        data: {
          clientId,
          jobType,
          status: "queued",
          scheduledFor: nextRun,
        },
      });
    }
  } catch (err) {
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();
    const errorMessage = String(err);

    log.error({ error: errorMessage }, "Job failed with exception");

    await Promise.all([
      prisma.syncJob.update({
        where: { id: jobId },
        data: { status: "failed", completedAt, errorMessage },
      }),
      prisma.syncRun.update({
        where: { id: run.id },
        data: { status: "failed", completedAt, durationMs, errorMessage },
      }),
    ]);
  }
}

/**
 * Process the next due job from the queue.
 * Call this on a setInterval every 30 seconds in a background process.
 */
export async function processNextJob(): Promise<void> {
  const job = await prisma.syncJob.findFirst({
    where: {
      status: "queued",
      scheduledFor: { lte: new Date() },
    },
    orderBy: [{ priority: "desc" }, { scheduledFor: "asc" }],
  });

  if (!job) return;

  logger.info({ jobId: job.id, jobType: job.jobType }, "Picked up job");
  await executeJob(job.id, job.jobType, job.clientId ?? null);
}

/**
 * Queue a job for immediate execution.
 */
export async function queueJob(
  jobType: JobType,
  clientId: string,
  scheduledFor?: Date
): Promise<string> {
  const job = await prisma.syncJob.create({
    data: {
      clientId,
      jobType,
      status: "queued",
      scheduledFor: scheduledFor ?? new Date(),
      priority: 10, // manual triggers get higher priority
    },
  });
  return job.id;
}
