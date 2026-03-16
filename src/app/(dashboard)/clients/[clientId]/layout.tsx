import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/db/client";
import { ClientSidebar } from "@/components/layout/ClientSidebar";
import { NotificationBell } from "@/components/ui/NotificationBell";

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
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header bar */}
        <header className="h-12 bg-white border-b border-gray-200 flex items-center justify-end px-6 flex-shrink-0">
          <NotificationBell clientId={clientId} />
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
