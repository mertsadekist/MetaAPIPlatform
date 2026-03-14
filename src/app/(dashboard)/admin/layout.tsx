import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/layout/AdminSidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const userRole = (session.user as any).role;
  if (userRole !== "owner" && userRole !== "analyst") {
    redirect("/login");
  }

  const username = (session.user as any).username ?? session.user.name ?? "User";

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar username={username} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
