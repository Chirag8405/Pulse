import { AuthGuard } from "@/components/layout/AuthGuard";

export default function DashboardPage() {
  return (
    <AuthGuard>
      <section className="nb-card mx-auto max-w-4xl bg-card p-6">
        <h1 className="text-3xl font-black tracking-tight">Dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Live crowd operations view for attendees.
        </p>
      </section>
    </AuthGuard>
  );
}
