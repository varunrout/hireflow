"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  BarChart3,
  Bot,
  Briefcase,
  FileText,
  Home,
  LayoutDashboard,
  LogOut,
  Settings,
  Search,
} from "lucide-react";

import { authApi } from "@/lib/auth-api";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin", label: "Admin Tests", icon: ShieldCheck },
  { href: "/automation", label: "Automation", icon: Bot },
  { href: "/profile", label: "Profile", icon: Home },
  { href: "/resumes", label: "Resumes", icon: FileText },
  { href: "/jobs", label: "Jobs", icon: Search },
  { href: "/applications", label: "Applications", icon: Briefcase },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

type SidebarProps = {
  isOpen?: boolean;
  onClose?: () => void;
};

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await authApi.logout();
    router.push("/login");
    router.refresh();
  };

  return (
    <aside
      className={[
        // Base
        "flex h-screen w-64 flex-col border-r bg-card",
        // Desktop: always visible
        "hidden md:flex",
        // Mobile: fixed overlay, slide in when open
        isOpen
          ? "!flex fixed inset-y-0 left-0 z-40 shadow-xl"
          : "",
      ].join(" ")}
    >
      <div className="flex h-16 items-center border-b px-6">
        <span className="text-xl font-bold text-primary">HireFlow</span>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            {...(onClose ? { onClick: onClose } : {})}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="border-t p-4">
        <Link
          href="/settings"
          {...(onClose ? { onClick: onClose } : {})}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
