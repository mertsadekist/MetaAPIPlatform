export type SubscriptionPlan = "starter" | "pro" | "enterprise";

export const PLANS: Record<
  SubscriptionPlan,
  {
    label: string;
    maxAdAccounts: number | null; // null = unlimited
    aiFeatures: boolean;
    reports: boolean;
    alerts: boolean;
    sharedLinks: boolean;
  }
> = {
  starter: {
    label: "Starter",
    maxAdAccounts: 3,
    aiFeatures: false,
    reports: false,
    alerts: false,
    sharedLinks: false,
  },
  pro: {
    label: "Pro",
    maxAdAccounts: 15,
    aiFeatures: true,
    reports: true,
    alerts: true,
    sharedLinks: true,
  },
  enterprise: {
    label: "Enterprise",
    maxAdAccounts: null,
    aiFeatures: true,
    reports: true,
    alerts: true,
    sharedLinks: true,
  },
};

/**
 * Effective ad account limit for a client.
 * Client-level override (maxAdAccounts) takes priority over the plan default.
 * Returns null if unlimited.
 */
export function getEffectiveAdAccountLimit(
  plan: SubscriptionPlan,
  maxAdAccounts: number | null
): number | null {
  if (maxAdAccounts !== null) return maxAdAccounts; // admin override
  return PLANS[plan].maxAdAccounts; // plan default
}
