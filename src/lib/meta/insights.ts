/**
 * Meta Insights helpers — field strings, action extractors, derived metrics.
 */

export const INSIGHTS_FIELDS = [
  "account_id",
  "campaign_id",
  "campaign_name",
  "adset_id",
  "adset_name",
  "ad_id",
  "ad_name",
  "date_start",
  "date_stop",
  "impressions",
  "reach",
  "frequency",
  "clicks",
  "unique_clicks",
  "inline_link_clicks",
  "outbound_clicks",
  "spend",
  "ctr",
  "unique_ctr",
  "cpm",
  "cpp",
  "cpc",
  "actions",
  "action_values",
  "unique_actions",
  "cost_per_action_type",
  "cost_per_unique_action_type",
].join(",");

// Jan 2026: 7d_view and 28d_view removed from valid attribution windows
export const ATTRIBUTION_WINDOWS = ["7d_click", "1d_view"];

export interface ActionEntry {
  action_type: string;
  value: string;
}

export type ActionsArray = ActionEntry[];

export function extractAction(
  actions: ActionsArray | undefined,
  actionType: string
): number {
  if (!actions) return 0;
  const found = actions.find((a) => a.action_type === actionType);
  return found ? parseFloat(found.value) || 0 : 0;
}

export function extractActionValue(
  actionValues: ActionsArray | undefined,
  actionType: string
): number {
  if (!actionValues) return 0;
  const found = actionValues.find((a) => a.action_type === actionType);
  return found ? parseFloat(found.value) || 0 : 0;
}

// WhatsApp-specific action types
export const WA_ACTIONS = {
  CONVERSATION_STARTED: "messaging_conversation_started_7d",
  FIRST_REPLY: "onsite_conversion.messaging_first_reply",
} as const;

// Pixel event action types for Landing Page campaigns
export const PIXEL_EVENTS = {
  PAGE_VIEW: "landing_page_view",
  VIEW_CONTENT: "view_content",
  LEAD: "lead",
  CONTACT: "contact",
  INITIATE_CHECKOUT: "initiate_checkout",
  PURCHASE: "purchase",
} as const;

export interface DerivedMetrics {
  leads: number;
  purchases: number;
  purchaseValue: number;
  messagesStarted: number;
  cpl: number | null;
  roas: number | null;
  costPerMessage: number | null;
  conversionRate: number | null;
  clickToWaRatio: number | null;
}

export function computeDerivedMetrics(
  spend: number,
  clicks: number,
  inlineLinkClicks: number,
  actions: ActionsArray | undefined,
  actionValues: ActionsArray | undefined
): DerivedMetrics {
  const leads = extractAction(actions, PIXEL_EVENTS.LEAD);
  const purchases = extractAction(actions, PIXEL_EVENTS.PURCHASE);
  const purchaseValue = extractActionValue(actionValues, PIXEL_EVENTS.PURCHASE);
  const messagesStarted = extractAction(actions, WA_ACTIONS.CONVERSATION_STARTED);

  const cpl = leads > 0 ? spend / leads : null;
  const roas = spend > 0 ? purchaseValue / spend : null;
  const costPerMessage = messagesStarted > 0 ? spend / messagesStarted : null;
  const conversionRate = clicks > 0 ? (leads / clicks) * 100 : null;
  const clickToWaRatio =
    inlineLinkClicks > 0 ? (messagesStarted / inlineLinkClicks) * 100 : null;

  return {
    leads,
    purchases,
    purchaseValue,
    messagesStarted,
    cpl,
    roas,
    costPerMessage,
    conversionRate,
    clickToWaRatio,
  };
}
