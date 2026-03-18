import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";
import { MetaApiClient } from "@/lib/meta/client";
import { decryptToken } from "@/lib/meta/crypto";
import { logAuditEvent } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({
  clientId: z.string().uuid(),
  connectionId: z.string().uuid(),
  metaAdAccountId: z.string().min(1),
  action: z.enum(["verify", "save"]),
});

const STATUS_MAP: Record<number, string> = {
  1: "ACTIVE",
  2: "DISABLED",
  3: "UNSETTLED",
  9: "IN_GRACE_PERIOD",
  100: "PENDING_CLOSURE",
  101: "CLOSED",
};

export async function POST(req: NextRequest) {
  try {
    await requirePermission("MANAGE_META_CONNECTIONS");
    const body = await req.json();
    const { clientId, connectionId, metaAdAccountId, action } = schema.parse(body);

    // Load connection and verify it belongs to this client
    const connection = await prisma.metaConnection.findFirst({
      where: { id: connectionId, clientId },
    });
    if (!connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    const token = decryptToken(connection.accessTokenHash);
    const api = new MetaApiClient(token);

    let account: {
      id: string;
      name: string;
      currency: string;
      timezone_name: string;
      account_status: number;
      business?: { id: string; name: string };
    };

    try {
      account = await api.getAdAccountById(metaAdAccountId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to access ad account";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const statusLabel =
      STATUS_MAP[account.account_status] ?? `STATUS_${account.account_status}`;
    const normalizedId = metaAdAccountId.startsWith("act_")
      ? metaAdAccountId
      : `act_${metaAdAccountId}`;

    if (action === "verify") {
      return NextResponse.json({
        verified: true,
        account: {
          id: normalizedId,
          name: account.name,
          currency: account.currency,
          timezone_name: account.timezone_name,
          account_status: account.account_status,
          statusLabel,
          business: account.business,
        },
      });
    }

    // action === "save" — upsert BusinessManager + AdAccount
    let bmDbId: string | null = null;
    if (account.business?.id) {
      const bm = await prisma.businessManager.upsert({
        where: { metaBusinessId: account.business.id },
        create: {
          clientId,
          metaBusinessId: account.business.id,
          name: account.business.name,
          isActive: true,
          rawPayload: JSON.stringify(account.business),
        },
        update: {
          name: account.business.name,
          lastSyncedAt: new Date(),
        },
      });
      bmDbId = bm.id;
    }

    const saved = await prisma.adAccount.upsert({
      where: { metaAdAccountId: normalizedId },
      create: {
        clientId,
        metaAdAccountId: normalizedId,
        businessManagerId: bmDbId,
        name: account.name,
        currency: account.currency,
        timezone: account.timezone_name,
        effectiveStatus: statusLabel,
        isActive: true,
        isAssigned: false,
        rawPayload: JSON.stringify(account),
        lastSyncedAt: new Date(),
      },
      update: {
        name: account.name,
        currency: account.currency,
        timezone: account.timezone_name,
        effectiveStatus: statusLabel,
        lastSyncedAt: new Date(),
      },
      select: {
        id: true,
        metaAdAccountId: true,
        name: true,
        currency: true,
        timezone: true,
        effectiveStatus: true,
        isActive: true,
        isAssigned: true,
        lastSyncedAt: true,
        businessManager: {
          select: { id: true, name: true, metaBusinessId: true },
        },
      },
    });

    await logAuditEvent({
      eventType: "meta.manual_account_added",
      entityRefId: saved.id,
      eventScope: "meta",
      metadata: { metaAdAccountId: normalizedId, clientId, name: account.name },
    });

    return NextResponse.json({ saved: true, adAccount: saved });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: e.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }
    return handleAuthError(e);
  }
}
