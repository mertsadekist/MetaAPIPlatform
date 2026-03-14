/**
 * Creative Fatigue Job
 * Computes 7-day rolling fatigue signals for all active creatives.
 * Runs daily. Triggers instant alerts for severe fatigue.
 */

import prisma from "@/lib/db/client";
import logger from "@/lib/logger";
import { computeFatigue } from "@/lib/fatigue/creative-fatigue.engine";
import { subDays, startOfDay } from "date-fns";
import type { JobResult } from "./asset-discovery";

const MIN_IMPRESSIONS = 1_000;

export async function runCreativeFatigue(clientId: string): Promise<JobResult> {
  const log = logger.child({ job: "creative-fatigue", clientId });
  log.info("Starting creative fatigue analysis");

  const errors: string[] = [];
  let itemsProcessed = 0;

  const now = new Date();
  const day7ago = startOfDay(subDays(now, 7));
  const day14ago = startOfDay(subDays(now, 14));

  // Get all unique creatives that have insight data
  const adCreatives = await prisma.adCreative.findMany({
    where: { clientId },
    select: { id: true, ads: { select: { campaignId: true } } },
  });

  for (const creative of adCreatives) {
    try {
      const campaignId = creative.ads[0]?.campaignId;
      if (!campaignId) continue;

      // Aggregate last 7 days
      const last7 = await prisma.insightSnapshot.aggregate({
        where: {
          clientId,
          creativeId: creative.id,
          granularity: "daily",
          dateStart: { gte: day7ago },
        },
        _sum: { impressions: true, reach: true, clicks: true, spend: true },
        _avg: { frequency: true, ctr: true },
      });

      const impressions7d = Number(last7._sum.impressions ?? 0);
      if (impressions7d < MIN_IMPRESSIONS) continue;

      // Aggregate previous 7 days (days 8–14)
      const prev7 = await prisma.insightSnapshot.aggregate({
        where: {
          clientId,
          creativeId: creative.id,
          granularity: "daily",
          dateStart: { gte: day14ago, lt: day7ago },
        },
        _avg: { frequency: true, ctr: true },
        _sum: { reach: true },
      });

      const result = computeFatigue({
        frequency7d: Number(last7._avg.frequency ?? 0),
        ctr7d: Number(last7._avg.ctr ?? 0),
        ctrPrev7d: Number(prev7._avg.ctr ?? 0),
        reach7d: Number(last7._sum.reach ?? 0),
        reachPrev7d: Number(prev7._sum.reach ?? 0),
        impressions7d,
      });

      await prisma.creativeFatigueSignal.create({
        data: {
          clientId,
          creativeId: creative.id,
          campaignId,
          signalDate: now,
          frequency: result.signals.frequencyHigh ? last7._avg.frequency : null,
          ctr7dAvg: last7._avg.ctr,
          ctrPrev7dAvg: prev7._avg.ctr,
          ctrDropPct: result.ctrDropPct,
          fatigueScore: result.fatigueScore,
          fatigueLevel: result.fatigueLevel,
        },
      });

      // Instant alert for severe fatigue
      if (result.fatigueLevel === "severe") {
        await prisma.instantAlert.create({
          data: {
            clientId,
            alertType: "creative_fatigue_severe",
            severity: "critical",
            title: "Creative Exhaustion — Immediate Action Needed",
            message: result.recommendation,
            status: "pending",
            metadata: {
              creativeId: creative.id,
              campaignId,
              fatigueScore: result.fatigueScore,
            } as object,
          },
        });
      }

      itemsProcessed++;
    } catch (e) {
      const msg = `Creative ${creative.id}: ${String(e)}`;
      errors.push(msg);
      log.error({ creativeId: creative.id, error: String(e) }, "Fatigue computation error");
    }
  }

  log.info({ itemsProcessed, errorCount: errors.length }, "Creative fatigue complete");
  return { success: errors.length === 0, itemsProcessed, errors };
}
