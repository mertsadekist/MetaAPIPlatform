/**
 * Meta Graph API Client — v21.0
 * Handles pagination, rate limiting, retries, and error classification.
 */

import logger from "@/lib/logger";

const GRAPH_API_BASE = "https://graph.facebook.com";
const GRAPH_API_VERSION = "v21.0";
const BASE_URL = `${GRAPH_API_BASE}/${GRAPH_API_VERSION}`;

// Meta error codes that are retryable
const RETRYABLE_ERROR_CODES = new Set([17, 32, 613, -1, 2, 4]);

export interface MetaApiError {
  message: string;
  type: string;
  code: number;
  fbtrace_id?: string;
}

export class MetaError extends Error {
  constructor(
    message: string,
    public code: number,
    public type: string,
    public isRetryable: boolean,
    public isAuthError: boolean
  ) {
    super(message);
    this.name = "MetaError";
  }
}

export interface PaginatedResponse<T> {
  data: T[];
  paging?: {
    cursors?: { before: string; after: string };
    next?: string;
  };
}

export interface InsightParams {
  fields: string;
  date_preset?: string;
  time_range?: { since: string; until: string };
  time_increment?: string | number;
  level?: "account" | "campaign" | "adset" | "ad";
  breakdowns?: string;
  action_attribution_windows?: string[];
  limit?: number;
}

export class MetaApiClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private parseRateLimitHeader(header: string | null): number {
    if (!header) return 0;
    try {
      const parsed = JSON.parse(header);
      return parsed.call_count ?? 0;
    } catch {
      return 0;
    }
  }

  private async request<T>(
    path: string,
    params: Record<string, string | number | boolean | string[]> = {},
    attempt = 0
  ): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    url.searchParams.set("access_token", this.accessToken);

    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        url.searchParams.set(key, JSON.stringify(value));
      } else {
        url.searchParams.set(key, String(value));
      }
    }

    const res = await fetch(url.toString());

    // Parse rate limit usage from response headers
    const usage = this.parseRateLimitHeader(
      res.headers.get("x-app-usage")
    );
    if (usage >= 75) {
      const delay = Math.min(1000 * Math.pow(2, attempt), 60_000);
      logger.warn({ usage, delay }, "Meta API rate limit approaching, throttling");
      await new Promise((r) => setTimeout(r, delay));
    }

    const body = await res.json() as { error?: MetaApiError } & T;

    if (body.error) {
      const err = body.error;
      const isAuth = err.code === 190 || err.type === "OAuthException";
      const isRetryable = RETRYABLE_ERROR_CODES.has(err.code);

      logger.error(
        { code: err.code, type: err.type, message: err.message },
        "Meta API error"
      );

      if (isRetryable && attempt < 3) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 60_000);
        await new Promise((r) => setTimeout(r, delay));
        return this.request<T>(path, params, attempt + 1);
      }

      throw new MetaError(err.message, err.code, err.type, isRetryable, isAuth);
    }

    return body;
  }

  /** Fetch all pages of a paginated endpoint */
  async fetchAll<T>(
    path: string,
    params: Record<string, string | number | boolean | string[]> = {},
    limit = 200
  ): Promise<T[]> {
    const results: T[] = [];
    let after: string | undefined;

    do {
      const pageParams = { ...params, limit, ...(after ? { after } : {}) };
      const page = await this.request<PaginatedResponse<T>>(path, pageParams);
      results.push(...page.data);
      after = page.paging?.cursors?.after;
      if (!page.paging?.next) break;
    } while (after);

    return results;
  }

  /** Validate token and fetch basic info */
  async validateToken(): Promise<{
    id: string;
    name: string;
    scopes: string[];
  }> {
    const [me, debug] = await Promise.all([
      this.request<{ id: string; name: string }>("/me", { fields: "id,name" }),
      this.request<{
        data: { scopes: string[]; is_valid: boolean; expires_at: number };
      }>("/debug_token", {
        input_token: this.accessToken,
        access_token: this.accessToken,
      }),
    ]);

    return {
      id: me.id,
      name: me.name,
      scopes: debug.data.scopes ?? [],
    };
  }

  /** Fetch business managers for the token owner */
  async getBusinessManagers(): Promise<
    Array<{ id: string; name: string; timezone_id: number }>
  > {
    return this.fetchAll<{ id: string; name: string; timezone_id: number }>(
      "/me/businesses",
      { fields: "id,name,timezone_id" }
    );
  }

  /** Fetch owned ad accounts for a business */
  async getAdAccounts(businessId: string): Promise<
    Array<{
      id: string;
      name: string;
      account_status: number;
      currency: string;
      timezone_name: string;
      amount_spent: string;
      balance: string;
    }>
  > {
    return this.fetchAll(
      `/${businessId}/owned_ad_accounts`,
      {
        fields:
          "id,name,account_status,currency,timezone_name,amount_spent,balance",
      }
    );
  }

  /** Fetch campaigns for an ad account */
  async getCampaigns(adAccountId: string): Promise<
    Array<{
      id: string;
      name: string;
      objective: string;
      effective_status: string;
      buying_type: string;
      daily_budget?: string;
      lifetime_budget?: string;
      start_time?: string;
      stop_time?: string;
      updated_time: string;
      created_time: string;
    }>
  > {
    return this.fetchAll(
      `/act_${adAccountId}/campaigns`,
      {
        fields:
          "id,name,objective,effective_status,buying_type,daily_budget,lifetime_budget,start_time,stop_time,updated_time,created_time",
      }
    );
  }

  /** Fetch ad sets for a campaign */
  async getAdSets(campaignId: string): Promise<
    Array<{
      id: string;
      name: string;
      effective_status: string;
      optimization_goal: string;
      billing_event: string;
      daily_budget?: string;
      lifetime_budget?: string;
      budget_remaining?: string;
      start_time?: string;
      end_time?: string;
      targeting: Record<string, unknown>;
      updated_time: string;
      created_time: string;
    }>
  > {
    return this.fetchAll(
      `/${campaignId}/adsets`,
      {
        fields:
          "id,name,effective_status,optimization_goal,billing_event,daily_budget,lifetime_budget,budget_remaining,start_time,end_time,targeting,updated_time,created_time",
      }
    );
  }

  /** Fetch ads for an ad set */
  async getAds(adSetId: string): Promise<
    Array<{
      id: string;
      name: string;
      effective_status: string;
      bid_amount?: number;
      updated_time: string;
      created_time: string;
      creative?: { id: string };
    }>
  > {
    return this.fetchAll(
      `/${adSetId}/ads`,
      {
        fields:
          "id,name,effective_status,bid_amount,updated_time,created_time,creative{id}",
      }
    );
  }

  /** Fetch creative details */
  async getCreative(creativeId: string): Promise<{
    id: string;
    name: string;
    body?: string;
    title?: string;
    image_url?: string;
    thumbnail_url?: string;
    call_to_action_type?: string;
    object_story_spec?: Record<string, unknown>;
    object_story_id?: string;
    video_id?: string;
  }> {
    return this.request(`/${creativeId}`, {
      fields:
        "id,name,body,title,image_url,thumbnail_url,call_to_action_type,object_story_spec,object_story_id,video_id",
    });
  }

  /** Fetch insights for an ad account */
  async getInsights(
    adAccountId: string,
    params: InsightParams
  ): Promise<
    Array<Record<string, string | number | Array<{ action_type: string; value: string }>>>
  > {
    const reqParams: Record<string, string | number | string[]> = {
      fields: params.fields,
      level: params.level ?? "campaign",
      limit: params.limit ?? 200,
    };

    if (params.date_preset) reqParams.date_preset = params.date_preset;
    if (params.time_range) reqParams.time_range = JSON.stringify(params.time_range);
    if (params.time_increment) reqParams.time_increment = String(params.time_increment);
    if (params.breakdowns) reqParams.breakdowns = params.breakdowns;
    if (params.action_attribution_windows) {
      reqParams.action_attribution_windows = params.action_attribution_windows;
    }

    return this.fetchAll(
      `/act_${adAccountId}/insights`,
      reqParams
    );
  }
}
