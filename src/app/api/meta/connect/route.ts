import { NextRequest } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/auth/guards";
import { metaService } from "@/modules/meta/meta.service";
import { connectMetaSchema } from "@/modules/meta/meta.schema";
import { ZodError } from "zod";

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("MANAGE_META_CONNECTIONS");
    const body = await req.json();
    const input = connectMetaSchema.parse(body);

    const result = await metaService.connect(input, session.user.id as string);

    return Response.json({
      connection: result.connection,
      warnings: result.missingScopes.length > 0
        ? { missingScopes: result.missingScopes }
        : undefined,
    }, { status: 201 });
  } catch (e) {
    if (e instanceof ZodError) {
      return Response.json({ error: "Invalid input", details: e.issues }, { status: 400 });
    }
    return handleAuthError(e);
  }
}
