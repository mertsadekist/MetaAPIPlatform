import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/db/client";
import { ClientSidebar } from "@/components/layout/ClientSidebar";

export default async function ClientPortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const session = await auth();

  if (!session?.user) redirect("/login");

  const userRole = (session.user as any).role;
  const userId = session.user.id ?? "";

  // Check access
  if (userRole !== "owner" && userRole !== "analyst") {
    const access = await prisma.clientUserAccess.findUnique({
      where: { clientId_userId: { clientId, userId } },
    });
    if (!access) redirect("/login");
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { displayName: true, isActive: true },
  });

  if (!client || !client.isActive) redirect("/admin");

  const username = (session.user as any).username ?? session.user.name ?? "User";

  return (
    <div className="flex min-h-screen bg-gray-50">
      <ClientSidebar
        clientId={clientId}
        clientName={client.displayName}
        username={username}
      />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
