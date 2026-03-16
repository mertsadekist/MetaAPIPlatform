"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  BarChart2,
  Megaphone,
  Image,
  Users,
  MessageCircle,
  Search,
  GitCompare,
  FileText,
  Bell,
  Settings,
  LogOut,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

function navItems(clientId: string) {
  return [
    { href: `/clients/${clientId}/overview`, label: "Overview", icon: BarChart2 },
    { href: `/clients/${clientId}/campaigns`, label: "Campaigns", icon: Megaphone },
    { href: `/clients/${clientId}/creatives`, label: "Creatives", icon: Image },
    { href: `/clients/${clientId}/leads`, label: "Leads & Quality", icon: Users },
    { href: `/clients/${clientId}/whatsapp`, label: "WhatsApp", icon: MessageCircle },
    { href: `/clients/${clientId}/budget`, label: "Budget & Pacing", icon: Wallet },
    { href: `/clients/${clientId}/competitors`, label: "Competitors", icon: Search },
    { href: `/clients/${clientId}/comparisons`, label: "Comparisons", icon: GitCompare },
    { href: `/clients/${clientId}/reports`, label: "Reports", icon: FileText },
    { href: `/clients/${clientId}/alerts`, label: "Alerts", icon: Bell },
    { href: `/clients/${clientId}/settings`, label: "Settings", icon: Settings },
  ];
}

interface ClientSidebarProps {
  clientId: string;
  clientName: string;
  username: string;
}

export function ClientSidebar({ clientId, clientName, username }: ClientSidebarProps) {
  const pathname = usePathname();
  const items = navItems(clientId);

  return (
    <aside className="flex flex-col w-60 min-h-screen bg-gray-900 text-gray-100">
      {/* Client Name */}
      <div className="px-4 py-5 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-white uppercase">
              {clientName[0]}
            </span>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">{clientName}</div>
            <div className="text-xs text-gray-400">Client Portal</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href);
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
          <Link href="/profile" className="flex items-center gap-2 min-w-0 group">
            <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-blue-500 transition-colors">
              <span className="text-xs font-medium text-white uppercase">{username[0]}</span>
            </div>
            <span className="text-sm text-gray-300 truncate group-hover:text-white transition-colors">{username}</span>
          </Link>
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
