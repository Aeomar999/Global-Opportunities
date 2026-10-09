"use client";

/**
 * Ambassador application review: one request, with the details the server copied from the person's own account.
 * Built on the shared detail template.
 *
 * Fields: name, email, phone, role (seeker or hirer), profession, organisation, location, joined date, verification,
 * the applicant's own words ("why do you want to be an ambassador").
 * Actions (pending only): Approve (optionally pick a channel to add them to, add a note) and Reject (a short reason is
 * required). Both ask for confirmation, then the server updates the registry and sends the person a notification.
 * Data: GET /admin/ambassador-requests/:id (real API).
 */
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Check, X } from "lucide-react";
import {
  approveAmbassadorRequest, getAmbassadorRequestById, getCommunityChannels, rejectAmbassadorRequest, revokeAmbassador,
  type AmbassadorRequestRecord, type ChannelRecord,
} from "@/lib/api";
import { useBreadcrumbLabel } from "@/lib/breadcrumb-label";
import { formatDate } from "@/lib/format";
import { useDetailData } from "@/lib/use-detail-data";
import { DetailHeader } from "@/components/detail/DetailHeader";
import { DetailPage } from "@/components/detail/DetailPage";
import { DetailError, DetailNotFound, DetailSkeleton } from "@/components/detail/DetailStates";
import { InfoCard } from "@/components/detail/InfoCard";
import { Button } from "@/components/ui/Button";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/form/Field";
import { Select } from "@/components/ui/form/Select";
import { Textarea } from "@/components/ui/form/Textarea";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TagPill } from "@/components/ui/TagPill";
import { useToast } from "@/components/ui/Toast";

const NO_CHANNEL = "none";

export default function AmbassadorApplicationPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(() => getAmbassadorRequestById(id).catch((err: { status?: number }) => (err?.status === 404 ? undefined : Promise.reject(err))), [id]);
  const { status, record, setRecord, error, retry } = useDetailData<AmbassadorRequestRecord>(load);
  const toast = useToast();
  const { confirm, dialog } = useConfirmDialog();

  const [channels, setChannels] = useState<ChannelRecord[]>([]);
  const [channelId, setChannelId] = useState<string>(NO_CHANNEL);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useBreadcrumbLabel(status === "loading" ? undefined : record ? record.name : "Not found");

  // Channels the person can be added to (the admin's own channels, newest first).
  useEffect(() => {
    getCommunityChannels({ limit: 100 })
      .then((page) => setChannels(page.data.filter((c) => c.status !== "removed")))
      .catch(() => setChannels([]));
  }, []);

  if (status === "loading") return <DetailSkeleton />;
  if (status === "error") return <DetailError message={error ?? "Could not load this application."} onRetry={retry} />;
  if (!record) return <DetailNotFound noun="Application" listLabel="Ambassador applications" listHref="/ambassador-applications" />;

  const pending = record.status === "pending";
  const channelName = channels.find((c) => c.id === channelId)?.name;

  const decide = async (action: () => Promise<AmbassadorRequestRecord>, success: string) => {
    setSaving(true);
    try {
      const updated = await action();
      setRecord((prev) => ({ ...prev, ...updated }));
      toast.success(success);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save this decision.");
    } finally {
      setSaving(false);
    }
  };

  const approve = () =>
    confirm({
      title: "Approve this ambassador?",
      description: (
        <>
          <strong className="text-ink">{record.name}</strong> becomes a Kredibble ambassador and gets a notification
          {channelName ? (
            <>
              {" "}and is added to <strong className="text-ink">{channelName}</strong>
            </>
          ) : null}
          .
        </>
      ),
      confirmLabel: "Approve",
      tone: "neutral",
      onConfirm: () =>
        decide(() => approveAmbassadorRequest(record.id, { channelId: channelId === NO_CHANNEL ? undefined : channelId, note: note.trim() || undefined }), `${record.name} is now an ambassador.`),
    });

  const revoke = () =>
    confirm({
      title: "Remove this ambassador?",
      description: (
        <>
          <strong className="text-ink">{record.name}</strong> is rejected again and loses their ambassador status. They are removed from the ambassador
          channel you added them to, and receive a polite notification.
        </>
      ),
      confirmLabel: "Remove ambassador",
      onConfirm: () =>
        decide(async () => {
          const updated = await revokeAmbassador(record.id, note.trim() || undefined);
          return updated;
        }, `${record.name} was removed as an ambassador.`),
    });

  const reject = () => {
    confirm({
      title: "Reject this application?",
      description: (
        <>
          <strong className="text-ink">{record.name}</strong> is told the request was not approved and can apply again after a week.
        </>
      ),
      confirmLabel: "Reject application",
      onConfirm: () => decide(() => rejectAmbassadorRequest(record.id, note.trim() || undefined), `${record.name}'s application was rejected.`),
    });
  };

  const place = [record.city, record.country].filter(Boolean).join(", ");
  const details = record.profile;

  return (
    <>
      <DetailPage
        header={
          <DetailHeader
            leading={{ name: record.name }}
            title={record.name}
            badges={<StatusBadge status={record.status} />}
            meta={`${record.email} · applied ${formatDate(record.createdAt)}`}
          />
        }
        main={
          <>
            <InfoCard title="Why they want to be an ambassador">
              {record.motivation ? (
                <p className="input-text whitespace-pre-wrap text-ink">{record.motivation}</p>
              ) : (
                <p className="body-sm text-muted">They did not add a message.</p>
              )}
            </InfoCard>

            {pending ? (
              <InfoCard title="Decision" subtitle="Approving or rejecting sends the applicant a standard notification automatically.">
                <div className="space-y-4">
                  <Field label="Add to a channel" optional helper="They are added as a member and can chat with you straight away.">
                    <Select
                      value={channelId}
                      onChange={setChannelId}
                      options={[
                        { value: NO_CHANNEL, label: "Do not add to a channel" },
                        ...channels.map((c) => ({ value: c.id, label: c.name, badge: c.visibility === "private" ? "Private" : undefined })),
                      ]}
                    />
                  </Field>
                  <Field label="Note for your team" optional helper="Kept for your team only. The applicant always receives a standard, polite message.">
                    <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} />
                  </Field>
                  <div className="flex flex-wrap gap-3">
                    <Button icon={Check} onClick={approve} loading={saving}>
                      Approve
                    </Button>
                    <Button variant="danger" icon={X} onClick={reject} disabled={saving}>
                      Reject
                    </Button>
                  </div>
                </div>
              </InfoCard>
            ) : (
              <InfoCard title="Decision">
                <div className="space-y-4">
                  <KeyValueList
                    items={[
                      { label: "Outcome", value: <StatusBadge status={record.status} /> },
                      { label: "Decided", value: record.reviewedAt ? formatDate(record.reviewedAt) : undefined },
                      { label: "Note", value: record.reviewNote },
                    ]}
                  />
                  {record.status === "approved" && (
                    <>
                      <Field label="Note for your team" optional helper="Kept for your team only.">
                        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} />
                      </Field>
                      <div>
                        <Button variant="danger" icon={X} onClick={revoke} loading={saving}>
                          Reject / remove ambassador
                        </Button>
                        <p className="caption mt-2">Rejects them again, removes them from the channel you added them to, and tells them politely.</p>
                      </div>
                    </>
                  )}
                </div>
              </InfoCard>
            )}
          </>
        }
        side={
          <>
          <InfoCard title="Applicant">
            <KeyValueList
              items={[
                { label: "Applying as", value: record.role === "hirer" ? "Hirer" : "Seeker" },
                { label: "Email", value: record.email },
                { label: "Phone", value: record.phone },
                { label: "Profession", value: record.profession },
                { label: "Organisation", value: record.organisation },
                { label: "Location", value: place },
                { label: "Joined Kredibble", value: record.user?.joinedAt ? formatDate(record.user.joinedAt) : undefined },
                { label: "Email verified", value: record.user ? (record.user.emailVerified ? "Yes" : "No") : undefined },
                { label: "Verified profile", value: record.role === "seeker" ? (record.verified ? "Yes" : "No") : undefined },
              ]}
            />
          </InfoCard>
          <InfoCard title="More details about the applicant" subtitle="From their profile in the app.">
            {!details ? (
              <p className="body-sm text-muted">This person has not filled in their profile yet.</p>
            ) : details.kind === "seeker" ? (
              <div className="space-y-4">
                <KeyValueList
                  items={[
                    { label: "University", value: details.university },
                    { label: "Experience level", value: details.experienceLevel },
                    { label: "Rating", value: details.rating ? details.rating.toFixed(1) : undefined },
                    { label: "Applications", value: String(details.applicationsCount) },
                  ]}
                />
                <TextBlock title="Bio" text={details.bio} />
                <TextBlock title="Professional summary" text={details.professionalSummary} />
                <TagBlock title="Technical skills" items={details.technicalSkills} />
                <TagBlock title="Soft skills" items={details.softSkills} />
                <TagBlock title="Tools" items={details.tools} />
                <TagBlock title="Certifications" items={details.certifications} />
              </div>
            ) : (
              <div className="space-y-4">
                <KeyValueList
                  items={[
                    { label: "Company", value: details.companyName },
                    { label: "Industry", value: details.industry },
                    { label: "Company size", value: details.companySize },
                    { label: "Location", value: details.location },
                    { label: "Website", value: details.website },
                    { label: "Company email", value: details.companyEmail },
                    { label: "Recruiter", value: details.recruiterName },
                    { label: "Recruiter role", value: details.recruiterRole },
                    { label: "Recruiter phone", value: details.recruiterPhone },
                    { label: "LinkedIn", value: details.recruiterLinkedin },
                    { label: "Company verified", value: details.verified ? "Yes" : "No" },
                    { label: "Postings", value: String(details.postingsCount) },
                  ]}
                />
                <TextBlock title="Tagline" text={details.tagline} />
                <TextBlock title="About the company" text={details.description} />
              </div>
            )}
          </InfoCard>
          </>
        }
      />
      {dialog}
    </>
  );
}

function TextBlock({ title, text }: { title: string; text?: string }) {
  if (!text) return null;
  return (
    <div>
      <p className="caption mb-1 font-semibold text-ink">{title}</p>
      <p className="body-sm whitespace-pre-wrap text-ink">{text}</p>
    </div>
  );
}

function TagBlock({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="caption mb-1 font-semibold text-ink">{title}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <TagPill key={item}>{item}</TagPill>
        ))}
      </div>
    </div>
  );
}
