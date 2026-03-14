import { NextRequest, NextResponse } from "next/server";
import { requireRole, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit";

const createUserSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email().optional(),
  password: z.string().min(8),
  displayName: z.string().max(100).optional(),
  role: z.enum(["owner", "analyst", "client_manager", "client_viewer"]),
});

export async function GET() {
  try {
    await requireRole(["owner"]);
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        role: true,
        isActive: true,
        is2faEnabled: true,
        createdAt: true,
        _count: { select: { clientAccess: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(users);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(["owner"]);
    const body = await req.json();
    const data = createUserSchema.parse(body);

    const passwordHash = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        passwordHash,
        displayName: data.displayName,
        role: data.role,
      },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    await logAuditEvent({
      eventType: "user.created",
      userId: session.user?.id ?? undefined,
      entityRefId: user.id,
      eventScope: "users",
      metadata: { username: user.username, role: user.role },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return handleAuthError(error);
  }
}
