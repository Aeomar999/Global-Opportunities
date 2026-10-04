/**
 * DeltaChip: small "change" pill, e.g. "+12%".
 *
 * Colour follows whether the change is GOOD, not which way the arrow points:
 * - moving in `goodDirection` -> success (green)
 * - moving the other way      -> warning (amber)
 * The arrow always shows the real direction, and the value text is always
 * shown, so colour is never the only signal. Screen readers also get
 * "improved" / "worsened".
 *
 * Props:
 * - label: the text, e.g. "-8%" or "+2"
 * - direction: real direction of the change ("up" | "down")
 * - goodDirection: which direction is an improvement for this metric
 * - children: optional extra text inside the chip (e.g. "vs previous 7 days")
 */
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";

interface DeltaChipProps {
  label: string;
  direction: "up" | "down";
  goodDirection: "up" | "down";
  children?: ReactNode;
}

export function DeltaChip({ label, direction, goodDirection, children }: DeltaChipProps) {
  const isGood = direction === goodDirection;
  const Arrow = direction === "up" ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill px-2 py-1 badge-text",
        isGood ? "bg-success-soft text-success" : "bg-warning-soft text-warning",
      )}
    >
      <Arrow size={14} aria-hidden="true" />
      {label}
      {children && <span> {children}</span>}
      <span className="sr-only">{isGood ? " (improved)" : " (worsened)"}</span>
    </span>
  );
}
