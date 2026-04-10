"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, House, Trophy, User, Zap } from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface AttendeeLayoutProps {
  children: React.ReactNode;
}

const MOBILE_TABS = [
  { href: "/dashboard", label: "Home", icon: House },
  { href: "/challenges", label: "Challenges", icon: Zap },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/profile", label: "Profile", icon: User },
] as const;

function isTabActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AttendeeLayout({ children }: AttendeeLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b-2 border-border bg-background">
        <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between px-3 md:px-6">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5">
            <Zap className="size-5 text-primary" aria-hidden="true" />
            <span className="font-mono text-xl font-black tracking-tight text-primary">
              PULSE
            </span>
          </Link>

          <div className="hidden items-center gap-2 md:flex">
            <p className="text-sm font-bold">Mumbai vs Chennai</p>
            <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              <span
                className="size-2 rounded-full bg-red-600"
                aria-label="Live event"
              />
              Live
            </span>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              aria-label="Notifications"
              className="nb-btn inline-flex size-8 items-center justify-center border-2 border-border bg-card"
            >
              <Bell className="size-4" />
            </button>
            <Avatar className="after:border-2">
              <AvatarFallback className="font-mono text-xs font-bold text-foreground">
                AB
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <div className="pb-16 md:pb-0">{children}</div>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-border bg-background md:hidden">
        <ul className="grid grid-cols-4">
          {MOBILE_TABS.map((tab, index) => {
            const active = isTabActive(pathname, tab.href);
            const Icon = tab.icon;

            return (
              <li
                key={tab.href}
                className={cn(index < MOBILE_TABS.length - 1 && "border-r-2 border-border")}
              >
                <Link
                  href={tab.href}
                  className={cn(
                    "flex h-14 flex-col items-center justify-center gap-0.5 border-t-2 text-[11px]",
                    active
                      ? "border-primary text-primary font-bold"
                      : "border-transparent text-muted-foreground"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  <span>{tab.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
