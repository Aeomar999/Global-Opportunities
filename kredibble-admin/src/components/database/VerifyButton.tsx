"use client";

/**
 * VerifyButton: the one-click "Verify" on a pending row of the records list. Its accessible name is always "Verify <name>".
 *
 *   from 1024px   a compact secondary button, 32px high, the check icon and the word "Verify", with a 40px hit area (a
 *                 transparent 4px margin around it) and the tooltip "Mark this record as verified"
 *   640 to 1023px icon only, a 40px square, the same tooltip
 *   below 640px   the icon and the word, 40px high (there is no hover on a phone, so the word is shown)
 * It sits above the row's stretched link (relative z-10), so a click verifies and never opens the record, and its hit area does
 * not overlap the row link's own box.
 *
 * Props: name (the person, for the accessible name), onVerify
 */
import { BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { useMediaQuery } from "@/lib/use-media-query";

export const VERIFY_TOOLTIP = "Mark this record as verified";

export function VerifyButton({ name, onVerify }: { name: string; onVerify: () => void }) {
  const phone = useMediaQuery("(max-width: 639px)");
  const wide = useMediaQuery("(min-width: 1024px)");
  const iconOnly = !phone && !wide;
  return (
    <Tooltip label={VERIFY_TOOLTIP} placement="top" disabled={phone}>
      <Button
        variant="secondary"
        icon={BadgeCheck}
        aria-label={`Verify ${name}`}
        data-testid="verify-button"
        onClick={onVerify}
        // The 40px target around the 32px button on wide screens is a pseudo-element, so the layout stays compact.
        className={
          wide
            ? "relative z-10 h-8! gap-1.5 px-3! before:absolute before:-inset-1 before:content-['']"
            : iconOnly
              ? "relative z-10 size-10 gap-0 px-0!"
              : "relative z-10"
        }
      >
        <span className={iconOnly ? "sr-only" : undefined}>Verify</span>
      </Button>
    </Tooltip>
  );
}
