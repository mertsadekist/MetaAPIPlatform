/**
 * Seed script: Creates initial owner account
 * Run with: npx tsx scripts/seed-owner.ts
 *
 * Idempotent — safe to run multiple times
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

async function main() {
  const OWNER_USERNAME = process.env.SEED_OWNER_USERNAME ?? "admin";
  const OWNER_EMAIL = process.env.SEED_OWNER_EMAIL ?? undefined;
  const OWNER_PASSWORD =
    process.env.SEED_OWNER_PASSWORD ?? randomBytes(10).toString("hex");

  const existing = await prisma.user.findUnique({
    where: { username: OWNER_USERNAME },
  });

  if (existing) {
    console.log(`✓ Owner already exists: ${OWNER_USERNAME}`);
    console.log("  (Set SEED_OWNER_PASSWORD env var to reset password)");
    await prisma.$disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(OWNER_PASSWORD, 12);

  const user = await prisma.user.create({
    data: {
      username: OWNER_USERNAME,
      email: OWNER_EMAIL,
      passwordHash,
      displayName: "Platform Owner",
      role: "owner",
      isActive: true,
    },
  });

  console.log("✓ Owner account created:");
  console.log(`  Username: ${user.username}`);
  console.log(`  Password: ${OWNER_PASSWORD}`);
  if (OWNER_EMAIL) console.log(`  Email: ${OWNER_EMAIL}`);
  console.log("");
  console.log("⚠️  Save this password — it cannot be recovered!");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
