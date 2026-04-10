import Link from "next/link";
import { APP_NAME, APP_TAGLINE, VENUE_NAME } from "@/constants";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 p-8 nb-card bg-card max-w-lg mx-auto">
        <div className="space-y-2">
          <p className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
            {VENUE_NAME} · Sports &amp; Entertainment
          </p>
          <h1 className="text-6xl font-black tracking-tight">{APP_NAME}</h1>
          <p className="text-lg text-muted-foreground">{APP_TAGLINE}</p>
        </div>
        <div className="flex flex-col gap-3">
          <Link
            href="/dashboard"
            className="nb-btn inline-flex items-center justify-center bg-primary text-primary-foreground font-bold px-6 py-3 border-2 border-border"
          >
            Attendee Dashboard →
          </Link>
          <Link
            href="/admin"
            className="nb-btn inline-flex items-center justify-center bg-secondary text-secondary-foreground font-bold px-6 py-3 border-2 border-border"
          >
            Admin Panel →
          </Link>
          <Link
            href="/login"
            className="nb-btn inline-flex items-center justify-center bg-card text-foreground font-bold px-6 py-3 border-2 border-border"
          >
            Sign In
          </Link>
        </div>
      </div>
    </main>
  );
}
