import { AuthGuard } from "@/components/layout/AuthGuard";

export default function ProfilePage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-background p-6">
        <section className="nb-card mx-auto max-w-3xl bg-card p-6">
          <h1 className="text-3xl font-black tracking-tight">Profile</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Profile and preferences will be available here.
          </p>
        </section>
      </main>
    </AuthGuard>
  );
}
