import { NextRequest } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/guards";
import { metaService } from "@/modules/meta/meta.service";
import { validateTokenSchema } from "@/modules/meta/meta.schema";
import { ZodError } from "zod";

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json();
    const { accessToken } = validateTokenSchema.parse(body);
    const result = await metaService.validateToken(accessToken);
    return Response.json(result);
  } catch (e) {
    if (e instanceof ZodError) {
      return Response.json({ error: "Invalid input", details: e.issues }, { status: 400 });
    }
    return handleAuthError(e);
  }
}
