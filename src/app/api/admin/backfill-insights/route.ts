/**
 * POST /api/admin/backfill-insights
 * Fetches historical adset-level insights from Meta for a date range and stores them.
 * Uses the same storage format as hourly-sync (entityLevel: "adset", granularity: "hourly").
 * Protected by TRIGGER_SYNC permission.
 */

import { NextRequest } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";
import { MetaApiClient } from "@/lib/meta/client";
import { decryptToken } from "@/lib/meta/crypto";
import {
  INSIGHTS_FIELDS,
  ATTRIBUTION_WINDOWS,
  computeDerivedMetrics,
  type ActionsArray,
} from "@/lib/meta/insights";

export async function POST(req: NextRequest) {
  try {
    await requirePermission("TRIGGER_SYNC");

    const body = await req.json();
    const { clientId, since, until } = body as {
      clientId?: string;
      since?: string;
      until?: string;
    };

    if (!clientId || !since || !until) {
      return Response.json(
        { error: "clientId, since, and until are required" },
        { status: 400 }
      );
    }

    // Validate date formats
    if (!/^\d{4}-\d{2}-\d{2}$/.test(since) || !/^\d{4}-\d{2}-\d{2}$/.test(until)) {
      return Response.json(
        { error: "since and until must be in YYYY-MM-DD format" },
        { status: 400 }
      );
    }

    const sinceDate = new Date(since);
    const untilDate = new Date(until);
    if (sinceDate > untilDate) {
      return Response.json(
        { error: "since must be before or equal to until" },
        { status: 400 }
      );
    }

    // Load connection and ad accounts
    const connections = await prisma.metaConnection.findMany({
      where: { clientId, status: "active" },
    });

    const adAccounts = await prisma.adAccount.findMany({
      where: { clientId, isActive: true, isAssigned: true },
    });

    if (adAccounts.length === 0) {
      return Response.json({ success: false, error: "No active ad accounts found" }, { status: 400 });
    }

    const conn = connections[0];
    if (!conn) {
      return Response.json({ success: false, error: "No active Meta connection" }, { status: 400 });
    }

    const token = decryptToken(conn.accessTokenHash);
    const api = new MetaApiClient(token);

    const errors: string[] = [];
    let itemsProcessed = 0;

    for (const account of adAccounts) {
      try {
        // Fetch all days in range at once using time_increment: "1" (one row per day per adset)
        const insights = await api.getInsights(account.metaAdAccountId, {
          fields: INSIGHTS_FIELDS,
          time_range: { since, until },
          time_increment: "1",
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

          const dateStart = new Date(String(row.date_start));
          const dateStop = new Date(String(row.date_stop));

          // Same delete-then-create as hourly-sync to avoid duplicates
          await prisma.$transaction([
            prisma.insightSnapshot.deleteMany({
              where: {
                adAccountId: account.id,
                adSetId: adSetId ?? null,
                dateStart,
                entityLevel: "adset",
                granularity: "hourly",
              },
            }),
            prisma.insightSnapshot.create({
              data: {
                clientId,
                adAccountId: account.id,
                campaignId,
                adSetId,
                entityLevel: "adset",
                granularity: "hourly",
                dateStart,
                dateStop,
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
            }),
          ]);

          itemsProcessed++;
        }
      } catch (e) {
        const msg = `Account ${account.metaAdAccountId}: ${String(e)}`;
        errors.push(msg);
      }
    }

    return Response.json({
      success: errors.length === 0,
      itemsProcessed,
      errors,
      message: `Backfill complete: ${itemsProcessed} snapshots stored for ${since} → ${until}`,
    });
  } catch (e) {
    return handleAuthError(e);
  }
}
