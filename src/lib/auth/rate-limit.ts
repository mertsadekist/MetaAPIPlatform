import prisma from "@/lib/db/client";
import logger from "@/lib/logger";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 30;

export async function checkLoginRateLimit(username: string): Promise<{
  allowed: boolean;
  lockedUntil: Date | null;
}> {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { loginAttemptCount: true, lockedUntil: true },
  });

  if (!user) return { allowed: true, lockedUntil: null };

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { allowed: false, lockedUntil: user.lockedUntil };
  }

  // Reset lockout if expired
  if (user.lockedUntil && user.lockedUntil <= new Date()) {
    await prisma.user.update({
      where: { username },
      data: { loginAttemptCount: 0, lockedUntil: null },
    });
  }

  return { allowed: true, lockedUntil: null };
}

export async function recordFailedLogin(username: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, loginAttemptCount: true },
  });

  if (!user) return;

  const newCount = user.loginAttemptCount + 1;
  const shouldLock = newCount >= MAX_ATTEMPTS;

  await prisma.user.update({
    where: { username },
    data: {
      loginAttemptCount: newCount,
      lockedUntil: shouldLock
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
        : undefined,
    },
  });

  if (shouldLock) {
    logger.warn({ username }, "Account locked after too many failed attempts");
  }
}

export async function resetLoginAttempts(username: string): Promise<void> {
  await prisma.user.update({
    where: { username },
    data: { loginAttemptCount: 0, lockedUntil: null },
  });
}
