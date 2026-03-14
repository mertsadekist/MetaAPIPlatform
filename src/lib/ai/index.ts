/**
 * AI provider abstraction.
 * Switch between anthropic/openai via AI_PROVIDER env var.
 * Currently only Anthropic is implemented.
 */

export {
  analyzeCreativeText,
  analyzeCreativeImage,
  generateRecommendationNarrative,
} from "./providers/anthropic";

export type { TextAnalysisInput, TextAnalysisOutput } from "./prompts/creative-text-analysis";
export type { ImageAnalysisOutput } from "./prompts/creative-image-analysis";
