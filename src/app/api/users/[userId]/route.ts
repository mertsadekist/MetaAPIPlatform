import { NextRequest, NextResponse } from "next/server";
import { requireRole, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit";

const updateUserSchema = z.object({
  displayName: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().max(100).optional()
  ),
  email: z.preprocess(
    (v) => (v === "" ? null : v),
    z.string().email().nullable().optional()
  ),
  role: z
    .enum(["owner", "analyst", "client_manager", "client_viewer"])
    .optional(),
  isActive: z.boolean().optional(),
});

const USER_SELECT = {
  id: true,
  username: true,
  email: true,
  displayName: true,
  role: true,
  isActive: true,
  is2faEnabled: true,
  createdAt: true,
  _count: { select: { clientAccess: true } },
} as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const session = await requireRole(["owner"]);
    const body = await req.json();
    const data = updateUserSchema.parse(body);

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: USER_SELECT,
    });

    await logAuditEvent({
      eventType: "user.updated",
      userId: session.user?.id ?? undefined,
      entityRefId: userId,
      eventScope: "users",
      metadata: { fields: Object.keys(data) },
    });

    return NextResponse.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }
    if (error instanceof Error && "code" in error) {
      const code = (error as { code: string }).code;
      if (code === "P2002") {
        return NextResponse.json(
          { error: "Email already in use by another account" },
          { status: 409 }
        );
      }
      if (code === "P2025") {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
    }
    return handleAuthError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const session = await requireRole(["owner"]);

    if (userId === (session.user?.id as string)) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      );
    }

    await prisma.user.delete({ where: { id: userId } });

    await logAuditEvent({
      eventType: "user.updated",
      userId: session.user?.id ?? undefined,
      entityRefId: userId,
      eventScope: "users",
      metadata: { action: "deleted" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
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
