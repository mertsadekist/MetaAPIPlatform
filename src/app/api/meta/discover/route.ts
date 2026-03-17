import { NextRequest } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/auth/guards";
import { runAssetDiscovery } from "@/workers/jobs/asset-discovery";
import { z } from "zod";

const schema = z.object({ clientId: z.string().uuid() });

export async function POST(req: NextRequest) {
  try {
    await requirePermission("MANAGE_META_CONNECTIONS");
    const body = await req.json();
    const { clientId } = schema.parse(body);

    // Run discovery synchronously so the caller gets real results immediately
    const result = await runAssetDiscovery(clientId);

    if (!result.success) {
      return Response.json(
        { message: "Discovery completed with errors", errors: result.errors, itemsProcessed: result.itemsProcessed },
        { status: 207 }
      );
    }

    return Response.json(
      { message: "Asset discovery complete", itemsProcessed: result.itemsProcessed },
      { status: 200 }
    );
  } catch (e) {
    return handleAuthError(e);
  }
}
