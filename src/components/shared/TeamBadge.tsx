import { cn } from "@/lib/utils";

interface TeamBadgeProps {
  teamName: string;
  emoji: string;
  colorHex: string;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASSES: Record<NonNullable<TeamBadgeProps["size"]>, string> = {
  sm: "text-xs px-2 py-1",
  md: "text-sm px-3 py-1.5",
  lg: "text-base px-4 py-2",
};

function hexToRgba(hexColor: string, alpha: number): string {
  const sanitized = hexColor.replace("#", "").trim();

  if (sanitized.length !== 6) {
    return `rgba(0, 0, 0, ${alpha})`;
  }

  const r = Number.parseInt(sanitized.slice(0, 2), 16);
  const g = Number.parseInt(sanitized.slice(2, 4), 16);
  const b = Number.parseInt(sanitized.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function TeamBadge({
  teamName,
  emoji,
  colorHex,
  size = "md",
}: TeamBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 border-2 border-black font-bold",
        SIZE_CLASSES[size]
      )}
      style={{ backgroundColor: hexToRgba(colorHex, 0.2) }}
    >
      <span
        className="inline-flex size-4 border-2 border-black"
        style={{ backgroundColor: colorHex }}
        aria-hidden="true"
      />
      <span aria-hidden="true">{emoji}</span>
      <span>{teamName}</span>
      <span className="sr-only">{teamName} team, {emoji}</span>
    </span>
  );
}
