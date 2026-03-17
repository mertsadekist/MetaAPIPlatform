/**
 * Budget Pacing Job
 * Computes month-to-date spend vs. expected spend and projects end-of-month.
 * Runs every hour alongside hourly-sync.
 */

import prisma from "@/lib/db/client";
import logger from "@/lib/logger";
import {
  startOfMonth,
  endOfMonth,
  differenceInDays,
  getDaysInMonth,
} from "date-fns";
import type { JobResult } from "./asset-discovery";

export async function runBudgetPacing(clientId: string): Promise<JobResult> {
  const log = logger.child({ job: "budget-pacing", clientId });
  log.info("Starting budget pacing computation");

  const errors: string[] = [];
  let itemsProcessed = 0;

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const daysInMonth = getDaysInMonth(now);
  const daysElapsed = Math.max(1, differenceInDays(now, monthStart) + 1);
  const daysRemaining = differenceInDays(monthEnd, now);
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const adAccounts = await prisma.adAccount.findMany({
    where: { clientId, isActive: true, isAssigned: true },
  });

  for (const account of adAccounts) {
    try {
      // Sum MTD spend from insight snapshots
      const spendAgg = await prisma.insightSnapshot.aggregate({
        where: {
          clientId,
          adAccountId: account.id,
          entityLevel: "adset",
          dateStart: { gte: monthStart },
          dateStop: { lte: now },
        },
        _sum: { spend: true },
      });

      const spentToDate = Number(spendAgg._sum.spend ?? 0);
      const dailyRunRate = daysElapsed > 0 ? spentToDate / daysElapsed : 0;
      const projectedSpend = spentToDate + dailyRunRate * daysRemaining;

      // Look up KPI target budget for this month
      const kpiTarget = await prisma.clientKpiTarget.findFirst({
        where: { clientId, monthYear },
      });

      const monthBudget = kpiTarget?.targetBudget
        ? Number(kpiTarget.targetBudget)
        : null;

      // Pacing status
      let pacingStatus: "unknown" | "underspend" | "on_track" | "overspend" =
        "unknown";
      let pacingPercent: number | null = null;

      if (monthBudget && monthBudget > 0) {
        const expectedSpend = (monthBudget / daysInMonth) * daysElapsed;
        pacingPercent = (spentToDate / monthBudget) * 100;

        if (spentToDate < expectedSpend * 0.8) {
          pacingStatus = "underspend";
        } else if (spentToDate > expectedSpend * 1.2) {
          pacingStatus = "overspend";
        } else {
          pacingStatus = "on_track";
        }
      }

      await prisma.budgetPacingSnapshot.create({
        data: {
          clientId,
          adAccountId: account.id,
          snapshotDate: now,
          month: monthStart,
          monthBudget,
          spentToDate,
          projectedSpend,
          pacingStatus,
          pacingPercent,
          daysElapsed,
          daysRemaining,
          dailyRunRate,
        },
      });

      itemsProcessed++;
      log.debug(
        { accountId: account.metaAdAccountId, pacingStatus, spentToDate },
        "Pacing snapshot created"
      );
    } catch (e) {
      const msg = `Account ${account.metaAdAccountId}: ${String(e)}`;
      errors.push(msg);
      log.error({ error: String(e), accountId: account.metaAdAccountId }, "Budget pacing error");
    }
  }

  log.info({ itemsProcessed, errorCount: errors.length }, "Budget pacing complete");
  return { success: errors.length === 0, itemsProcessed, errors };
}
