/**
 * Creative Analysis Job
 * Analyzes ad copy (text) and thumbnails (image) using Claude.
 * Runs every 6 hours for creatives not yet analyzed.
 */

import prisma from "@/lib/db/client";
import logger from "@/lib/logger";
import { analyzeCreativeText, analyzeCreativeImage } from "@/lib/ai";
import type { JobResult } from "./asset-discovery";

export async function runCreativeAnalysis(clientId: string): Promise<JobResult> {
  const log = logger.child({ job: "creative-analysis", clientId });
  log.info("Starting creative analysis");

  const errors: string[] = [];
  let itemsProcessed = 0;

  // Creatives not yet analyzed (no analysis record)
  const creatives = await prisma.adCreative.findMany({
    where: {
      clientId,
      analysis: null,
    },
    include: {
      ads: { include: { adSet: { include: { campaign: true } } }, take: 1 },
    },
    take: 50, // process in batches
  });

  if (creatives.length === 0) {
    log.info("No unanalyzed creatives found");
    return { success: true, itemsProcessed: 0, errors: [] };
  }

  // Get client industry for context
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { industry: true },
  });

  for (const creative of creatives) {
    try {
      const campaign = creative.ads[0]?.adSet?.campaign;

      // Text analysis
      let textResult = null;
      if (creative.primaryText || creative.headline) {
        textResult = await analyzeCreativeText({
          primaryText: creative.primaryText ?? "",
          headline: creative.headline ?? null,
          description: null,
          ctaType: creative.callToActionType ?? null,
          campaignObjective: campaign?.objective ?? null,
          industry: client?.industry ?? undefined,
          campaignType: campaign?.objective === "MESSAGES" ? "whatsapp_ctwa" : "landing_page",
        });
      }

      // Image analysis (if thumbnail available)
      let imageResult = null;
      if (creative.thumbnailUrl) {
        try {
          imageResult = await analyzeCreativeImage(creative.thumbnailUrl);
        } catch (imgErr) {
          log.warn({ creativeId: creative.id, error: String(imgErr) }, "Image analysis skipped");
        }
      }

      const textScore = textResult?.textScore ?? null;
      const imageScore = imageResult?.imageScore ?? null;
      const overallScore =
        textScore !== null && imageScore !== null
          ? textScore * 0.6 + imageScore * 0.4
          : textScore ?? imageScore ?? null;

      await prisma.creativeAnalysis.create({
        data: {
          clientId,
          creativeId: creative.id,
          // Text scores
          textScore: textScore ?? undefined,
          hookStrength: textResult?.hookStrength ?? undefined,
          ctaClarity: textResult?.ctaClarity ?? undefined,
          urgencyScore: textResult?.urgencyScore ?? undefined,
          overallScore: overallScore ?? undefined,
          // Image scores
          imageScore: imageScore ?? undefined,
          humanPresence: imageResult?.humanPresence ?? undefined,
          textOverlayDensity: imageResult?.textOverlayDensity ?? undefined,
          visualClutter: imageResult?.visualClutter ?? undefined,
          // Combined
          strengths: [
            ...(textResult?.strengths ?? []),
            ...(imageResult?.strengths ?? []),
          ] as object,
          weaknesses: [
            ...(textResult?.weaknesses ?? []),
            ...(imageResult?.weaknesses ?? []),
          ] as object,
          hypotheses: imageResult?.hypotheses as object ?? undefined,
          rewriteSuggestions: textResult?.rewriteSuggestions as object ?? undefined,
          modelUsed: process.env.AI_MODEL_TEXT ?? "claude-sonnet-4-6",
        },
      });

      itemsProcessed++;
      log.debug({ creativeId: creative.id, overallScore }, "Creative analyzed");
    } catch (e) {
      const msg = `Creative ${creative.id}: ${String(e)}`;
      errors.push(msg);
      log.error({ creativeId: creative.id, error: String(e) }, "Creative analysis error");
    }
  }

  log.info({ itemsProcessed, errorCount: errors.length }, "Creative analysis complete");
  return { success: errors.length === 0, itemsProcessed, errors };
}
