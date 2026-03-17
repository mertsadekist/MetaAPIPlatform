import { NextRequest } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";

export async function PATCH(req: NextRequest) {
  try {
    await requirePermission("MANAGE_META_CONNECTIONS");
    const { assignments } = await req.json() as {
      assignments: { accountId: string; isAssigned: boolean }[];
    };

    if (!Array.isArray(assignments) || assignments.length === 0) {
      return Response.json({ error: "assignments array required" }, { status: 400 });
    }

    await prisma.$transaction(
      assignments.map(({ accountId, isAssigned }) =>
        prisma.adAccount.update({ where: { id: accountId }, data: { isAssigned } })
      )
    );

    return Response.json({ updated: assignments.length });
  } catch (e) {
    return handleAuthError(e);
  }
}

export async function GET(req: NextRequest) {
  try {
    await requirePermission("MANAGE_META_CONNECTIONS");

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");

    if (!clientId) {
      return Response.json({ error: "clientId is required" }, { status: 400 });
    }

    const accounts = await prisma.adAccount.findMany({
      where: { clientId },
      include: {
        businessManager: {
          select: { id: true, name: true, metaBusinessId: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const mapped = accounts.map((a) => ({
      id: a.id,
      metaAdAccountId: a.metaAdAccountId,
      name: a.name,
      currency: a.currency,
      timezone: a.timezone,
      isActive: a.isActive,
      isAssigned: a.isAssigned,
      effectiveStatus: a.effectiveStatus,
      lastSyncedAt: a.lastSyncedAt,
      businessManager: a.businessManager
        ? {
            id: a.businessManager.id,
            name: a.businessManager.name,
            metaBusinessId: a.businessManager.metaBusinessId,
          }
        : null,
    }));

    return Response.json({
      adAccounts: mapped,
      total: mapped.length,
      active: mapped.filter((a) => a.isActive).length,
    });
  } catch (e) {
    return handleAuthError(e);
  }
}
