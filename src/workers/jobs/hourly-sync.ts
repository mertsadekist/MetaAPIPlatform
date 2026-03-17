/**
 * Hourly Sync Job
 * Fetches today's performance insights for all active ad accounts.
 * Computes derived metrics (CPL, ROAS, costPerMessage, clickToWaRatio).
 */

import prisma from "@/lib/db/client";
import logger from "@/lib/logger";
import { MetaApiClient } from "@/lib/meta/client";
import { decryptToken } from "@/lib/meta/crypto";
import {
  INSIGHTS_FIELDS,
  ATTRIBUTION_WINDOWS,
  computeDerivedMetrics,
  type ActionsArray,
} from "@/lib/meta/insights";
import { format } from "date-fns";
import type { JobResult } from "./asset-discovery";

export async function runHourlySync(clientId: string): Promise<JobResult> {
  const log = logger.child({ job: "hourly-sync", clientId });
  log.info("Starting hourly sync");

  const errors: string[] = [];
  let itemsProcessed = 0;

  const connections = await prisma.metaConnection.findMany({
    where: { clientId, status: "active" },
  });

  const adAccounts = await prisma.adAccount.findMany({
    where: { clientId, isActive: true, isAssigned: true },
  });

  if (adAccounts.length === 0) {
    log.info("No active ad accounts found");
    return { success: true, itemsProcessed: 0, errors: [] };
  }

  // Use first active connection
  const conn = connections[0];
  if (!conn) {
    return { success: false, itemsProcessed: 0, errors: ["No active Meta connection"] };
  }

  const token = decryptToken(conn.accessTokenHash);
  const api = new MetaApiClient(token);

  const today = format(new Date(), "yyyy-MM-dd");

  for (const account of adAccounts) {
    try {
      const insights = await api.getInsights(account.metaAdAccountId, {
        fields: INSIGHTS_FIELDS,
        time_range: { since: today, until: today },
        time_increment: "all_days",
        level: "adset",
        action_attribution_windows: ATTRIBUTION_WINDOWS,
      });

      for (const row of insights) {
        const spend = parseFloat(String(row.spend ?? "0")) || 0;
        const impressions = parseInt(String(row.impressions ?? "0")) || 0;
        const reach = parseInt(String(row.reach ?? "0")) || 0;
        const clicks = parseInt(String(row.clicks ?? "0")) || 0;
        const inlineLinkClicks = parseInt(String(row.inline_link_clicks ?? "0")) || 0;
        const ctr = parseFloat(String(row.ctr ?? "0")) || 0;
        const cpc = parseFloat(String(row.cpc ?? "0")) || 0;
        const cpm = parseFloat(String(row.cpm ?? "0")) || 0;
        const frequency = parseFloat(String(row.frequency ?? "0")) || 0;

        const actions = row.actions as ActionsArray | undefined;
        const actionValues = row.action_values as ActionsArray | undefined;

        const derived = computeDerivedMetrics(
          spend,
          clicks,
          inlineLinkClicks,
          actions,
          actionValues
        );

        // Resolve DB IDs
        const campaignId = row.campaign_id
          ? (await prisma.campaign.findUnique({ where: { metaCampaignId: String(row.campaign_id) } }))?.id
          : undefined;

        const adSetId = row.adset_id
          ? (await prisma.adSet.findUnique({ where: { metaAdSetId: String(row.adset_id) } }))?.id
          : undefined;

        await prisma.insightSnapshot.create({
          data: {
            clientId,
            adAccountId: account.id,
            campaignId,
            adSetId,
            entityLevel: "adset",
            granularity: "hourly",
            dateStart: new Date(String(row.date_start)),
            dateStop: new Date(String(row.date_stop)),
            spend,
            impressions,
            reach,
            frequency,
            clicks,
            inlineLinkClicks,
            ctr,
            cpc,
            cpm,
            leads: derived.leads,
            purchases: derived.purchases,
            purchaseValue: derived.purchaseValue,
            messagesStarted: derived.messagesStarted,
            cpl: derived.cpl,
            roas: derived.roas,
            costPerMessage: derived.costPerMessage,
            conversionRate: derived.conversionRate,
            actionsJson: (actions as object) ?? null,
            actionValuesJson: (actionValues as object) ?? null,
          },
        });

        itemsProcessed++;
      }
    } catch (e) {
      const msg = `Account ${account.metaAdAccountId}: ${String(e)}`;
      errors.push(msg);
      log.error({ accountId: account.metaAdAccountId, error: String(e) }, "Hourly sync error");
    }
  }

  log.info({ itemsProcessed, errorCount: errors.length }, "Hourly sync complete");
  return { success: errors.length === 0, itemsProcessed, errors };
}
