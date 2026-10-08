"use client";

/**
 * PartnerCard: the content of one card on the Partners board (the board adds the grip and the "Move to…" menu).
 *
 *   Acme Foundation              (AO)    <- the organisation (a link to its page, at most two lines), 24px owner avatar
 *   [Foundation]                         <- partner type pill
 *   Ghana · Efua Darko                   <- country and contact, one line
 *   Scholarship funding and grants       <- what they provide, at most two lines
 * Whatever is cut off (a long name, the contact line, the provide text) shows in full in the shared tooltip on hover and
 * keyboard focus, and in a title attribute. The avatar has the owner's full name as its tooltip and its aria-label.
 *
 * Props: partner (a PartnerRow from services/partners.ts)
 */
import { Avatar } from "@/components/ui/Avatar";
import { TagPill } from "@/components/ui/TagPill";
import { Tooltip } from "@/components/ui/Tooltip";
import { TruncatedLink, TruncatedText } from "@/components/ui/TruncatedText";
import { PARTNER_TYPE_LABELS } from "@/lib/mock-entities";
import type { PartnerRow } from "@/lib/services/partners";

export function PartnerCard({ partner }: { partner: PartnerRow }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <TruncatedLink href={`/partners/${partner.id}`} text={partner.name} lines={2} className="font-semibold leading-5 text-ink hover:underline" />
        </div>
        {partner.ownerName && (
          <Tooltip label={`Owner: ${partner.ownerName}`} placement="top">
            <span role="img" aria-label={`Owner: ${partner.ownerName}`} data-testid="partner-owner" className="shrink-0">
              <Avatar name={partner.ownerName} size="xs" />
            </span>
          </Tooltip>
        )}
      </div>
      <TagPill>{PARTNER_TYPE_LABELS[partner.type]}</TagPill>
      <TruncatedText text={`${partner.country} · ${partner.contactName}`} className="caption" />
      <TruncatedText text={partner.provides} lines={2} className="caption text-ink" />
    </div>
  );
}
