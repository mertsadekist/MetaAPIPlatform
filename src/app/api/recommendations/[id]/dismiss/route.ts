import { NextRequest } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    await prisma.recommendation.update({
      where: { id },
      data: {
        status: "dismissed",
        dismissedAt: new Date(),
        dismissedBy: session.user.id as string,
      },
    });

    return Response.json({ success: true });
  } catch (e) {
    return handleAuthError(e);
  }
}
