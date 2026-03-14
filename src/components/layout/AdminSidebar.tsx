"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  BarChart2,
  Users,
  RefreshCw,
  FileText,
  Settings,
  LogOut,
  Building2,
  Plug,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: BarChart2, exact: true },
  { href: "/admin/clients", label: "Clients", icon: Building2 },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/meta", label: "Meta Connections", icon: Plug },
  { href: "/admin/sync-logs", label: "Sync Logs", icon: RefreshCw },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: FileText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

interface AdminSidebarProps {
  username: string;
}

export function AdminSidebar({ username }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col w-60 min-h-screen bg-gray-900 text-gray-100">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-700">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <BarChart2 className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-sm">Meta Ads Platform</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              )}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-medium text-white uppercase">
                {username[0]}
              </span>
            </div>
            <span className="text-sm text-gray-300 truncate">{username}</span>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-gray-400 hover:text-white transition-colors p-1"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
