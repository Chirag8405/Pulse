import { AuthGuard } from "@/components/layout/AuthGuard";

export default function AdminTeamsPage() {
  return (
    <AuthGuard requireAdmin>
      <section className="nb-card mx-auto max-w-5xl bg-card p-6">
        <h1 className="text-3xl font-black tracking-tight">Teams</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Team management and assignment tools appear here.
        </p>
      </section>
    </AuthGuard>
  );
}
