import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import prisma from "@/lib/db/client";
import { verifyPassword } from "./password";
import {
  checkLoginRateLimit,
  recordFailedLogin,
  resetLoginAttempts,
} from "./rate-limit";
import logger from "@/lib/logger";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const username = credentials.username as string;
        const password = credentials.password as string;

        // Check rate limit / lockout
        const { allowed, lockedUntil } = await checkLoginRateLimit(username);
        if (!allowed) {
          logger.warn({ username, lockedUntil }, "Login attempted on locked account");
          throw new Error(`Account locked until ${lockedUntil?.toISOString()}`);
        }

        // Find user
        const user = await prisma.user.findUnique({
          where: { username },
        });

        if (!user || !user.isActive) {
          await recordFailedLogin(username);
          return null;
        }

        // Verify password
        const valid = await verifyPassword(user.passwordHash, password);
        if (!valid) {
          await recordFailedLogin(username);
          logger.warn({ username }, "Failed login attempt");
          return null;
        }

        // Reset attempt count on success
        await resetLoginAttempts(username);

        logger.info({ userId: user.id, username }, "User logged in");

        // Log to audit
        await prisma.auditLog.create({
          data: {
            eventType: "user.login",
            userId: user.id,
            eventScope: "auth",
            metadata: { username },
          },
        });

        // Return 2FA flag if needed
        return {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.displayName,
          role: user.role,
          is2faEnabled: user.is2faEnabled,
          requires2fa: user.is2faEnabled,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = (user as any).username;
        token.role = (user as any).role;
        token.is2faEnabled = (user as any).is2faEnabled;
        token.requires2fa = (user as any).requires2fa;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        (session.user as any).username = token.username;
        (session.user as any).role = token.role;
        (session.user as any).is2faEnabled = token.is2faEnabled;
        (session.user as any).requires2fa = token.requires2fa;
        (session.user as any).isOwner = token.role === "owner";
      }
      return session;
    },
  },
});
