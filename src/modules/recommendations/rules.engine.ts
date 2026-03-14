/**
 * Rules-based Recommendation Engine
 * Evaluates all rule definitions against current client data and generates recommendations.
 */

import prisma from "@/lib/db/client";
import logger from "@/lib/logger";
import { subDays, startOfMonth } from "date-fns";

const MIN_LEADS = 5;
const THRESHOLD_LOW_CTR = 0.008; // 0.8%

interface RuleResult {
  ruleId: string;
  entityLevel: string;
  entityId: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  suggestion: string;
  evidenceJson: object;
  expectedEffect?: string;
}

export async function runRulesEngine(clientId: string): Promise<{ generated: number; skipped: number }> {
  const log = logger.child({ job: "rules-engine", clientId });
  log.info("Running recommendations rules engine");

  const results: RuleResult[] = [];
  const now = new Date();
  const day7ago = subDays(now, 7);
  const day14ago = subDays(now, 14);
  const monthStart = startOfMonth(now);

  // ── Fetch data ───────────────────────────────────────────────────────
  const adAccounts = await prisma.adAccount.findMany({
    where: { clientId, isActive: true },
  });

  const campaigns = await prisma.campaign.findMany({
    where: { clientId, effectiveStatus: "ACTIVE" },
    include: { adAccount: true },
  });

  const latestPacing = await prisma.budgetPacingSnapshot.findMany({
    where: {
      clientId,
      month: { gte: monthStart },
    },
    distinct: ["adAccountId"],
    orderBy: { createdAt: "desc" },
  });

  const fatigueSignals = await prisma.creativeFatigueSignal.findMany({
    where: {
      clientId,
      signalDate: { gte: subDays(now, 1) },
      fatigueLevel: { in: ["moderate", "severe"] },
    },
  });

  // ── Rule: Spend Anomaly ───────────────────────────────────────────────
  for (const account of adAccounts) {
    // Today's spend
    const todayAgg = await prisma.insightSnapshot.aggregate({
      where: { clientId, adAccountId: account.id, entityLevel: "adset", dateStart: { gte: subDays(now, 1) } },
      _sum: { spend: true },
    });
    const todaySpend = Number(todayAgg._sum.spend ?? 0);

    // 30-day daily average
    const monthAgg = await prisma.insightSnapshot.aggregate({
      where: { clientId, adAccountId: account.id, entityLevel: "adset", dateStart: { gte: subDays(now, 30) } },
      _sum: { spend: true },
    });
    const avgDailySpend = Number(monthAgg._sum.spend ?? 0) / 30;

    if (avgDailySpend > 0 && todaySpend > avgDailySpend * 3) {
      results.push({
        ruleId: "SPEND_ANOMALY_HIGH",
        entityLevel: "account",
        entityId: account.id,
        severity: "critical",
        title: "Abnormal Spend Spike Detected",
        evidenceJson: { todaySpend, avgDailySpend: avgDailySpend.toFixed(2), ratio: `${(todaySpend / avgDailySpend).toFixed(1)}x` },
        suggestion: `Spend today ($${todaySpend.toFixed(0)}) is ${(todaySpend / avgDailySpend).toFixed(1)}x the 30-day daily average. Review campaign settings and Meta billing immediately.`,
        expectedEffect: "Prevents unexpected overspend and billing surprises.",
      });
    }

    if (account.isActive && todaySpend === 0 && now.getHours() >= 10) {
      results.push({
        ruleId: "SPEND_ANOMALY_ZERO",
        entityLevel: "account",
        entityId: account.id,
        severity: "critical",
        title: "Active Account Not Spending",
        evidenceJson: { accountId: account.metaAdAccountId },
        suggestion: "No spend detected after 10 AM for an active account. Check campaign status, budget, and audience size.",
      });
    }
  }

  // ── Rule: Budget Pacing ───────────────────────────────────────────────
  for (const pacing of latestPacing) {
    if (pacing.pacingStatus === "underspend" && pacing.monthBudget) {
      const projectedSpend = Number(pacing.projectedSpend ?? 0);
      const budget = Number(pacing.monthBudget);
      const underspendPct = ((budget - projectedSpend) / budget) * 100;

      if (underspendPct > 25) {
        results.push({
          ruleId: "BUDGET_PACING_RISK",
          entityLevel: "account",
          entityId: pacing.adAccountId,
          severity: "medium",
          title: "Monthly Budget at Risk of Underspend",
          evidenceJson: { projectedSpend: projectedSpend.toFixed(0), budget: budget.toFixed(0), underspendPct: underspendPct.toFixed(0) },
          suggestion: `At current pace, you'll spend $${projectedSpend.toFixed(0)} of $${budget.toFixed(0)} this month (${underspendPct.toFixed(0)}% shortfall). Review bid caps and audience constraints.`,
        });
      }
    }
  }

  // ── Rule: CPL Deterioration & Creative Fatigue ────────────────────────
  for (const campaign of campaigns) {
    const recent = await prisma.insightSnapshot.aggregate({
      where: { clientId, campaignId: campaign.id, entityLevel: "adset", dateStart: { gte: day7ago } },
      _sum: { spend: true, leads: true },
    });
    const prev = await prisma.insightSnapshot.aggregate({
      where: { clientId, campaignId: campaign.id, entityLevel: "adset", dateStart: { gte: day14ago, lt: day7ago } },
      _sum: { spend: true, leads: true },
    });

    const currentSpend = Number(recent._sum.spend ?? 0);
    const currentLeads = Number(recent._sum.leads ?? 0);
    const prevSpend = Number(prev._sum.spend ?? 0);
    const prevLeads = Number(prev._sum.leads ?? 0);

    const currentCpl = currentLeads > 0 ? currentSpend / currentLeads : null;
    const prevCpl = prevLeads > 0 ? prevSpend / prevLeads : null;

    if (currentCpl && prevCpl && currentLeads >= MIN_LEADS) {
      const cplDelta = (currentCpl - prevCpl) / prevCpl;

      if (cplDelta > 0.2) {
        results.push({
          ruleId: "CPL_DETERIORATION",
          entityLevel: "campaign",
          entityId: campaign.id,
          severity: "high",
          title: "CPL Efficiency Declining",
          evidenceJson: { currentCpl: currentCpl.toFixed(2), prevCpl: prevCpl.toFixed(2), cplDelta: `+${(cplDelta * 100).toFixed(0)}%` },
          suggestion: "Review creative fatigue and audience saturation. Consider rotating creatives or expanding targeting.",
          expectedEffect: "10–25% CPL reduction with fresh creative.",
        });
      }
    }

    // Wasted scale risk
    if (prevSpend > 0 && currentSpend > 0) {
      const spendDelta = (currentSpend - prevSpend) / prevSpend;
      const leadDelta = prevLeads > 0 ? (currentLeads - prevLeads) / prevLeads : 0;

      if (spendDelta > 0.15 && leadDelta < 0.05) {
        results.push({
          ruleId: "WASTED_SCALE_RISK",
          entityLevel: "campaign",
          entityId: campaign.id,
          severity: "high",
          title: "Budget Scaling Not Converting to Leads",
          evidenceJson: { spendDelta: `+${(spendDelta * 100).toFixed(0)}%`, leadDelta: `${(leadDelta * 100).toFixed(0)}%` },
          suggestion: "Pause scaling and investigate CPL at creative level before increasing spend further.",
          expectedEffect: "Prevents wasted spend during fatigue phase.",
        });
      }
    }
  }

  // ── Rule: Creative Fatigue ────────────────────────────────────────────
  for (const signal of fatigueSignals) {
    if (signal.fatigueLevel === "severe") {
      results.push({
        ruleId: "CREATIVE_FATIGUE_SEVERE",
        entityLevel: "creative",
        entityId: signal.creativeId,
        severity: "high",
        title: "Creative Exhaustion — Immediate Action Needed",
        evidenceJson: { fatigueScore: Number(signal.fatigueScore), ctrDropPct: Number(signal.ctrDropPct).toFixed(0) },
        suggestion: `CTR dropped ${Number(signal.ctrDropPct).toFixed(0)}% over 7 days. Introduce 2–3 new creative variants immediately.`,
        expectedEffect: "CTR recovery and re-engagement with target audience.",
      });
    } else if (signal.fatigueLevel === "moderate") {
      results.push({
        ruleId: "CREATIVE_FATIGUE_MODERATE",
        entityLevel: "creative",
        entityId: signal.creativeId,
        severity: "medium",
        title: "Creative Fatigue Building",
        evidenceJson: { fatigueScore: Number(signal.fatigueScore) },
        suggestion: "Prepare new creative variants within the next week. CTR declining and frequency rising.",
        expectedEffect: "Prevents severe fatigue and performance cliff.",
      });
    }
  }

  // ── Dedup & persist ───────────────────────────────────────────────────
  const cutoff = subDays(now, 1);
  let generated = 0;
  let skipped = 0;

  for (const rec of results) {
    // Skip if same rule + entity already has an active recommendation in last 24h
    const existing = await prisma.recommendation.findFirst({
      where: {
        clientId,
        ruleId: rec.ruleId,
        entityId: rec.entityId,
        status: "active",
        generatedAt: { gte: cutoff },
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.recommendation.create({
      data: {
        clientId,
        entityLevel: rec.entityLevel,
        entityId: rec.entityId,
        ruleId: rec.ruleId,
        source: "rules_engine",
        severity: rec.severity,
        title: rec.title,
        evidenceJson: rec.evidenceJson,
        suggestion: rec.suggestion,
        expectedEffect: rec.expectedEffect,
        status: "active",
      },
    });

    // Create instant alert for critical severity
    if (rec.severity === "critical") {
      await prisma.instantAlert.create({
        data: {
          clientId,
          alertType: rec.ruleId,
          severity: "critical",
          title: rec.title,
          message: rec.suggestion,
          status: "pending",
          metadata: rec.evidenceJson,
        },
      });
    }

    generated++;
  }

  log.info({ generated, skipped, totalRules: results.length }, "Rules engine complete");
  return { generated, skipped };
}
