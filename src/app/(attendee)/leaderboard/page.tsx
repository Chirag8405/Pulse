import { AuthGuard } from "@/components/layout/AuthGuard";

export default function LeaderboardPage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-background p-6">
        <section className="nb-card mx-auto max-w-4xl bg-card p-6">
          <h1 className="text-3xl font-black tracking-tight">Leaderboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Team spread standings will be shown here.
          </p>
        </section>
      </main>
    </AuthGuard>
  );
}
