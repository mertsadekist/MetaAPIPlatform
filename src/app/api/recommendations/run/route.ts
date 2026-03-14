import { NextRequest } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/auth/guards";
import { runRulesEngine } from "@/modules/recommendations/rules.engine";
import { z } from "zod";

const schema = z.object({ clientId: z.string().uuid() });

export async function POST(req: NextRequest) {
  try {
    await requirePermission("TRIGGER_SYNC");
    const body = await req.json();
    const { clientId } = schema.parse(body);
    const result = await runRulesEngine(clientId);
    return Response.json(result);
  } catch (e) {
    return handleAuthError(e);
  }
}
