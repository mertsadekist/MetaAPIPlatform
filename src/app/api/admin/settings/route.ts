import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";

/**
 * GET /api/admin/settings
 * Returns runtime configuration status (no secrets exposed).
 */
export async function GET() {
  try {
    await requirePermission("MANAGE_SYSTEM_SETTINGS");

    const [clientCount, userCount, syncJobQueued, syncJobRunning, totalRuns] =
      await Promise.all([
        prisma.client.count({ where: { isActive: true } }),
        prisma.user.count({ where: { isActive: true } }),
        prisma.syncJob.count({ where: { status: "queued" } }),
        prisma.syncJob.count({ where: { status: "running" } }),
        prisma.syncRun.count(),
      ]);

    // Latest run per job type
    const recentRuns = await prisma.syncRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 20,
      select: { jobType: true, status: true, startedAt: true, durationMs: true },
    });

    const config = {
      meta: {
        appIdConfigured: !!process.env.META_APP_ID,
        appSecretConfigured: !!process.env.META_APP_SECRET,
        graphApiVersion: process.env.META_GRAPH_API_VERSION ?? "v21.0",
        adLibraryEnabled: process.env.META_AD_LIBRARY_ENABLED === "true",
        adLibraryCountries: process.env.META_AD_LIBRARY_DEFAULT_COUNTRIES ?? "SA,AE,EG",
      },
      email: {
        smtpHost: process.env.SMTP_HOST || null,
        smtpPort: process.env.SMTP_PORT || "587",
        smtpUserConfigured: !!process.env.SMTP_USER,
        smtpPasswordConfigured: !!process.env.SMTP_PASSWORD,
        fromEmail: process.env.SMTP_FROM_EMAIL || null,
        fromName: process.env.SMTP_FROM_NAME || null,
      },
      ai: {
        provider: process.env.AI_PROVIDER || "anthropic",
        apiKeyConfigured: !!process.env.AI_API_KEY,
        textModel: process.env.AI_MODEL_TEXT || "claude-sonnet-4-6",
        visionModel: process.env.AI_MODEL_VISION || "claude-sonnet-4-6",
      },
      whatsapp: {
        provider: process.env.WA_NOTIFICATION_PROVIDER || "twilio",
        twilioConfigured: !!(
          process.env.WA_TWILIO_ACCOUNT_SID && process.env.WA_TWILIO_AUTH_TOKEN
        ),
        fromPhone: process.env.WA_TWILIO_FROM_PHONE || null,
      },
      telegram: {
        enabled: process.env.TELEGRAM_ENABLED === "true",
        botConfigured: !!process.env.TELEGRAM_BOT_TOKEN,
      },
      app: {
        appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3005",
        sharedLinkExpiryDays: parseInt(process.env.SHARED_LINK_EXPIRY_DAYS ?? "7"),
        nodeEnv: process.env.NODE_ENV,
        logLevel: process.env.LOG_LEVEL || "info",
      },
    };

    const stats = { clientCount, userCount, syncJobQueued, syncJobRunning, totalRuns };

    return NextResponse.json({ config, stats, recentRuns });
  } catch (e) {
    return handleAuthError(e);
  }
}

/**
 * POST /api/admin/settings
 * Actions: test_email, trigger_job
 */
export async function POST(req: NextRequest) {
  try {
    await requirePermission("MANAGE_SYSTEM_SETTINGS");
    const body = await req.json();
    const { action } = body;

    if (action === "test_email") {
      const to: string = body.to;
      if (!to) return NextResponse.json({ error: "Missing 'to' address" }, { status: 400 });

      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = parseInt(process.env.SMTP_PORT ?? "587");
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASSWORD;
      const fromEmail = process.env.SMTP_FROM_EMAIL ?? "noreply@platform.com";
      const fromName = process.env.SMTP_FROM_NAME ?? "Meta Ads Platform";

      if (!smtpHost || !smtpUser || !smtpPass) {
        return NextResponse.json(
          { error: "SMTP not fully configured" },
          { status: 400 }
        );
      }

      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.default.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });

      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject: "Meta Ads Platform — Test Email",
        html: `<p>This is a test email from <strong>Meta Ads Platform</strong>. SMTP is configured correctly.</p><p>Sent at: ${new Date().toISOString()}</p>`,
      });

      return NextResponse.json({ success: true, message: `Test email sent to ${to}` });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    if (e?.name === "AuthError" || e?.message === "UNAUTHORIZED") return handleAuthError(e);
    return NextResponse.json({ error: e?.message ?? "Action failed" }, { status: 500 });
  }
}
