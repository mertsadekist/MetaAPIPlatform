import { NextRequest } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/auth/guards";

export async function GET(req: NextRequest) {
  try {
    await requirePermission("MANAGE_META_CONNECTIONS");

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");

    if (!clientId) {
      return Response.json({ error: "clientId is required" }, { status: 400 });
    }

    const appId = process.env.META_APP_ID;
    const baseUrl = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL;

    if (!appId) {
      return Response.json({ error: "META_APP_ID is not configured" }, { status: 500 });
    }
    if (!baseUrl) {
      return Response.json({ error: "NEXTAUTH_URL is not configured" }, { status: 500 });
    }

    const redirectUri = `${baseUrl.replace(/\/$/, "")}/api/meta/oauth/callback`;

    const scopes = [
      "ads_read",
      "ads_management",
      "business_management",
      "pages_show_list",
      "pages_read_engagement",
    ].join(",");

    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      scope: scopes,
      state: clientId,
      response_type: "code",
    });

    const version = process.env.META_GRAPH_API_VERSION ?? "v21.0";
    const url = `https://www.facebook.com/${version}/dialog/oauth?${params.toString()}`;

    return Response.json({ url });
  } catch (e) {
    return handleAuthError(e);
  }
}
