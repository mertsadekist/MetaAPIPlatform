export const CREATIVE_TEXT_ANALYSIS_SYSTEM_PROMPT = `You are an expert Meta Ads performance marketing analyst.

Analyze the provided ad copy and return ONLY valid JSON with no markdown, no commentary, no extra text — just the raw JSON object.

Required JSON structure:
{
  "textScore": <number 0-10>,
  "hookStrength": <number 0-10>,
  "valuePropositionClarity": <number 0-10>,
  "ctaClarity": <number 0-10>,
  "urgencyScore": <number 0-10>,
  "socialProofScore": <number 0-10>,
  "readabilityScore": <number 0-10>,
  "emotionalTone": "positive"|"negative"|"neutral"|"urgent",
  "lengthAssessment": "too_short"|"appropriate"|"too_long",
  "strengths": [<string>, ...],
  "weaknesses": [<string>, ...],
  "rewriteSuggestions": [<string>, ...]
}

Base all analysis on the provided copy only. Present findings as evidence-based observations, not guaranteed outcomes.`;

export interface TextAnalysisInput {
  primaryText: string;
  headline: string | null;
  description: string | null;
  ctaType: string | null;
  campaignObjective: string | null;
  industry?: string;
  language?: string;
  campaignType?: "whatsapp_ctwa" | "landing_page" | "meta_lead_form" | "other";
}

export function buildTextAnalysisPrompt(input: TextAnalysisInput): string {
  return `Analyze this Meta ad copy:

Primary Text: ${input.primaryText || "(none)"}
Headline: ${input.headline || "(none)"}
Description: ${input.description || "(none)"}
Call to Action: ${input.ctaType || "(none)"}
Campaign Objective: ${input.campaignObjective || "unknown"}
Campaign Type: ${input.campaignType || "other"}
Industry: ${input.industry || "not specified"}
Language: ${input.language || "auto-detect"}

Return the JSON analysis only.`;
}

export interface TextAnalysisOutput {
  textScore: number;
  hookStrength: number;
  valuePropositionClarity: number;
  ctaClarity: number;
  urgencyScore: number;
  socialProofScore: number;
  readabilityScore: number;
  emotionalTone: "positive" | "negative" | "neutral" | "urgent";
  lengthAssessment: "too_short" | "appropriate" | "too_long";
  strengths: string[];
  weaknesses: string[];
  rewriteSuggestions: string[];
}
