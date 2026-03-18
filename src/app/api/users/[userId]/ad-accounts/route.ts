import { NextRequest, NextResponse } from "next/server";
import { requireRole, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";
import { z } from "zod";

const setAccessSchema = z.object({
  clientId: z.string(),
  adAccountIds: z.array(z.string()),
  permissionLevel: z.enum(["view", "manage"]).default("view"),
});

/**
 * GET /api/users/[userId]/ad-accounts?clientId=xxx
 * Returns current per-account restrictions for a user within a client.
 * Empty array = no restrictions (user sees all accounts).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    await requireRole(["owner"]);

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");

    const where = clientId
      ? { userId, adAccount: { clientId } }
      : { userId };

    const restrictions = await prisma.userAdAccountAccess.findMany({
      where,
      select: {
        adAccountId: true,
        permissionLevel: true,
        adAccount: {
          select: { name: true, metaAdAccountId: true, clientId: true },
        },
      },
    });

    return NextResponse.json({ restrictions });
  } catch (error) {
    return handleAuthError(error);
  }
}

/**
 * PUT /api/users/[userId]/ad-accounts
 * Replaces the ad account access list for a user within a specific client.
 * Body: { clientId, adAccountIds: string[], permissionLevel: "view"|"manage" }
 * If adAccountIds is empty → removes all restrictions (user sees all accounts).
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    await requireRole(["owner"]);

    const body = await req.json();
    const { clientId, adAccountIds, permissionLevel } = setAccessSchema.parse(body);

    // Get all ad account IDs for this client (to scope the delete)
    const clientAccountIds = (
      await prisma.adAccount.findMany({
        where: { clientId },
        select: { id: true },
      })
    ).map((a) => a.id);

    await prisma.$transaction([
      // Remove existing restrictions for this user within this client's accounts
      prisma.userAdAccountAccess.deleteMany({
        where: {
          userId,
          adAccountId: { in: clientAccountIds },
        },
      }),
      // Create new restrictions (if any)
      ...(adAccountIds.length > 0
        ? [
            prisma.userAdAccountAccess.createMany({
              data: adAccountIds.map((adAccountId) => ({
                userId,
                adAccountId,
                permissionLevel,
              })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);

    return NextResponse.json({ success: true, count: adAccountIds.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }
    return handleAuthError(error);
  }
}
