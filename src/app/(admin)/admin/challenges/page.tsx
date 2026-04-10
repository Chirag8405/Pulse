import { AuthGuard } from "@/components/layout/AuthGuard";

export default function AdminChallengesPage() {
  return (
    <AuthGuard requireAdmin>
      <section className="nb-card mx-auto max-w-5xl bg-card p-6">
        <h1 className="text-3xl font-black tracking-tight">Challenges</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Challenge orchestration and controls appear here.
        </p>
      </section>
    </AuthGuard>
  );
}
