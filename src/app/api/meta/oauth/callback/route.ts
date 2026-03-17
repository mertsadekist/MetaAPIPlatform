import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { metaService } from "@/modules/meta/meta.service";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // contains clientId
  const errorParam = searchParams.get("error");
  const errorDesc = searchParams.get("error_description");

  const baseUrl = (process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "").replace(/\/$/, "");
  const successBase = `${baseUrl}/admin/meta/oauth-success`;

  // Facebook returned an error (user denied, etc.)
  if (errorParam) {
    const msg = errorDesc ?? errorParam ?? "Facebook authorization denied";
    return NextResponse.redirect(`${successBase}?error=${encodeURIComponent(msg)}`);
  }

  // Missing params
  if (!code || !state) {
    return NextResponse.redirect(`${successBase}?error=${encodeURIComponent("Missing code or state parameter")}`);
  }

  // Verify the admin session
  const session = await auth();
  if (!session?.user?.id) {
    // Redirect to login — this should rarely happen (popup opened by authenticated admin)
    return NextResponse.redirect(`${baseUrl}/login`);
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const version = process.env.META_GRAPH_API_VERSION ?? "v21.0";

  if (!appId || !appSecret) {
    return NextResponse.redirect(
      `${successBase}?error=${encodeURIComponent("META_APP_ID or META_APP_SECRET not configured")}`
    );
  }

  const redirectUri = `${baseUrl}/api/meta/oauth/callback`;
  const clientId = state;

  try {
    // Exchange authorization code for access token
    const tokenUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || tokenData.error) {
      const msg = tokenData.error?.message ?? "Failed to exchange code for token";
      return NextResponse.redirect(`${successBase}?error=${encodeURIComponent(msg)}`);
    }

    const accessToken: string = tokenData.access_token;

    // Save the connection via the existing Meta service
    await metaService.connect(
      {
        clientId,
        connectionName: `Facebook OAuth — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
        authMode: "user_token",
        accessToken,
        metaAppId: appId,
      },
      session.user.id as string
    );

    return NextResponse.redirect(`${successBase}?clientId=${encodeURIComponent(clientId)}`);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred";
    return NextResponse.redirect(`${successBase}?error=${encodeURIComponent(message)}`);
  }
}
