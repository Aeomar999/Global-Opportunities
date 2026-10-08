"use client";

/**
 * IconTextButton: an action button that is ICON-ONLY on screens from 640px (a 40px square with a Tooltip) and shows its
 * icon AND its words below 640px, where there is no hover. Its accessible name is always the label, so a screen reader
 * hears the same thing at every width. The same pattern as the "Move to…" button on the Partners board.
 *
 * Props:
 * - icon: a lucide icon
 * - label: the words (phones) and the accessible name
 * - tooltip?: the tooltip text on larger screens (default: the label)
 * - ariaLabel?: the accessible name when it must say more than the label ("Verify Ama Boateng")
 * - className?: extra classes for the button (for example "relative z-10" to sit above a stretched row link)
 * - testId?: a data-testid for the button
 * - wordsFrom?: "lg" shows the words from 1024px too (a labelled button on desktop, icon-only with a Tooltip from 640 to 1023px,
 *   icon and words on phones). Default: icon-only from 640px.
 * - variant?: "secondary" (default), "primary" or "ghost" (see Button)
 * - expanded / controls?: for a button that opens and closes a region: aria-expanded and aria-controls
 * - onClick, disabled, type: as a normal button
 */
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { useMediaQuery } from "@/lib/use-media-query";

interface IconTextButtonProps {
  icon: LucideIcon;
  label: string;
  tooltip?: string;
  ariaLabel?: string;
  className?: string;
  testId?: string;
  wordsFrom?: "lg";
  variant?: ButtonVariant;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  expanded?: boolean;
  controls?: string;
}

export function IconTextButton({ icon, label, tooltip, ariaLabel, className, testId, wordsFrom, variant = "secondary", onClick, disabled, type = "button", expanded, controls }: IconTextButtonProps) {
  const phone = useMediaQuery("(max-width: 639px)");
  const wide = useMediaQuery("(min-width: 1024px)");
  // Words: always on a phone (no hover there), and from 1024px when wordsFrom is "lg". Otherwise icon-only with a tooltip.
  const words = phone || (wordsFrom === "lg" && wide);
  const tooltipOff = wordsFrom ? words : phone;
  return (
    <Tooltip label={tooltip ?? label} placement="top" disabled={tooltipOff}>
      <Button type={type} variant={variant} icon={icon} onClick={onClick} disabled={disabled} aria-label={ariaLabel} aria-expanded={expanded} aria-controls={controls} data-testid={testId} className={cn(wordsFrom ? !words && "size-10 gap-0 px-0" : "sm:size-10 sm:gap-0 sm:px-0", className)}>
        {/* The words are kept for screen readers only while the button is icon-only (from 640px by default). */}
        <span className={wordsFrom ? (words ? undefined : "sr-only") : "sm:sr-only"}>{label}</span>
      </Button>
    </Tooltip>
  );
}
