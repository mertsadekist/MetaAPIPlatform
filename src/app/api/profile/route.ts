import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth/guards";
import prisma from "@/lib/db/client";
import bcrypt from "bcryptjs";

/**
 * GET /api/profile — return current user's profile
 */
export async function GET() {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id as string;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: { select: { clientAccess: true } },
      },
    });

    return NextResponse.json({ user });
  } catch (e) {
    return handleAuthError(e);
  }
}

/**
 * PUT /api/profile — update display name or password
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id as string;
    const body = await req.json();

    const updates: { displayName?: string; passwordHash?: string } = {};

    if (body.displayName !== undefined) {
      const name = String(body.displayName).trim();
      if (name.length < 2) {
        return NextResponse.json({ error: "Display name must be at least 2 characters" }, { status: 400 });
      }
      updates.displayName = name;
    }

    if (body.newPassword) {
      if (!body.currentPassword) {
        return NextResponse.json({ error: "Current password is required" }, { status: 400 });
      }
      if (String(body.newPassword).length < 8) {
        return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
      }

      // Verify current password
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
      if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

      const valid = await bcrypt.compare(String(body.currentPassword), user.passwordHash);
      if (!valid) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
      }

      updates.passwordHash = await bcrypt.hash(String(body.newPassword), 12);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No changes provided" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updates,
      select: { id: true, username: true, email: true, displayName: true, role: true },
    });

    return NextResponse.json({ user: updated });
  } catch (e) {
    return handleAuthError(e);
  }
}
