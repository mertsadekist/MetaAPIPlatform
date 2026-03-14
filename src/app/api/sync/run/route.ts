import { NextRequest } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/auth/guards";
import { queueJob } from "@/workers/scheduler";
import { z } from "zod";

const schema = z.object({
  clientId: z.string().uuid(),
  jobType: z.enum(["asset_discovery", "hourly_sync", "daily_reconcile", "budget_pacing"]),
});

export async function POST(req: NextRequest) {
  try {
    await requirePermission("TRIGGER_SYNC");
    const body = await req.json();
    const { clientId, jobType } = schema.parse(body);
    const jobId = await queueJob(jobType, clientId);
    return Response.json({ jobId, message: `${jobType} queued` }, { status: 202 });
  } catch (e) {
    return handleAuthError(e);
  }
}
