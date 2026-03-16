import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/db/client";

export default async function RootPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const role = (session.user as { role?: string }).role;

  // Admins / analysts → main admin dashboard
  if (role === "owner" || role === "analyst") {
    redirect("/admin");
  }

  // Client users → their first active client
  const access = await prisma.clientUserAccess.findFirst({
    where: { userId: session.user.id as string },
    include: { client: { select: { id: true, isActive: true } } },
    orderBy: { createdAt: "asc" },
  });

  if (access?.client?.isActive) {
    redirect(`/clients/${access.client.id}/overview`);
  }

  // Fallback – no accessible client
  redirect("/login");
}
