"use client";

/**
 * RealChannelPage: one live channel, for the admin. Built on the shared detail template.
 *
 * Tabs: Group chat (history + composer, see ChannelChat) and Members (see ChannelMembers).
 * Data: GET /admin/community/channels/:id (real API). Moderation of feed posts stays on the Reports Queue.
 */
import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { Hash, Lock } from "lucide-react";
import { getCommunityChannelById, type ChannelRecord } from "@/lib/api";
import { useBreadcrumbLabel } from "@/lib/breadcrumb-label";
import { useDetailData } from "@/lib/use-detail-data";
import { ChannelChat } from "@/components/community/ChannelChat";
import { ChannelMembers } from "@/components/community/ChannelMembers";
import { DetailHeader } from "@/components/detail/DetailHeader";
import { DetailError, DetailNotFound, DetailSkeleton } from "@/components/detail/DetailStates";
import { InfoCard } from "@/components/detail/InfoCard";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tabs, tabId, tabPanelId } from "@/components/ui/Tabs";

type TabValue = "chat" | "members";
const ID_PREFIX = "channel";

export function RealChannelPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(() => getCommunityChannelById(id).catch((err: { status?: number }) => (err?.status === 404 ? undefined : Promise.reject(err))), [id]);
  const { status, record: channel, error, retry } = useDetailData<ChannelRecord>(load);
  const [tab, setTab] = useState<TabValue>("chat");

  useBreadcrumbLabel(status === "loading" ? undefined : channel ? channel.name : "Not found");

  if (status === "loading") return <DetailSkeleton />;
  if (status === "error") return <DetailError message={error ?? "Could not load this channel."} onRetry={retry} />;
  if (!channel) return <DetailNotFound noun="Channel" listLabel="Community Channels" listHref="/community" />;

  const isPrivate = channel.visibility === "private";

  return (
    <div className="space-y-4">
      <DetailHeader
        leading={{ icon: isPrivate ? Lock : Hash }}
        title={channel.name}
        badges={<StatusBadge status={channel.status} />}
        meta={`${isPrivate ? "Private, invite only" : "Public"} · ${channel.category}`}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <InfoCard title="Channel">
            <Tabs
              ariaLabel="Channel sections"
              idPrefix={ID_PREFIX}
              value={tab}
              onChange={setTab}
              tabs={[
                { value: "chat", label: "Group chat" },
                { value: "members", label: "Members" },
              ]}
            />
            <div role="tabpanel" id={tabPanelId(ID_PREFIX, tab)} aria-labelledby={tabId(ID_PREFIX, tab)} className="pt-4">
              {tab === "chat" ? <ChannelChat channelId={channel.id} /> : <ChannelMembers channelId={channel.id} creatorId={channel.createdBy} />}
            </div>
          </InfoCard>
        </div>
        <div className="order-first lg:order-none lg:col-span-1">
          <InfoCard title="Details">
            <KeyValueList
              items={[
                { label: "Visibility", value: isPrivate ? "Private (invite only)" : "Public" },
                { label: "Category", value: channel.category },
                { label: "Description", value: channel.bio },
                { label: "Created", value: new Date(channel.createdAt).toLocaleDateString() },
              ]}
            />
          </InfoCard>
        </div>
      </div>
    </div>
  );
}
