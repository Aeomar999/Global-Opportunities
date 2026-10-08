"use client";

/**
 * ReferralCodeCard: an ambassador's referral code, READ-ONLY. It is generated when the ambassador is added and never
 * changes, so there is no input anywhere: the code is shown as plain text in a locked-looking field (a lock icon, a
 * muted fill, monospace) with a Copy button (icon-only from 640px with a tooltip, with the word "Copy" on phones).
 *
 * Props:
 * - code: the code ("GOD-7K2M4Q"), or undefined on the New ambassador form, where it does not exist yet: the card then
 *   says it will be generated when the ambassador is added
 * Test ids: referral-code (the text), referral-code-card.
 */
import { useState } from "react";
import { Check, Copy, Lock } from "lucide-react";
import { InfoCard } from "@/components/detail/InfoCard";
import { IconTextButton } from "@/components/ui/IconTextButton";
import { useToast } from "@/components/ui/Toast";

export function ReferralCodeCard({ code }: { code?: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(`Referral code ${code} was copied.`);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("The code could not be copied. Select it and copy it by hand.");
    }
  };

  return (
    <div data-testid="referral-code-card">
      <InfoCard title="Referral code" subtitle={code ? "Credits clicks and signups to this ambassador." : "Made for you when the ambassador is added."}>
        <div className="flex items-center gap-2">
          <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-control border border-line bg-surface-2 px-3 text-ink">
            <Lock size={16} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-muted" />
            {code ? (
              <span data-testid="referral-code" className="truncate font-mono text-sm font-semibold tracking-wide select-all">
                {code}
              </span>
            ) : (
              <span className="text-sm text-muted">Generated when you add them</span>
            )}
          </div>
          {code && <IconTextButton icon={copied ? Check : Copy} label="Copy" tooltip="Copy the referral code" onClick={copy} />}
        </div>
        <p className="caption mt-2">{code ? "Locked: it is generated once and cannot be changed." : "It looks like GOD-7K2M4Q and is unique. It cannot be typed in or changed afterwards."}</p>
      </InfoCard>
    </div>
  );
}
