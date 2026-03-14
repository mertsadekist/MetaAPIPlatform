/**
 * Alert Dispatcher
 * Picks up pending InstantAlerts and sends them via email to configured recipients.
 */

import prisma from "@/lib/db/client";
import logger from "@/lib/logger";
import nodemailer from "nodemailer";

interface JobResult {
  success: boolean;
  itemsProcessed: number;
  errors: string[];
}

const SEVERITY_EMOJI: Record<string, string> = {
  critical: "🚨",
  high: "⚠️",
  medium: "📢",
  low: "ℹ️",
};

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM ?? "alerts@platform.local";

  if (!host || !user || !pass) {
    return null;
  }

  return { transporter: nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } }), from };
}

function buildEmailHtml(alert: {
  title: string;
  message: string;
  severity: string;
  alertType: string;
  createdAt: Date;
  metadata: Record<string, unknown> | null;
}): string {
  const emoji = SEVERITY_EMOJI[alert.severity] ?? "📣";
  const color = alert.severity === "critical" ? "#dc2626" : alert.severity === "high" ? "#ea580c" : "#2563eb";

  const metaRows = alert.metadata
    ? Object.entries(alert.metadata)
        .map(([k, v]) => `<tr><td style="padding:4px 8px;color:#6b7280;font-size:12px;">${k}</td><td style="padding:4px 8px;font-size:12px;font-weight:500;">${String(v)}</td></tr>`)
        .join("")
    : "";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#f3f4f6;margin:0;padding:32px 16px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:${color};padding:16px 24px;">
      <p style="margin:0;color:#fff;font-size:18px;font-weight:700;">${emoji} ${alert.title}</p>
      <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">${alert.severity} · ${alert.alertType.replace(/_/g, " ")}</p>
    </div>
    <div style="padding:24px;">
      <p style="color:#111827;font-size:14px;margin:0 0 16px;">${alert.message}</p>
      ${metaRows ? `
      <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden;">
        <tbody>${metaRows}</tbody>
      </table>` : ""}
      <p style="color:#9ca3af;font-size:11px;margin:16px 0 0;">Generated ${alert.createdAt.toLocaleString()}</p>
    </div>
  </div>
</body>
</html>`;
}

export async function runAlertDispatcher(): Promise<JobResult> {
  const log = logger.child({ job: "alert-dispatcher" });
  const errors: string[] = [];
  let dispatched = 0;

  const smtp = getTransporter();
  if (!smtp) {
    log.warn("SMTP not configured — skipping alert dispatch");
    return { success: true, itemsProcessed: 0, errors: [] };
  }

  // Get pending alerts
  const pending = await prisma.instantAlert.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  if (pending.length === 0) return { success: true, itemsProcessed: 0, errors: [] };

  log.info({ count: pending.length }, "Processing pending alerts");

  for (const alert of pending) {
    try {
      // Get email recipients for this client
      const recipients = await prisma.alertRecipient.findMany({
        where: {
          clientId: alert.clientId,
          isActive: true,
          channel: "email",
        },
      });

      if (recipients.length === 0) {
        // No recipients — mark as sent anyway so it doesn't pile up
        await prisma.instantAlert.update({
          where: { id: alert.id },
          data: { status: "sent", sentAt: new Date(), errorMsg: "No email recipients configured" },
        });
        continue;
      }

      // Filter by alertTypes if configured
      const eligibleRecipients = recipients.filter((r) => {
        if (!r.alertTypes) return true; // receives all
        const types = r.alertTypes as string[];
        return types.includes(alert.alertType) || types.includes(alert.severity);
      });

      if (eligibleRecipients.length === 0) {
        await prisma.instantAlert.update({
          where: { id: alert.id },
          data: { status: "sent", sentAt: new Date(), errorMsg: "No matching recipients for this alert type" },
        });
        continue;
      }

      const toAddresses = eligibleRecipients.map((r) => r.identifier);
      const html = buildEmailHtml({
        title: alert.title,
        message: alert.message,
        severity: alert.severity,
        alertType: alert.alertType,
        createdAt: alert.createdAt,
        metadata: alert.metadata as Record<string, unknown> | null,
      });

      await smtp.transporter.sendMail({
        from: smtp.from,
        to: toAddresses.join(", "),
        subject: `${SEVERITY_EMOJI[alert.severity] ?? "📣"} ${alert.title}`,
        html,
      });

      await prisma.instantAlert.update({
        where: { id: alert.id },
        data: { status: "sent", sentAt: new Date() },
      });

      dispatched++;
      log.info({ alertId: alert.id, recipients: toAddresses.length }, "Alert sent");
    } catch (err) {
      const msg = String(err);
      errors.push(`Alert ${alert.id}: ${msg}`);
      log.error({ alertId: alert.id, error: msg }, "Failed to send alert");

      await prisma.instantAlert.update({
        where: { id: alert.id },
        data: { status: "failed", errorMsg: msg },
      });
    }
  }

  return { success: errors.length === 0, itemsProcessed: dispatched, errors };
}
