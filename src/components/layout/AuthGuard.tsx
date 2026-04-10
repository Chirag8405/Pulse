"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { useAuth } from "@/hooks/useAuth";

interface AuthGuardProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export function AuthGuard({
  children,
  requireAdmin = false,
}: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { loading, isAuthenticated, isAdmin } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      const redirectTarget = pathname || "/dashboard";
      router.replace(`/login?redirect=${encodeURIComponent(redirectTarget)}`);
    }
  }, [isAuthenticated, loading, pathname, router]);

  if (loading) {
    return <LoadingSkeleton variant="dashboard" />;
  }

  if (!isAuthenticated) {
    return null;
  }

  if (requireAdmin && !isAdmin) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}
