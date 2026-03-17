import { NextRequest, NextResponse } from "next/server";
import { requirePermission, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";
import { z } from "zod";

const patchSchema = z.object({
  accountId: z.string().uuid(),
  isAssigned: z.boolean(),
});

export async function PATCH(req: NextRequest) {
  try {
    await requirePermission("MANAGE_META_CONNECTIONS");
    const body = await req.json();
    const { accountId, isAssigned } = patchSchema.parse(body);

    const account = await prisma.adAccount.update({
      where: { id: accountId },
      data: { isAssigned },
      select: { id: true, name: true, isAssigned: true },
    });

    return NextResponse.json(account);
  } catch (e) {
    return handleAuthError(e);
  }
}
