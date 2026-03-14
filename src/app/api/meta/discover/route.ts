import { NextRequest } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/auth/guards";
import { queueJob } from "@/workers/scheduler";
import { z } from "zod";

const schema = z.object({ clientId: z.string().uuid() });

export async function POST(req: NextRequest) {
  try {
    await requirePermission("MANAGE_META_CONNECTIONS");
    const body = await req.json();
    const { clientId } = schema.parse(body);
    const jobId = await queueJob("asset_discovery", clientId);
    return Response.json({ jobId, message: "Asset discovery queued" }, { status: 202 });
  } catch (e) {
    return handleAuthError(e);
  }
}
