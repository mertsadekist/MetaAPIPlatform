import { auth } from "@/lib/auth/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const userRole = (session?.user as any)?.role;

  // Public routes
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/shared/") ||
    pathname.startsWith("/api/meta/oauth/callback") ||
    /^\/api\/shared-links\/[^/]+\/view$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Require auth for all other routes
  if (!session) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin routes — require owner or analyst
  if (pathname.startsWith("/admin")) {
    if (userRole !== "owner" && userRole !== "analyst") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
