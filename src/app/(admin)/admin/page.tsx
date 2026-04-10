import { AuthGuard } from "@/components/layout/AuthGuard";

export default function AdminPage() {
  return (
    <AuthGuard requireAdmin>
      <main className="min-h-screen bg-background p-6">
        <section className="nb-card mx-auto max-w-5xl bg-card p-6">
          <h1 className="text-3xl font-black tracking-tight">Admin Control</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Venue staff operations dashboard.
          </p>
        </section>
      </main>
    </AuthGuard>
  );
}
