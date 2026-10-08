"use client";

/**
 * AmbassadorDetail: one ambassador (/network/[id]). Built on the shared detail template, with the purple Network accent.
 *
 * - Header: photo (or initials), name, tier, status badge, campus and place; Edit (edit access on network; for a view-only
 *   role it is disabled with the standard tooltip) and "Log amplification" (the same edit access).
 * - Main: Impact this month (shares logged, referred clicks and verified signups, three MiniStats) and the Amplification
 *   log (newest first: channel, date, clicks, and the note, which is cut at two lines with the full text in a tooltip).
 * - Side: Details (type, role, campus, place, phone, email, joined, trained, lead, linked account, description) and the
 *   Referral code card (read-only, with Copy).
 * "Log amplification" opens a small form (LogAmplificationDialog): Channel and an optional note. Saving adds an entry to the
 * log dated today, adds one to this month's shares (here and on the leaderboard) and shows a toast.
 * Data: services/network.ts (live store). Each action carries a TODO(backend).
 *
 * Props: id (the ambassador id)
 */
import Link from "next/link";
import { useCallback, useState } from "react";
import { Check, Minus, Pencil, Share2 } from "lucide-react";
import { useRoles, VIEW_ONLY_TOOLTIP } from "@/components/access/RoleProvider";
import { DetailHeader } from "@/components/detail/DetailHeader";
import { DetailPage } from "@/components/detail/DetailPage";
import { DetailError, DetailNotFound, DetailSkeleton } from "@/components/detail/DetailStates";
import { InfoCard } from "@/components/detail/InfoCard";
import { LogAmplificationDialog } from "@/components/network/LogAmplificationDialog";
import { PLATFORM_LABELS } from "@/components/network/network-meta";
import { ReferralCodeCard } from "@/components/network/ReferralCodeCard";
import { Button, buttonClasses } from "@/components/ui/Button";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { MiniStat } from "@/components/ui/MiniStat";
import { NotConnectedNotice } from "@/components/ui/NotConnectedNotice";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TagPill } from "@/components/ui/TagPill";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { TruncatedText } from "@/components/ui/TruncatedText";
import { useBreadcrumbLabel } from "@/lib/breadcrumb-label";
import { formatDate } from "@/lib/format";
import { AMBASSADOR_TIER_LABELS, MEMBER_TYPE_LABELS, type SocialPlatform } from "@/lib/mock-entities";
import { loadAmbassador, logAmplification, subscribeNetwork } from "@/lib/services/network";
import { useDetailData } from "@/lib/use-detail-data";

/** How many log entries the card lists; the rest is counted in the line under it. */
const LOG_LIMIT = 20;

export function AmbassadorDetail({ id }: { id: string }) {
  const { can } = useRoles();
  const canEdit = can("network", "edit");
  const load = useCallback(() => loadAmbassador(id), [id]);
  const { status, record, error, retry } = useDetailData(load, { subscribe: subscribeNetwork });
  const toast = useToast();
  const [logging, setLogging] = useState(false);

  useBreadcrumbLabel(status === "loading" ? undefined : record ? record.ambassador.name : "Not found");

  if (status === "loading") return <DetailSkeleton />;
  if (status === "error") return <DetailError message={error ?? "Could not load this ambassador."} onRetry={retry} />;
  if (!record) return <DetailNotFound noun="Ambassador" listLabel="Network" listHref="/network" />;

  const { ambassador, leadName, linkedSeekerName, logs, stats } = record;

  const save = (channel: SocialPlatform, note: string) => {
    // TODO(backend): persist this change
    logAmplification(ambassador.id, channel, note);
    setLogging(false);
    toast.success(`A share on ${PLATFORM_LABELS[channel]} was logged for ${ambassador.name}.`);
  };

  const actions = canEdit ? (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`/network/${ambassador.id}/edit`} className={buttonClasses("secondary")}>
        <Pencil size={16} strokeWidth={1.75} aria-hidden="true" />
        Edit
      </Link>
      <Button icon={Share2} onClick={() => setLogging(true)}>
        Log amplification
      </Button>
    </div>
  ) : (
    <div className="flex flex-wrap items-center gap-2">
      <Tooltip label={VIEW_ONLY_TOOLTIP}>
        <Button variant="secondary" icon={Pencil} disabled>
          Edit
        </Button>
      </Tooltip>
      <Tooltip label={VIEW_ONLY_TOOLTIP}>
        <Button icon={Share2} disabled>
          Log amplification
        </Button>
      </Tooltip>
    </div>
  );

  return (
    <>
      <NotConnectedNotice className="mb-4" />
      <DetailPage
        header={
          <DetailHeader
            leading={{ name: ambassador.name, imageSrc: ambassador.photoUrl }}
            eyebrow={<TagPill>{AMBASSADOR_TIER_LABELS[ambassador.tier]}</TagPill>}
            title={ambassador.name}
            badges={<StatusBadge status={ambassador.status} />}
            meta={`${ambassador.campus} · ${ambassador.city}, ${ambassador.country}`}
            actions={actions}
          />
        }
        main={
          <>
            <InfoCard title="Impact this month" subtitle="What their referral code brought in, month to date.">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div data-testid="impact-shares">
                  <MiniStat value={stats.shares} label="Shares logged" />
                </div>
                <div data-testid="impact-clicks">
                  <MiniStat value={stats.clicks} label="Referred clicks" />
                </div>
                <div data-testid="impact-signups">
                  <MiniStat value={stats.signups} label="Verified signups" />
                </div>
              </div>
            </InfoCard>

            <InfoCard title="Amplification log" subtitle="Every time they shared a listing, newest first.">
              {logs.length === 0 ? (
                <p data-testid="log-empty" className="input-text text-muted">No shares have been logged for this ambassador yet.</p>
              ) : (
                <>
                  <ul data-testid="amplification-log" className="divide-y divide-line">
                    {logs.slice(0, LOG_LIMIT).map((log) => (
                      <li key={log.id} data-testid="log-entry" className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink">{PLATFORM_LABELS[log.channel]}</p>
                          {log.note ? <TruncatedText text={log.note} lines={2} className="caption" /> : <p className="caption">{log.listingId ? "A published listing" : "No note"}</p>}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="caption tabular-nums">{formatDate(log.at)}</p>
                          <p className="caption tabular-nums">{log.clicks} {log.clicks === 1 ? "click" : "clicks"}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {logs.length > LOG_LIMIT && <p className="caption mt-3">Showing the latest {LOG_LIMIT} of {logs.length} shares.</p>}
                </>
              )}
            </InfoCard>
          </>
        }
        side={
          <>
            <InfoCard title="Details">
              <KeyValueList
                items={[
                  { label: "Member type", value: MEMBER_TYPE_LABELS[ambassador.memberType] },
                  { label: "Role", value: ambassador.roleTitle },
                  { label: "Campus", value: ambassador.campus },
                  { label: "Place", value: `${ambassador.city}, ${ambassador.country}` },
                  { label: "Email", value: ambassador.email },
                  { label: "Phone", value: ambassador.phone },
                  { label: "Joined", value: formatDate(ambassador.joinedAt) },
                  {
                    label: "Trained",
                    value: (
                      <span data-testid="trained-value" className="inline-flex items-center gap-1.5">
                        {ambassador.trained ? <Check size={14} strokeWidth={2} aria-hidden="true" className="text-success" /> : <Minus size={14} strokeWidth={2} aria-hidden="true" className="text-muted" />}
                        {ambassador.trained ? "Yes" : "No"}
                      </span>
                    ),
                  },
                  { label: "Assigned lead", value: leadName },
                  { label: "Linked account", value: linkedSeekerName },
                  { label: "About", value: ambassador.description },
                ]}
              />
            </InfoCard>
            <ReferralCodeCard code={ambassador.referralCode} />
          </>
        }
      />
      <LogAmplificationDialog open={logging} ambassadorName={ambassador.name} onSave={save} onCancel={() => setLogging(false)} />
    </>
  );
}
