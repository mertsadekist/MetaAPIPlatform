/**
 * POST /api/clients/[clientId]/discover
 * Scoped Asset Discovery — fetches Campaigns → AdSets → Ads → Creatives
 * for only the assigned ad accounts of this client.
 *
 * Unlike the global admin job, this:
 *   - Falls back to any active Meta connection (in case connection is stored
 *     under a different clientId)
 *   - Stores all records under the target clientId
 *   - Scopes work to assigned ad accounts only (fast, targeted)
 */

import { NextRequest } from "next/server";
import { requireClientAccess, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";
import { MetaApiClient } from "@/lib/meta/client";
import { decryptToken } from "@/lib/meta/crypto";

const WA_OBJECTIVES = new Set([
  "MESSAGES",
  "OUTCOME_ENGAGEMENT",
  "LINK_CLICKS",
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    await requireClientAccess(clientId);

    // ── Get Meta connection (fall back to any active) ──────────────────
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
    if (connections.length === 0) {
      return Response.json({ success: false, error: "No active Meta connection found" }, { status: 400 });
    }

    // ── Get assigned ad accounts for this client ───────────────────────
    const adAccounts = await prisma.adAccount.findMany({
      where: { clientId, isAssigned: true },
    });
    if (adAccounts.length === 0) {
      return Response.json({ success: false, error: "No assigned ad accounts" }, { status: 400 });
    }

    const conn = connections[0];
    const token = decryptToken(conn.accessTokenHash);
    const api = new MetaApiClient(token);

    let itemsProcessed = 0;
    const errors: string[] = [];

    for (const account of adAccounts) {
      try {
        const campaigns = await api.getCampaigns(account.metaAdAccountId);

        for (const camp of campaigns) {
          // Upsert Campaign
          await prisma.campaign.upsert({
            where: { metaCampaignId: camp.id },
            update: {
              name: camp.name,
              effectiveStatus: camp.effective_status,
              objective: camp.objective,
              buyingType: camp.buying_type,
              dailyBudget: camp.daily_budget ? parseFloat(camp.daily_budget) / 100 : null,
              lifetimeBudget: camp.lifetime_budget ? parseFloat(camp.lifetime_budget) / 100 : null,
              startTime: camp.start_time ? new Date(camp.start_time) : null,
              stopTime: camp.stop_time ? new Date(camp.stop_time) : null,
              updatedTimeMeta: new Date(camp.updated_time),
              rawPayload: camp as object,
              updatedAt: new Date(),
            },
            create: {
              clientId,
              adAccountId: account.id,
              metaCampaignId: camp.id,
              name: camp.name,
              objective: camp.objective,
              effectiveStatus: camp.effective_status,
              buyingType: camp.buying_type,
              dailyBudget: camp.daily_budget ? parseFloat(camp.daily_budget) / 100 : null,
              lifetimeBudget: camp.lifetime_budget ? parseFloat(camp.lifetime_budget) / 100 : null,
              startTime: camp.start_time ? new Date(camp.start_time) : null,
              stopTime: camp.stop_time ? new Date(camp.stop_time) : null,
              createdTimeMeta: new Date(camp.created_time),
              updatedTimeMeta: new Date(camp.updated_time),
              rawPayload: camp as object,
            },
          });

          const dbCamp = await prisma.campaign.findUnique({ where: { metaCampaignId: camp.id } });
          if (!dbCamp) continue;

          // WhatsApp campaign record
          if (WA_OBJECTIVES.has(camp.objective)) {
            await prisma.whatsAppCampaign.upsert({
              where: { metaCampaignId: camp.id },
              update: {
                campaignName: camp.name,
                status: camp.effective_status === "ACTIVE" ? "active"
                  : camp.effective_status === "PAUSED" ? "paused" : "archived",
              },
              create: {
                clientId,
                campaignId: dbCamp.id,
                metaCampaignId: camp.id,
                campaignName: camp.name,
                trackingMethod: "click_to_wa",
                status: camp.effective_status === "ACTIVE" ? "active"
                  : camp.effective_status === "PAUSED" ? "paused" : "archived",
              },
            });
          }

          // AdSets
          const adSets = await api.getAdSets(camp.id);
          for (const adSet of adSets) {
            await prisma.adSet.upsert({
              where: { metaAdSetId: adSet.id },
              update: {
                name: adSet.name,
                effectiveStatus: adSet.effective_status,
                optimizationGoal: adSet.optimization_goal,
                billingEvent: adSet.billing_event,
                dailyBudget: adSet.daily_budget ? parseFloat(adSet.daily_budget) / 100 : null,
                lifetimeBudget: adSet.lifetime_budget ? parseFloat(adSet.lifetime_budget) / 100 : null,
                targetingJson: adSet.targeting as object,
                rawPayload: adSet as object,
                updatedAt: new Date(),
              },
              create: {
                clientId,
                campaignId: dbCamp.id,
                metaAdSetId: adSet.id,
                name: adSet.name,
                effectiveStatus: adSet.effective_status,
                optimizationGoal: adSet.optimization_goal,
                billingEvent: adSet.billing_event,
                dailyBudget: adSet.daily_budget ? parseFloat(adSet.daily_budget) / 100 : null,
                lifetimeBudget: adSet.lifetime_budget ? parseFloat(adSet.lifetime_budget) / 100 : null,
                targetingJson: adSet.targeting as object,
                rawPayload: adSet as object,
                createdTimeMeta: new Date(adSet.created_time),
              },
            });

            const dbAdSet = await prisma.adSet.findUnique({ where: { metaAdSetId: adSet.id } });
            if (!dbAdSet) continue;

            // Ads
            const ads = await api.getAds(adSet.id);
            for (const ad of ads) {
              let creativeDbId: string | undefined;

              // Fetch and upsert creative
              if (ad.creative?.id) {
                try {
                  const creative = await api.getCreative(ad.creative.id);
                  const dbCreative = await prisma.adCreative.upsert({
                    where: { metaCreativeId: creative.id },
                    update: {
                      name: creative.name,
                      primaryText: creative.body,
                      headline: creative.title,
                      callToActionType: creative.call_to_action_type,
                      imageUrl: creative.image_url,
                      thumbnailUrl: creative.thumbnail_url,
                      objectStorySpec: creative.object_story_spec as object,
                      videoId: creative.video_id,
                      rawPayload: creative as object,
                      updatedAt: new Date(),
                    },
                    create: {
                      clientId,
                      metaCreativeId: creative.id,
                      name: creative.name,
                      primaryText: creative.body,
                      headline: creative.title,
                      callToActionType: creative.call_to_action_type,
                      imageUrl: creative.image_url,
                      thumbnailUrl: creative.thumbnail_url,
                      objectStorySpec: creative.object_story_spec as object,
                      videoId: creative.video_id,
                      rawPayload: creative as object,
                    },
                  });
                  creativeDbId = dbCreative.id;
                } catch {
                  // Creative fetch failure is non-fatal
                }
              }

              await prisma.ad.upsert({
                where: { metaAdId: ad.id },
                update: {
                  name: ad.name,
                  effectiveStatus: ad.effective_status,
                  creativeId: creativeDbId,
                  rawPayload: ad as object,
                  updatedAt: new Date(),
                },
                create: {
                  clientId,
                  adSetId: dbAdSet.id,
                  campaignId: dbCamp.id,
                  metaAdId: ad.id,
                  name: ad.name,
                  effectiveStatus: ad.effective_status,
                  creativeId: creativeDbId,
                  rawPayload: ad as object,
                  createdTimeMeta: new Date(ad.created_time),
                },
              });

              itemsProcessed++;
            }
          }
        }

        // Update account lastSyncedAt
        await prisma.adAccount.update({
          where: { id: account.id },
          data: { lastSyncedAt: new Date() },
        }).catch(() => {});

      } catch (e) {
        errors.push(`Account ${account.metaAdAccountId}: ${String(e)}`);
      }
    }

    return Response.json({
      success: errors.length === 0,
      itemsProcessed,
      errors,
      discoveredAt: new Date().toISOString(),
      message: `Discovered ${itemsProcessed} ads/creatives for ${adAccounts.length} account(s)`,
    });
  } catch (e) {
    return handleAuthError(e);
  }
}
