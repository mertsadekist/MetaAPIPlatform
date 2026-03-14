/**
 * Creative Fatigue Engine
 * Computes fatigue score and level from 7-day rolling metrics.
 */

const DEFAULT_FREQUENCY_THRESHOLD =
  parseFloat(process.env.ALERT_CREATIVE_FATIGUE_FREQUENCY ?? "3.5");
const DEFAULT_CTR_DROP_THRESHOLD =
  parseFloat(process.env.ALERT_CREATIVE_FATIGUE_CTR_DROP ?? "0.25");

export interface FatigueInput {
  frequency7d: number;
  ctr7d: number;
  ctrPrev7d: number;
  reach7d: number;
  reachPrev7d: number;
  impressions7d: number;
}

export interface FatigueResult {
  fatigueScore: number;
  fatigueLevel: "none" | "mild" | "moderate" | "severe";
  ctrDropPct: number;
  signals: {
    frequencyHigh: boolean;
    ctrDropping: boolean;
    reachPlateauing: boolean;
  };
  recommendation: string;
}

export function computeFatigue(input: FatigueInput): FatigueResult {
  let score = 0;

  // 1. Frequency signal (0–3 pts)
  const ft = DEFAULT_FREQUENCY_THRESHOLD;
  if (input.frequency7d > ft * 1.5) score += 3;
  else if (input.frequency7d > ft) score += 2;
  else if (input.frequency7d > ft * 0.8) score += 1;

  // 2. CTR drop signal (0–4 pts)
  const ctrDrop =
    input.ctrPrev7d > 0
      ? (input.ctrPrev7d - input.ctr7d) / input.ctrPrev7d
      : 0;
  const cdt = DEFAULT_CTR_DROP_THRESHOLD;
  if (ctrDrop > cdt * 2) score += 4;
  else if (ctrDrop > cdt) score += 3;
  else if (ctrDrop > cdt * 0.5) score += 2;

  // 3. Reach plateau signal (0–2 pts)
  const reachChange =
    input.reachPrev7d > 0
      ? Math.abs(input.reach7d - input.reachPrev7d) / input.reachPrev7d
      : 1;
  if (reachChange < 0.05) score += 2;
  else if (reachChange < 0.1) score += 1;

  const fatigueScore = Math.min(10, score);

  let fatigueLevel: FatigueResult["fatigueLevel"];
  if (fatigueScore >= 7) fatigueLevel = "severe";
  else if (fatigueScore >= 5) fatigueLevel = "moderate";
  else if (fatigueScore >= 2) fatigueLevel = "mild";
  else fatigueLevel = "none";

  const ctrDropPct = ctrDrop * 100;

  const recommendations: Record<FatigueResult["fatigueLevel"], string> = {
    severe: `Frequency ${input.frequency7d.toFixed(1)}x, CTR dropped ${ctrDropPct.toFixed(0)}% over 7 days. Audience exhaustion likely — introduce new creatives within 48 hours.`,
    moderate:
      "Early fatigue signals. CTR declining and frequency rising. Prepare new creative variants within the week.",
    mild: "Mild fatigue indicators. No immediate action required, but begin planning creative refresh.",
    none: "No fatigue signals detected. Creative performing within normal parameters.",
  };

  return {
    fatigueScore,
    fatigueLevel,
    ctrDropPct,
    signals: {
      frequencyHigh: input.frequency7d > ft,
      ctrDropping: ctrDrop > cdt,
      reachPlateauing: reachChange < 0.05,
    },
    recommendation: recommendations[fatigueLevel],
  };
}
