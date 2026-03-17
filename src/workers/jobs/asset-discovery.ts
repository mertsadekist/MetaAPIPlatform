/**
 * Asset Discovery Job
 * Fetches Business Managers → Ad Accounts → Campaigns → AdSets → Ads → Creatives
 * Runs every 6 hours. Fully idempotent via upserts.
 */

import prisma from "@/lib/db/client";
import logger from "@/lib/logger";
import { MetaApiClient } from "@/lib/meta/client";
import { decryptToken } from "@/lib/meta/crypto";

const WA_OBJECTIVES = new Set([
  "MESSAGES",
  "OUTCOME_ENGAGEMENT",
  "LINK_CLICKS",
]);

export interface JobResult {
  success: boolean;
  itemsProcessed: number;
  errors: string[];
}

export async function runAssetDiscovery(clientId: string): Promise<JobResult> {
  const log = logger.child({ job: "asset-discovery", clientId });
  log.info("Starting asset discovery");

  const errors: string[] = [];
  let itemsProcessed = 0;

  const connections = await prisma.metaConnection.findMany({
    where: { clientId, status: "active" },
  });

  if (connections.length === 0) {
    log.warn("No active Meta connections found");
    return { success: true, itemsProcessed: 0, errors: [] };
  }

  for (const conn of connections) {
    try {
      const token = decryptToken(conn.accessTokenHash);
      const api = new MetaApiClient(token);

      // ── Personal Ad Accounts (no Business Manager needed) ──────
      const personalAccounts = await api.getPersonalAdAccounts();
      log.info({ count: personalAccounts.length }, "Personal ad accounts found");

      // Ensure a placeholder BusinessManager row exists for personal accounts
      let personalBmDbId: string | null = null;
      if (personalAccounts.length > 0) {
        const personalBmMetaId = `personal_${conn.id}`;
        await prisma.businessManager.upsert({
          where: { metaBusinessId: personalBmMetaId },
          update: { name: "Personal Ad Accounts", isActive: true, lastSyncedAt: new Date() },
          create: {
            clientId,
            metaBusinessId: personalBmMetaId,
            name: "Personal Ad Accounts",
            isActive: true,
            lastSyncedAt: new Date(),
          },
        });
        const personalBm = await prisma.businessManager.findUnique({
          where: { metaBusinessId: personalBmMetaId },
        });
        personalBmDbId = personalBm?.id ?? null;
      }

      // Collect all ad accounts: personal + from all Business Managers
      type RawAccount = {
        id: string; name: string; account_status: number;
        currency: string; timezone_name: string;
        amount_spent: string; balance: string;
      };
      const allAccountSources: Array<{ bmDbId: string | null; acc: RawAccount }> = [];

      for (const acc of personalAccounts) {
        allAccountSources.push({ bmDbId: personalBmDbId, acc });
      }

      // ── Business Managers ──────────────────────────────────────
      const businesses = await api.getBusinessManagers();
      log.info({ count: businesses.length }, "Business managers found");

      for (const bm of businesses) {
        await prisma.businessManager.upsert({
          where: { metaBusinessId: bm.id },
          update: { name: bm.name, isActive: true, lastSyncedAt: new Date() },
          create: {
            clientId,
            metaBusinessId: bm.id,
            name: bm.name,
            isActive: true,
            lastSyncedAt: new Date(),
          },
        });

        const dbBm = await prisma.businessManager.findUnique({
          where: { metaBusinessId: bm.id },
        });
        if (!dbBm) continue;

        // Owned + client ad accounts for this BM
        const [ownedAccounts, clientAccounts] = await Promise.all([
          api.getAdAccounts(bm.id),
          api.getClientAdAccounts(bm.id),
        ]);

        // Deduplicate by account id across owned + client
        const seen = new Set<string>();
        for (const acc of [...ownedAccounts, ...clientAccounts]) {
          if (!seen.has(acc.id)) {
            seen.add(acc.id);
            allAccountSources.push({ bmDbId: dbBm.id, acc });
          }
        }
      }

      log.info({ total: allAccountSources.length }, "Total ad accounts to sync");

      // ── Process all collected Ad Accounts ────────────────────
      for (const { bmDbId, acc } of allAccountSources) {
          // Meta returns act_XXXXX — strip prefix for our ID field
          const rawId = acc.id.replace("act_", "");
          const metaAdAccountId = rawId;

          await prisma.adAccount.upsert({
            where: { metaAdAccountId },
            update: {
              name: acc.name,
              effectiveStatus: String(acc.account_status),
              currency: acc.currency,
              timezone: acc.timezone_name,
              isActive: acc.account_status === 1,
              rawPayload: acc as object,
              lastSyncedAt: new Date(),
            },
            create: {
              clientId,
              ...(bmDbId ? { businessManagerId: bmDbId } : {}),
              metaAdAccountId,
              name: acc.name,
              currency: acc.currency,
              timezone: acc.timezone_name,
              effectiveStatus: String(acc.account_status),
              isActive: acc.account_status === 1,
              rawPayload: acc as object,
              lastSyncedAt: new Date(),
            },
          });

          const dbAcc = await prisma.adAccount.findUnique({
            where: { metaAdAccountId },
          });
          if (!dbAcc) continue;

          // ── Campaigns ────────────────────────────────────────────
          const campaigns = await api.getCampaigns(rawId);

          for (const camp of campaigns) {
            await prisma.campaign.upsert({
              where: { metaCampaignId: camp.id },
              update: {
                name: camp.name,
                effectiveStatus: camp.effective_status,
                objective: camp.objective,
                buyingType: camp.buying_type,
                dailyBudget: camp.daily_budget
                  ? parseFloat(camp.daily_budget) / 100
                  : null,
                lifetimeBudget: camp.lifetime_budget
                  ? parseFloat(camp.lifetime_budget) / 100
                  : null,
                startTime: camp.start_time ? new Date(camp.start_time) : null,
                stopTime: camp.stop_time ? new Date(camp.stop_time) : null,
                updatedTimeMeta: new Date(camp.updated_time),
                rawPayload: camp as object,
                updatedAt: new Date(),
              },
              create: {
                clientId,
                adAccountId: dbAcc.id,
                metaCampaignId: camp.id,
                name: camp.name,
                objective: camp.objective,
                effectiveStatus: camp.effective_status,
                buyingType: camp.buying_type,
                dailyBudget: camp.daily_budget
                  ? parseFloat(camp.daily_budget) / 100
                  : null,
                lifetimeBudget: camp.lifetime_budget
                  ? parseFloat(camp.lifetime_budget) / 100
                  : null,
                startTime: camp.start_time ? new Date(camp.start_time) : null,
                stopTime: camp.stop_time ? new Date(camp.stop_time) : null,
                createdTimeMeta: new Date(camp.created_time),
                updatedTimeMeta: new Date(camp.updated_time),
                rawPayload: camp as object,
              },
            });

            const dbCamp = await prisma.campaign.findUnique({
              where: { metaCampaignId: camp.id },
            });
            if (!dbCamp) continue;

            // Tag WhatsApp campaigns
            if (WA_OBJECTIVES.has(camp.objective)) {
              await prisma.whatsAppCampaign.upsert({
                where: { metaCampaignId: camp.id },
                update: {
                  campaignName: camp.name,
                  status:
                    camp.effective_status === "ACTIVE"
                      ? "active"
                      : camp.effective_status === "PAUSED"
                      ? "paused"
                      : "archived",
                },
                create: {
                  clientId,
                  campaignId: dbCamp.id,
                  metaCampaignId: camp.id,
                  campaignName: camp.name,
                  trackingMethod: "click_to_wa",
                  status:
                    camp.effective_status === "ACTIVE"
                      ? "active"
                      : camp.effective_status === "PAUSED"
                      ? "paused"
                      : "archived",
                },
              });
            }

            // ── AdSets ─────────────────────────────────────────────
            const adSets = await api.getAdSets(camp.id);
            for (const adSet of adSets) {
              await prisma.adSet.upsert({
                where: { metaAdSetId: adSet.id },
                update: {
                  name: adSet.name,
                  effectiveStatus: adSet.effective_status,
                  optimizationGoal: adSet.optimization_goal,
                  billingEvent: adSet.billing_event,
                  dailyBudget: adSet.daily_budget
                    ? parseFloat(adSet.daily_budget) / 100
                    : null,
                  lifetimeBudget: adSet.lifetime_budget
                    ? parseFloat(adSet.lifetime_budget) / 100
                    : null,
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
                  dailyBudget: adSet.daily_budget
                    ? parseFloat(adSet.daily_budget) / 100
                    : null,
                  lifetimeBudget: adSet.lifetime_budget
                    ? parseFloat(adSet.lifetime_budget) / 100
                    : null,
                  targetingJson: adSet.targeting as object,
                  rawPayload: adSet as object,
                  createdTimeMeta: new Date(adSet.created_time),
                },
              });

              const dbAdSet = await prisma.adSet.findUnique({
                where: { metaAdSetId: adSet.id },
              });
              if (!dbAdSet) continue;

              // ── Ads ──────────────────────────────────────────────
              const ads = await api.getAds(adSet.id);
              for (const ad of ads) {
                let creativeDbId: string | undefined;

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
                  } catch (e) {
                    log.warn({ adId: ad.id, error: String(e) }, "Failed to fetch creative");
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
        }
    } catch (e) {
      const msg = `Connection ${conn.id}: ${String(e)}`;
      errors.push(msg);
      log.error({ connectionId: conn.id, error: String(e) }, "Asset discovery error");

      // Only mark as "error" for auth failures (code 190 / OAuthException).
      // Rate-limit errors (code 17) and other transient failures are temporary —
      // leave the connection active so the next scheduled run can retry.
      const isAuthError =
        e instanceof Error &&
        "code" in e &&
        ((e as { code: number }).code === 190 ||
          ("type" in e && (e as { type: string }).type === "OAuthException"));

      if (isAuthError) {
        await prisma.metaConnection.update({
          where: { id: conn.id },
          data: { status: "error" },
        });
      }
    }
  }

  log.info({ itemsProcessed, errorCount: errors.length }, "Asset discovery complete");
  return { success: errors.length === 0, itemsProcessed, errors };
}
