"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  CalendarClock,
  Flag,
  LayoutDashboard,
  Menu,
  Settings,
  Users,
} from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const ADMIN_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/events", label: "Active Event", icon: CalendarClock },
  { href: "/admin/challenges", label: "Challenges", icon: Flag },
  { href: "/admin/teams", label: "Teams", icon: Users },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface SidebarNavProps {
  pathname: string;
  navigationLabel: string;
  onNavigate?: () => void;
}

function SidebarNav({ pathname, navigationLabel, onNavigate }: SidebarNavProps) {
  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b-2 border-border px-4 py-4">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          VENUE OPS
        </p>
      </div>

      <nav className="p-3" role="navigation" aria-label={navigationLabel}>
        <ul className="space-y-1.5">
          {ADMIN_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2 border-2 px-3 py-2 text-sm font-bold",
                    active
                      ? "border-foreground bg-foreground text-background dark:border-background dark:bg-background dark:text-foreground"
                      : "border-transparent text-foreground hover:bg-muted"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const { user, isAdmin } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const wasMobileOpenRef = useRef(false);

  const currentLabel = useMemo(() => {
    const activeItem = ADMIN_ITEMS.find((item) => isActive(pathname, item.href));
    return activeItem?.label ?? "Dashboard";
  }, [pathname]);

  const userLabel = user?.email ?? "No signed-in email";

  useEffect(() => {
    if (wasMobileOpenRef.current && !mobileOpen) {
      menuButtonRef.current?.focus();
    }

    wasMobileOpenRef.current = mobileOpen;
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r-2 border-border md:block">
        <SidebarNav pathname={pathname} navigationLabel="Admin sidebar navigation" />
      </aside>

      <div className="md:pl-60">
        <header className="h-14 border-b-2 border-border bg-background px-3 md:px-6">
          <div className="flex h-full items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setMobileOpen(true)}
                ref={menuButtonRef}
                className="nb-btn rounded-none border-2 border-border bg-card md:hidden"
                aria-label="Open admin menu"
              >
                <Menu className="size-4" />
              </Button>
              <p className="text-sm font-bold">
                Venue Operations / <span className="text-muted-foreground">{currentLabel}</span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center border-2 border-border px-2 py-1 font-mono text-xs font-bold uppercase tracking-wide",
                  isAdmin
                    ? "bg-amber-400 text-black"
                    : "bg-muted text-foreground"
                )}
              >
                {isAdmin ? "ADMIN" : "ATTENDEE"}
              </span>
              <span className="hidden border-2 border-border bg-card px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-muted-foreground lg:inline-flex">
                {isAdmin ? "admin" : "attendee"}: {userLabel}
              </span>
              <ThemeToggle />
              <Avatar className="after:border-2">
                <AvatarFallback className="font-mono text-xs font-bold text-foreground">
                  VO
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        <main className="p-4 md:p-6" role="main">
          {children}
        </main>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-60 max-w-none border-r-2 border-border p-0"
        >
          <SidebarNav
            pathname={pathname}
            navigationLabel="Admin mobile navigation"
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
