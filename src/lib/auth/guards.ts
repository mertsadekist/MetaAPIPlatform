import { auth } from "./auth";
import type { Role } from "./rbac";
import { hasPermission, PERMISSIONS } from "./rbac";
import prisma from "@/lib/db/client";

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = "AuthError";
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AuthSession = { user: any; expires: string };

export async function requireAuth(): Promise<AuthSession> {
  const session = await auth();
  if (!session?.user) {
    throw new AuthError("Unauthorized", 401);
  }
  return session as AuthSession;
}

export async function requireRole(allowedRoles: Role[]): Promise<AuthSession> {
  const session = await requireAuth();
  const userRole = session.user.role as Role;

  if (!allowedRoles.includes(userRole)) {
    throw new AuthError("Forbidden: insufficient role", 403);
  }

  return session;
}

export async function requireOwner(): Promise<AuthSession> {
  return requireRole(["owner"]);
}

export async function requireClientAccess(clientId: string): Promise<AuthSession> {
  const session = await requireAuth();
  const userRole = session.user.role as Role;

  // Owner and analyst can see all clients
  if (userRole === "owner" || userRole === "analyst") {
    return session;
  }

  // Check specific client access
  const access = await prisma.clientUserAccess.findUnique({
    where: {
      clientId_userId: {
        clientId,
        userId: session.user.id as string,
      },
    },
  });

  if (!access) {
    throw new AuthError("Forbidden: no access to this client", 403);
  }

  return session;
}

export async function requirePermission(
  permission: keyof typeof PERMISSIONS,
  clientId?: string
): Promise<AuthSession> {
  const session = await requireAuth();
  const userRole = session.user.role as Role;

  if (!hasPermission(userRole, permission)) {
    throw new AuthError(`Forbidden: missing permission ${permission}`, 403);
  }

  if (clientId) {
    await requireClientAccess(clientId);
  }

  return session;
}

export function handleAuthError(error: unknown): Response {
  if (error instanceof AuthError) {
    return Response.json(
      { error: error.message },
      { status: error.statusCode }
    );
  }
  throw error;
}

/**
 * Returns null  → no restrictions; caller should show ALL ad accounts.
 * Returns string[] → only these adAccountIds are accessible for this user.
 *
 * Owner and analyst always bypass (return null).
 * For other roles: if no rows exist in user_ad_account_access → return null (backward-compatible).
 */
export async function getAccessibleAdAccountIds(
  session: AuthSession,
  clientId: string
): Promise<string[] | null> {
  const role = session.user.role as Role;
  if (role === "owner" || role === "analyst") return null;

  const rows = await prisma.userAdAccountAccess.findMany({
    where: {
      userId: session.user.id as string,
      adAccount: { clientId },
    },
    select: { adAccountId: true },
  });

  if (rows.length === 0) return null; // no restrictions → see all
  return rows.map((r) => r.adAccountId);
}
