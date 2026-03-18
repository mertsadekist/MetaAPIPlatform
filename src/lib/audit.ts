import prisma from "@/lib/db/client";

export type AuditEventType =
  | "user.login"
  | "user.logout"
  | "user.login_failed"
  | "user.account_locked"
  | "user.password_reset_request"
  | "user.password_reset"
  | "user.2fa_enabled"
  | "user.2fa_disabled"
  | "user.created"
  | "user.updated"
  | "user.deactivated"
  | "client.created"
  | "client.updated"
  | "client.deleted"
  | "client.user_assigned"
  | "client.user_removed"
  | "meta.token_connected"
  | "meta.token_revoked"
  | "meta.sync_triggered"
  | "meta.manual_account_added"
  | "meta_connection_created"
  | "meta_connection_deleted"
  | "lead.quality_updated"
  | "lead.imported"
  | "recommendation.dismissed"
  | "shared_link.created"
  | "shared_link.deleted"
  | "export.campaigns"
  | "export.creatives"
  | "export.leads"
  | "alert.recipient_added"
  | "alert.recipient_removed"
  | "billing.subscription_created"
  | "billing.subscription_cancelled"
  | "billing.payment_received";

export interface AuditLogInput {
  eventType: AuditEventType;
  userId?: string;
  clientId?: string;
  entityRefId?: string;
  eventScope?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export async function logAuditEvent(input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        eventType: input.eventType,
        userId: input.userId,
        clientId: input.clientId,
        entityRefId: input.entityRefId,
        eventScope: input.eventScope,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: (input.metadata ?? undefined) as any,
      },
    });
  } catch {
    // Audit logging should never break the main flow
    console.error("Failed to write audit log", input.eventType);
  }
}
