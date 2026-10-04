"use client";

/**
 * IconButton: a 40px icon-only action button (approve / reject / remove on a row).
 * It always has an accessible name (aria-label) and a Tooltip on hover and focus.
 *
 * Props:
 * - label: the action name including what it acts on ("Approve Business Registration"); the aria-label
 * - tooltip: optional shorter tooltip text ("Approve document"); defaults to the label
 * - icon: lucide icon
 * - tone: success (approve) | danger (reject, remove) | neutral
 * - onClick, disabled: disabled uses aria-disabled (muted, still focusable so the tooltip can be read) and ignores clicks
 * Never orange: success is green, danger is red.
 */
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Tooltip } from "./Tooltip";

const TONES = {
  success: "bg-success-soft text-success hover:bg-success hover:text-white",
  danger: "bg-danger-soft text-danger hover:bg-danger hover:text-white",
  neutral: "bg-neutral-soft text-neutral hover:bg-neutral hover:text-white",
} as const;

interface IconButtonProps {
  label: string;
  tooltip?: string;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  onClick?: () => void;
  disabled?: boolean;
}

export function IconButton({ label, tooltip, icon: Icon, tone = "neutral", onClick, disabled }: IconButtonProps) {
  return (
    <Tooltip label={tooltip ?? label}>
      <button
        type="button"
        aria-label={label}
        aria-disabled={disabled || undefined}
        onClick={disabled ? undefined : onClick}
        className={cn(
          "inline-flex size-10 items-center justify-center rounded-control transition-colors duration-150 ease-out",
          disabled ? "cursor-not-allowed bg-neutral-soft text-muted" : TONES[tone],
        )}
      >
        <Icon size={16} strokeWidth={2} aria-hidden="true" />
      </button>
    </Tooltip>
  );
}
