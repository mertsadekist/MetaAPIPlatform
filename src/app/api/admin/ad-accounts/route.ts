import { NextRequest } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";
import {
  getEffectiveAdAccountLimit,
  type SubscriptionPlan,
} from "@/lib/subscriptions/plans";

export async function PATCH(req: NextRequest) {
  try {
    await requirePermission("MANAGE_META_CONNECTIONS");
    const { assignments } = (await req.json()) as {
      assignments: { accountId: string; isAssigned: boolean }[];
    };

    if (!Array.isArray(assignments) || assignments.length === 0) {
      return Response.json({ error: "assignments array required" }, { status: 400 });
    }

    // ── Quota check: only for accounts being assigned (isAssigned: true) ──
    const toAssign = assignments.filter((a) => a.isAssigned);
    if (toAssign.length > 0) {
      const accountRows = await prisma.adAccount.findMany({
        where: { id: { in: toAssign.map((a) => a.accountId) } },
        select: { id: true, clientId: true },
      });

      const clientIds = [...new Set(accountRows.map((a) => a.clientId))];
      for (const clientId of clientIds) {
        const client = await prisma.client.findUnique({
          where: { id: clientId },
          select: { subscriptionPlan: true, maxAdAccounts: true },
        });
        if (!client) continue;

        const limit = getEffectiveAdAccountLimit(
          client.subscriptionPlan as SubscriptionPlan,
          client.maxAdAccounts
        );
        if (limit === null) continue; // unlimited

        // Count currently assigned (excluding ones being toggled in this batch)
        const togglingIds = accountRows
          .filter((a) => a.clientId === clientId)
          .map((a) => a.id);

        const currentAssigned = await prisma.adAccount.count({
          where: {
            clientId,
            isAssigned: true,
            id: { notIn: togglingIds },
          },
        });

        if (currentAssigned + togglingIds.length > limit) {
          return Response.json(
            {
              error: `Ad account limit reached for this client (${limit} max on current plan). Upgrade the subscription plan or increase the custom quota.`,
            },
            { status: 400 }
          );
        }
      }
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

    const [accounts, client] = await Promise.all([
      prisma.adAccount.findMany({
        where: { clientId },
        include: {
          businessManager: {
            select: { id: true, name: true, metaBusinessId: true },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.client.findUnique({
        where: { id: clientId },
        select: { subscriptionPlan: true, maxAdAccounts: true },
      }),
    ]);

    const limit = client
      ? getEffectiveAdAccountLimit(
          client.subscriptionPlan as SubscriptionPlan,
          client.maxAdAccounts
        )
      : null;

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
      assigned: mapped.filter((a) => a.isAssigned).length,
      quota: { limit, plan: client?.subscriptionPlan ?? "pro" },
    });
  } catch (e) {
    return handleAuthError(e);
  }
}
