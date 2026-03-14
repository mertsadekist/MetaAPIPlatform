import Anthropic from "@anthropic-ai/sdk";
import {
  CREATIVE_TEXT_ANALYSIS_SYSTEM_PROMPT,
  buildTextAnalysisPrompt,
  type TextAnalysisInput,
  type TextAnalysisOutput,
} from "@/lib/ai/prompts/creative-text-analysis";
import {
  CREATIVE_IMAGE_ANALYSIS_SYSTEM_PROMPT,
  type ImageAnalysisOutput,
} from "@/lib/ai/prompts/creative-image-analysis";
import logger from "@/lib/logger";

const MODEL_TEXT = process.env.AI_MODEL_TEXT ?? "claude-sonnet-4-6";
const MODEL_VISION = process.env.AI_MODEL_VISION ?? "claude-sonnet-4-6";

function getClient(): Anthropic {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) throw new Error("AI_API_KEY environment variable is not set");
  return new Anthropic({ apiKey });
}

function parseJsonResponse<T>(content: string): T {
  // Strip markdown code fences if present
  const cleaned = content.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
  return JSON.parse(cleaned) as T;
}

export async function analyzeCreativeText(input: TextAnalysisInput): Promise<TextAnalysisOutput> {
  const client = getClient();

  const response = await client.messages.create({
    model: MODEL_TEXT,
    max_tokens: 1500,
    system: CREATIVE_TEXT_ANALYSIS_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildTextAnalysisPrompt(input) }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  try {
    return parseJsonResponse<TextAnalysisOutput>(text);
  } catch (e) {
    logger.error({ error: String(e), raw: text }, "Failed to parse text analysis response");
    throw new Error("AI returned invalid JSON for text analysis");
  }
}

export async function analyzeCreativeImage(imageUrl: string): Promise<ImageAnalysisOutput> {
  const client = getClient();

  // Fetch image and convert to base64 for Claude vision
  const imgRes = await fetch(imageUrl);
  const imgBuffer = await imgRes.arrayBuffer();
  const base64 = Buffer.from(imgBuffer).toString("base64");
  const mediaType = imgRes.headers.get("content-type") ?? "image/jpeg";

  const response = await client.messages.create({
    model: MODEL_VISION,
    max_tokens: 1500,
    system: CREATIVE_IMAGE_ANALYSIS_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: base64,
            },
          },
          {
            type: "text",
            text: "Analyze this Meta ad creative image and return the JSON analysis only.",
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  try {
    return parseJsonResponse<ImageAnalysisOutput>(text);
  } catch (e) {
    logger.error({ error: String(e), raw: text }, "Failed to parse image analysis response");
    throw new Error("AI returned invalid JSON for image analysis");
  }
}

export async function generateRecommendationNarrative(
  clientName: string,
  recommendations: Array<{ title: string; severity: string; suggestion: string }>
): Promise<string> {
  const client = getClient();

  const response = await client.messages.create({
    model: MODEL_TEXT,
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: `You are a performance marketing analyst. Write a 2-3 sentence weekly performance narrative for ${clientName} based on these recommendations:

${recommendations.map((r) => `[${r.severity.toUpperCase()}] ${r.title}: ${r.suggestion}`).join("\n")}

Be direct and actionable. No fluff. Focus on the most important issues.`,
      },
    ],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}
