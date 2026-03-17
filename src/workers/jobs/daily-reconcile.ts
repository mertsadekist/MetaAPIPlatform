/**
 * Daily Reconciliation Job
 * Re-fetches D-1 and D-2 to handle late Meta attribution (up to 28 days).
 * Also fetches breakdown insights (age/gender, country, placement).
 * Runs daily at 2:30 AM in client timezone.
 */

import prisma from "@/lib/db/client";
import logger from "@/lib/logger";
import { MetaApiClient } from "@/lib/meta/client";
import { decryptToken } from "@/lib/meta/crypto";
import {
  ATTRIBUTION_WINDOWS,
  computeDerivedMetrics,
  type ActionsArray,
} from "@/lib/meta/insights";
import { format, subDays } from "date-fns";
import type { JobResult } from "./asset-discovery";

const INSIGHTS_FIELDS_DAILY = [
  "campaign_id",
  "adset_id",
  "ad_id",
  "date_start",
  "date_stop",
  "impressions",
  "reach",
  "frequency",
  "clicks",
  "inline_link_clicks",
  "spend",
  "ctr",
  "cpc",
  "cpm",
  "actions",
  "action_values",
].join(",");

const BREAKDOWN_FIELDS = "impressions,clicks,reach,spend,actions,action_values";

export async function runDailyReconcile(clientId: string): Promise<JobResult> {
  const log = logger.child({ job: "daily-reconcile", clientId });
  log.info("Starting daily reconciliation");

  const errors: string[] = [];
  let itemsProcessed = 0;

  const connections = await prisma.metaConnection.findMany({
    where: { clientId, status: "active" },
  });

  const adAccounts = await prisma.adAccount.findMany({
    where: { clientId, isActive: true, isAssigned: true },
  });

  if (adAccounts.length === 0 || connections.length === 0) {
    return { success: true, itemsProcessed: 0, errors: [] };
  }

  const token = decryptToken(connections[0].accessTokenHash);
  const api = new MetaApiClient(token);

  const today = new Date();
  const datesToReconcile = [
    format(subDays(today, 1), "yyyy-MM-dd"), // D-1
    format(subDays(today, 2), "yyyy-MM-dd"), // D-2
  ];

  for (const account of adAccounts) {
    for (const date of datesToReconcile) {
      try {
        // ── Daily insights (ad level) ──────────────────────────
        const insights = await api.getInsights(account.metaAdAccountId, {
          fields: INSIGHTS_FIELDS_DAILY,
          time_range: { since: date, until: date },
          time_increment: "1",
          level: "ad",
          action_attribution_windows: ATTRIBUTION_WINDOWS,
        });

        for (const row of insights) {
          const spend = parseFloat(String(row.spend ?? "0")) || 0;
          const clicks = parseInt(String(row.clicks ?? "0")) || 0;
          const inlineLinkClicks = parseInt(String(row.inline_link_clicks ?? "0")) || 0;
          const actions = row.actions as ActionsArray | undefined;
          const actionValues = row.action_values as ActionsArray | undefined;
          const derived = computeDerivedMetrics(spend, clicks, inlineLinkClicks, actions, actionValues);

          const campaignId = row.campaign_id
            ? (await prisma.campaign.findUnique({ where: { metaCampaignId: String(row.campaign_id) } }))?.id
            : undefined;
          const adSetId = row.adset_id
            ? (await prisma.adSet.findUnique({ where: { metaAdSetId: String(row.adset_id) } }))?.id
            : undefined;
          const adId = row.ad_id
            ? (await prisma.ad.findUnique({ where: { metaAdId: String(row.ad_id) } }))?.id
            : undefined;

          await prisma.insightSnapshot.create({
            data: {
              clientId,
              adAccountId: account.id,
              campaignId,
              adSetId,
              adId,
              entityLevel: "ad",
              granularity: "daily",
              dateStart: new Date(String(row.date_start)),
              dateStop: new Date(String(row.date_stop)),
              spend,
              impressions: parseInt(String(row.impressions ?? "0")) || 0,
              reach: parseInt(String(row.reach ?? "0")) || 0,
              frequency: parseFloat(String(row.frequency ?? "0")) || 0,
              clicks,
              inlineLinkClicks,
              ctr: parseFloat(String(row.ctr ?? "0")) || 0,
              cpc: parseFloat(String(row.cpc ?? "0")) || 0,
              cpm: parseFloat(String(row.cpm ?? "0")) || 0,
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

        // ── Breakdown insights ─────────────────────────────────
        const breakdownTypes = [
          { breakdowns: "age,gender", type: "age" },
          { breakdowns: "country", type: "country" },
          { breakdowns: "publisher_platform,impression_device", type: "placement" },
        ];

        for (const { breakdowns, type } of breakdownTypes) {
          try {
            const breakdownRows = await api.getInsights(account.metaAdAccountId, {
              fields: BREAKDOWN_FIELDS,
              time_range: { since: date, until: date },
              time_increment: "1",
              level: "adset",
              breakdowns,
            });

            for (const row of breakdownRows) {
              const breakdownValue =
                type === "age"
                  ? `${row.age ?? "unknown"}_${row.gender ?? "unknown"}`
                  : type === "country"
                  ? String(row.country ?? "unknown")
                  : `${row.publisher_platform ?? "unknown"}_${row.impression_device ?? "unknown"}`;

              const actions = row.actions as ActionsArray | undefined;
              const leads = actions?.find((a) => a.action_type === "lead");

              await prisma.insightBreakdown.create({
                data: {
                  clientId,
                  campaignId: row.campaign_id
                    ? (await prisma.campaign.findUnique({ where: { metaCampaignId: String(row.campaign_id) } }))?.id
                    : undefined,
                  adSetId: row.adset_id
                    ? (await prisma.adSet.findUnique({ where: { metaAdSetId: String(row.adset_id) } }))?.id
                    : undefined,
                  breakdownType: type,
                  breakdownValue,
                  dateStart: new Date(date),
                  dateStop: new Date(date),
                  impressions: parseInt(String(row.impressions ?? "0")) || 0,
                  reach: parseInt(String(row.reach ?? "0")) || 0,
                  clicks: parseInt(String(row.clicks ?? "0")) || 0,
                  spend: parseFloat(String(row.spend ?? "0")) || 0,
                  leads: leads ? parseFloat(leads.value) : 0,
                  cpl:
                    leads && parseFloat(String(row.spend ?? "0")) > 0
                      ? parseFloat(String(row.spend)) / parseFloat(leads.value)
                      : null,
                },
              });
            }
          } catch (e) {
            log.warn({ breakdowns, error: String(e) }, "Breakdown fetch failed");
          }
        }
      } catch (e) {
        const msg = `Account ${account.metaAdAccountId} date ${date}: ${String(e)}`;
        errors.push(msg);
        log.error({ error: String(e), date }, "Daily reconcile error");
      }
    }
  }

  log.info({ itemsProcessed, errorCount: errors.length }, "Daily reconciliation complete");
  return { success: errors.length === 0, itemsProcessed, errors };
}
