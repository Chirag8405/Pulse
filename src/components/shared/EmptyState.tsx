"use client";

import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <section className="flex min-h-[320px] items-center justify-center" role="status" aria-live="polite">
      <div className="w-full max-w-xl border-2 border-dashed border-border bg-card p-12 text-center">
        <Icon className="mx-auto size-12 text-muted-foreground" aria-hidden="true" />
        <h3 className="mt-4 text-lg font-bold">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>

        {action ? (
          <Button
            type="button"
            onClick={action.onClick}
            className="nb-btn mt-6 rounded-none border-2 border-border bg-primary px-6 font-bold text-primary-foreground"
          >
            {action.label}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
