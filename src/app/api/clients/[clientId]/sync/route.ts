/**
 * POST /api/clients/[clientId]/sync
 * Manually triggers an on-demand data sync for today (and yesterday) for the
 * given client. Called from the client portal's Refresh button.
 *
 * Replicates hourly-sync logic but:
 *   - Scoped to a single client
 *   - Syncs today AND yesterday to fill gaps
 *   - Falls back to any active Meta connection if none found for this client
 */

import { NextRequest } from "next/server";
import { requireClientAccess, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";
import { MetaApiClient } from "@/lib/meta/client";
import { decryptToken } from "@/lib/meta/crypto";
import {
  INSIGHTS_FIELDS,
  ATTRIBUTION_WINDOWS,
  computeDerivedMetrics,
  type ActionsArray,
} from "@/lib/meta/insights";
import { format, subDays } from "date-fns";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    await requireClientAccess(clientId);

    // ── Get Meta connection (fall back to any active if none for this client) ──
    let connections = await prisma.metaConnection.findMany({
      where: { clientId, status: "active" },
    });
    if (connections.length === 0) {
      connections = await prisma.metaConnection.findMany({
        where: { status: "active" },
        orderBy: { createdAt: "desc" },
        take: 1,
      });
    }

    const adAccounts = await prisma.adAccount.findMany({
      where: { clientId, isActive: true, isAssigned: true },
    });

    if (adAccounts.length === 0) {
      return Response.json({ success: false, error: "No active ad accounts" }, { status: 400 });
    }

    const conn = connections[0];
    if (!conn) {
      return Response.json({ success: false, error: "No active Meta connection" }, { status: 400 });
    }

    const token = decryptToken(conn.accessTokenHash);
    const api = new MetaApiClient(token);

    // Sync today + yesterday to fill any gaps
    const today     = format(new Date(),        "yyyy-MM-dd");
    const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
    const datesToSync = [yesterday, today];

    let itemsProcessed = 0;
    const errors: string[] = [];

    for (const account of adAccounts) {
      for (const syncDate of datesToSync) {
        try {
          const insights = await api.getInsights(account.metaAdAccountId, {
            fields: INSIGHTS_FIELDS,
            time_range: { since: syncDate, until: syncDate },
            time_increment: "all_days",
            level: "adset",
            action_attribution_windows: ATTRIBUTION_WINDOWS,
          });

          for (const row of insights) {
            const spend          = parseFloat(String(row.spend ?? "0")) || 0;
            const impressions    = parseInt(String(row.impressions ?? "0")) || 0;
            const reach          = parseInt(String(row.reach ?? "0")) || 0;
            const clicks         = parseInt(String(row.clicks ?? "0")) || 0;
            const inlineLinkClicks = parseInt(String(row.inline_link_clicks ?? "0")) || 0;
            const ctr            = parseFloat(String(row.ctr ?? "0")) || 0;
            const cpc            = parseFloat(String(row.cpc ?? "0")) || 0;
            const cpm            = parseFloat(String(row.cpm ?? "0")) || 0;
            const frequency      = parseFloat(String(row.frequency ?? "0")) || 0;

            const actions      = row.actions as ActionsArray | undefined;
            const actionValues = row.action_values as ActionsArray | undefined;

            const derived = computeDerivedMetrics(spend, clicks, inlineLinkClicks, actions, actionValues);

            // Resolve internal DB IDs
            const campaignId = row.campaign_id
              ? (await prisma.campaign.findUnique({ where: { metaCampaignId: String(row.campaign_id) } }))?.id
              : undefined;

            const adSetId = row.adset_id
              ? (await prisma.adSet.findUnique({ where: { metaAdSetId: String(row.adset_id) } }))?.id
              : undefined;

            const dateStart = new Date(String(row.date_start));
            const dateStop  = new Date(String(row.date_stop));

            // Delete-then-create: replaces cumulative snapshot for this (account, adSet, date)
            await prisma.$transaction([
              prisma.insightSnapshot.deleteMany({
                where: {
                  adAccountId: account.id,
                  adSetId:     adSetId ?? null,
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
          errors.push(`${account.metaAdAccountId} [${syncDate}]: ${String(e)}`);
        }
      }

      // Update lastSyncedAt on the account
      await prisma.adAccount.update({
        where: { id: account.id },
        data: { lastSyncedAt: new Date() },
      }).catch(() => {});
    }

    return Response.json({
      success: errors.length === 0,
      itemsProcessed,
      errors,
      syncedAt: new Date().toISOString(),
      message: `Synced ${itemsProcessed} snapshots for ${adAccounts.length} account(s)`,
    });
  } catch (e) {
    return handleAuthError(e);
  }
}
