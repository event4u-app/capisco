import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Capisco icon wrapper — Lucide, linear, ~1.6px stroke, monochrome (inherits
 * currentColor). Icons are bundled (no CDN). Pass the Lucide component, not a
 * string, so the bundle stays tree-shakeable.
 */
export function Icon({
  icon: LucideComponent,
  size = 16,
  className,
}: {
  icon: LucideIcon;
  size?: number;
  className?: string;
}) {
  return (
    <LucideComponent
      size={size}
      strokeWidth={1.6}
      className={cn("shrink-0", className)}
      aria-hidden
    />
  );
}
