/**
 * Skeleton: pulsing placeholder block. Size it to the exact shape of the
 * content it stands in for (via className) so nothing shifts when data loads.
 * Decorative: hidden from assistive tech; the parent announces loading.
 *
 * Props:
 * - className: size and radius of the block
 * - onDark: translucent white instead of the light track colour, for dark surfaces
 */
import { cn } from "@/lib/cn";

export function Skeleton({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-inset", onDark ? "bg-white/10" : "bg-track", className)}
    />
  );
}
