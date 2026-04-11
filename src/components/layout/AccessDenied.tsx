import Link from "next/link";
import { ShieldOff } from "lucide-react";

export function AccessDenied() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="nb-card w-full max-w-md bg-card p-8 text-center">
        <ShieldOff className="mx-auto mb-4 size-14 text-muted-foreground" />
        <h1 className="text-3xl font-black tracking-tight">Access Denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This page is for venue staff only. Audience accounts should use the attendee dashboard.
        </p>
        <div className="mt-6 space-y-2">
          <Link
            href="/dashboard"
            className="nb-btn inline-flex w-full items-center justify-center border-2 border-border bg-primary px-4 py-2 font-bold text-primary-foreground"
          >
            Go to Attendee Dashboard
          </Link>
          <Link
            href="/login?redirect=%2Fdashboard"
            className="nb-btn inline-flex w-full items-center justify-center border-2 border-border bg-muted px-4 py-2 font-bold text-foreground"
          >
            Sign In as Audience
          </Link>
        </div>
      </section>
    </main>
  );
}
