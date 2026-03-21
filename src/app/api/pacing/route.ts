import { NextRequest } from "next/server";
import { requireClientAccess, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";
import {
  startOfMonth, endOfMonth, differenceInDays, getDaysInMonth,
} from "date-fns";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    if (!clientId) {
      return Response.json({ error: "clientId required" }, { status: 400 });
    }

    await requireClientAccess(clientId);

    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // ── Path A: Real BudgetPacingSnapshot records exist ──
    const snapshots = await prisma.budgetPacingSnapshot.findMany({
      where: {
        clientId,
        month: { gte: monthStart, lte: monthEnd },
      },
      include: {
        adAccount: { select: { metaAdAccountId: true, name: true, currency: true } },
      },
      orderBy: { createdAt: "desc" },
      distinct: ["adAccountId"],
    });

    if (snapshots.length > 0) {
      return Response.json({ snapshots });
    }

    // ── Path B: Compute synthetic pacing from InsightSnapshot ──
    const adAccounts = await prisma.adAccount.findMany({
      where: { clientId, isActive: true, isAssigned: true },
    });

    if (adAccounts.length === 0) {
      return Response.json({ snapshots: [] });
    }

    const daysInMonth = getDaysInMonth(now);
    const daysElapsed = Math.max(1, differenceInDays(now, monthStart) + 1);
    const daysRemaining = Math.max(0, differenceInDays(monthEnd, now));
    const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const syntheticSnapshots = await Promise.all(
      adAccounts.map(async (account) => {
        // MTD spend from InsightSnapshot
        const spendAgg = await prisma.insightSnapshot.aggregate({
          where: {
            clientId,
            adAccountId: account.id,
            entityLevel: "adset",
            dateStart: { gte: monthStart, lte: now },
          },
          _sum: { spend: true },
        });

        const spentToDate = Number(spendAgg._sum.spend ?? 0);
        const dailyRunRate = daysElapsed > 0 ? spentToDate / daysElapsed : 0;
        const projectedSpend = spentToDate + dailyRunRate * daysRemaining;

        // KPI target budget for this month
        const kpiTarget = await prisma.clientKpiTarget.findFirst({
          where: { clientId, monthYear },
        });
        const monthBudget = kpiTarget?.targetBudget ? Number(kpiTarget.targetBudget) : null;

        // Pacing status
        let pacingStatus = "no_budget";
        let pacingPercent: number | null = null;
        if (monthBudget && monthBudget > 0) {
          const expectedSpend = (monthBudget / daysInMonth) * daysElapsed;
          pacingPercent = (spentToDate / monthBudget) * 100;
          if (spentToDate < expectedSpend * 0.8) {
            pacingStatus = "underpacing";
          } else if (spentToDate > expectedSpend * 1.2) {
            pacingStatus = "overpacing";
          } else {
            pacingStatus = "on_track";
          }
        }

        return {
          id: `synthetic-${account.id}`,
          clientId,
          adAccountId: account.id,
          pacingStatus,
          pacingPercent,
          monthBudget,
          spentToDate,
          projectedSpend,
          dailyRunRate,
          daysElapsed,
          daysRemaining,
          snapshotDate: now.toISOString(),
          adAccount: {
            metaAdAccountId: account.metaAdAccountId,
            name: account.name,
            currency: account.currency,
          },
        };
      })
    );

    return Response.json({ snapshots: syntheticSnapshots });
  } catch (e) {
    return handleAuthError(e);
  }
}
