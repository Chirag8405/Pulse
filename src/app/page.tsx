import Link from "next/link";
import { APP_NAME } from "@/constants";

export default function HomePage() {
  return (
    <main className="bg-background text-foreground">
      <section
        className="flex min-h-screen items-center justify-center px-4 py-14"
        style={{
          backgroundImage:
            "radial-gradient(circle, #d1d5db 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
        <div className="w-full max-w-5xl text-center">
          <h1 className="mx-auto max-w-2xl text-5xl font-black tracking-tighter md:text-6xl">
            The crowd is not a problem to manage.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-xl text-muted-foreground">
            PULSE makes 40,000 people want to move themselves.
          </p>

          <div className="mx-auto mb-8 mt-8 h-0.5 w-full max-w-2xl bg-black dark:bg-white" />

          <div className="flex items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="nb-btn inline-flex items-center justify-center border-2 border-border bg-primary px-6 py-3 font-bold text-primary-foreground"
            >
              Attend an Event
            </Link>
            <Link
              href="/admin"
              className="nb-btn inline-flex items-center justify-center border-2 border-border bg-white px-6 py-3 font-bold text-black"
            >
              Venue Operations
            </Link>
          </div>

          <p className="mt-5 font-mono text-sm text-muted-foreground">
            Wankhede Stadium • Mumbai • Demo
          </p>
        </div>
      </section>

      <section className="border-y-2 border-black bg-white py-14 text-black">
        <div className="mx-auto w-full max-w-6xl px-4">
          <h2 className="text-3xl font-black">Every event has the same problem.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <article className="nb-card border-black bg-white p-6">
              <p className="text-4xl font-black">8 minutes</p>
              <p className="mt-3 text-sm">average wait at halftime food stalls</p>
            </article>
            <article className="nb-card border-black bg-white p-6">
              <p className="text-4xl font-black">73% of exits</p>
              <p className="mt-3 text-sm">
                used in the first 5 minutes after final whistle
              </p>
            </article>
            <article className="nb-card border-black bg-white p-6">
              <p className="text-4xl font-black">3 zones</p>
              <p className="mt-3 text-sm">
                absorb 80% of all foot traffic at any given time
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="py-14">
        <div className="mx-auto w-full max-w-6xl px-4">
          <h2 className="text-3xl font-black">How PULSE works.</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <article className="nb-card bg-card p-5">
              <p className="font-mono text-6xl font-black text-muted-foreground">01</p>
              <p className="mt-3 text-sm font-bold">Entry Scan {"->"} Team Assignment</p>
            </article>
            <article className="nb-card bg-card p-5">
              <p className="font-mono text-6xl font-black text-muted-foreground">02</p>
              <p className="mt-3 text-sm font-bold">Challenge Issued {"->"} Spread Target Set</p>
            </article>
            <article className="nb-card bg-card p-5">
              <p className="font-mono text-6xl font-black text-muted-foreground">03</p>
              <p className="mt-3 text-sm font-bold">
                Attendees Coordinate {"->"} Spread Score Climbs
              </p>
            </article>
            <article className="nb-card bg-card p-5">
              <p className="font-mono text-6xl font-black text-muted-foreground">04</p>
              <p className="mt-3 text-sm font-bold">Team Wins {"->"} Reward Unlocked</p>
            </article>
          </div>
        </div>
      </section>

      <section className="py-14">
        <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 md:grid-cols-2">
          <article className="nb-card bg-card">
            <header className="border-b-2 border-border bg-amber-400 px-4 py-3 text-black">
              <h3 className="text-xl font-black">For Fans</h3>
            </header>
            <div className="space-y-2 px-4 py-4 text-sm">
              <p>Receive real-time challenge prompts and move with purpose.</p>
              <p>Compete with your team and unlock rewards together.</p>
            </div>
          </article>

          <article className="nb-card bg-card">
            <header className="border-b-2 border-border bg-primary px-4 py-3 text-primary-foreground">
              <h3 className="text-xl font-black">For Venue Ops</h3>
            </header>
            <div className="space-y-2 px-4 py-4 text-sm">
              <p>Direct crowd flow with challenge mechanics instead of force.</p>
              <p>See zone pressure and response in real-time during live play.</p>
            </div>
          </article>
        </div>
      </section>

      <footer className="border-t-2 border-border py-6">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4">
          <p className="font-mono text-lg font-black">{APP_NAME}</p>
          <p className="text-sm text-muted-foreground">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="font-bold text-foreground underline"
            >
              GitHub
            </a>{" "}
            • MIT License
          </p>
        </div>
      </footer>
    </main>
  );
}
