export const CREATIVE_IMAGE_ANALYSIS_SYSTEM_PROMPT = `You are an expert visual marketing analyst for Meta ad creatives.

Analyze the provided image and return ONLY valid JSON with no markdown, no commentary — just the raw JSON object.

Required JSON structure:
{
  "imageScore": <number 0-10>,
  "productVisibility": <number 0-10>,
  "humanPresence": <boolean>,
  "facePresence": <boolean>,
  "textOverlayDensity": "none"|"light"|"moderate"|"heavy",
  "visualClutter": <number 0-10, 10 = most cluttered>,
  "contrastScore": <number 0-10>,
  "focalPointClarity": <number 0-10>,
  "colorDominance": [<string>, ...],
  "beforeAfterPattern": <boolean>,
  "offerVisibility": <number 0-10>,
  "strengths": [<string>, ...],
  "weaknesses": [<string>, ...],
  "hypotheses": [<string>, ...]
}`;

export interface ImageAnalysisOutput {
  imageScore: number;
  productVisibility: number;
  humanPresence: boolean;
  facePresence: boolean;
  textOverlayDensity: "none" | "light" | "moderate" | "heavy";
  visualClutter: number;
  contrastScore: number;
  focalPointClarity: number;
  colorDominance: string[];
  beforeAfterPattern: boolean;
  offerVisibility: number;
  strengths: string[];
  weaknesses: string[];
  hypotheses: string[];
}
