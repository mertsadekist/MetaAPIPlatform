import { NextRequest, NextResponse } from "next/server";
import { requireRole, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit";

const changePasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const session = await requireRole(["owner"]);
    const body = await req.json();
    const { password } = changePasswordSchema.parse(body);

    const passwordHash = await hashPassword(password);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await logAuditEvent({
      eventType: "user.updated",
      userId: session.user?.id ?? undefined,
      entityRefId: userId,
      eventScope: "users",
      metadata: { action: "password_changed" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "P2025"
    ) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return handleAuthError(error);
  }
}
