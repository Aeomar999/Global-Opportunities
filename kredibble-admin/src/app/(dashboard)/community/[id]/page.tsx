"use client";

/**
 * Community channel review: one channel and its posts.
 * Built on the shared detail template.
 *
 * Fields: channel name, owner, followers, status, and every post (author, date, text, Flagged marker).
 * Actions: Remove post (per post, confirm dialog), Remove channel (danger zone, confirm dialog) and
 * Restore channel (header, when removed).
 * Data: mock channels (src/lib/mock-channels.ts), changed in LOCAL state only.
 */
import { useCallback } from "react";
import { useParams } from "next/navigation";
import { Ban, Hash, RotateCcw, Trash2 } from "lucide-react";
import { useBreadcrumbLabel } from "@/lib/breadcrumb-label";
import { channels } from "@/lib/mock-channels";
import { useDetailData } from "@/lib/use-detail-data";
import { DangerZone } from "@/components/detail/DangerZone";
import { DetailHeader } from "@/components/detail/DetailHeader";
import { DetailPage } from "@/components/detail/DetailPage";
import { DetailError, DetailNotFound, DetailSkeleton } from "@/components/detail/DetailStates";
import { InfoCard } from "@/components/detail/InfoCard";
import { Button } from "@/components/ui/Button";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { IconButton } from "@/components/ui/IconButton";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { MiniStat } from "@/components/ui/MiniStat";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";

export default function ChannelReviewPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(() => Promise.resolve(channels.find((c) => c.id === id)), [id]);
  const { status, record: channel, setRecord, error, retry } = useDetailData(load, { collection: "channels" });
  const toast = useToast();
  const { confirm, dialog } = useConfirmDialog();

  useBreadcrumbLabel(status === "loading" ? undefined : channel ? channel.name : "Not found");

  if (status === "loading") return <DetailSkeleton />;
  if (status === "error") return <DetailError message={error ?? "Could not load this channel."} onRetry={retry} />;
  if (!channel) return <DetailNotFound noun="Channel" listLabel="Community Channels" listHref="/community" />;

  const isRemoved = channel.status === "removed";

  const removePost = (postId: string) => {
    const post = channel.posts.find((p) => p.id === postId);
    if (!post) return;
    confirm({
      title: "Remove this post?",
      description: (
        <>
          The post by <strong className="text-ink">{post.authorName}</strong> ({post.date}) will be removed from{" "}
          <strong className="text-ink">{channel.name}</strong>.
        </>
      ),
      confirmLabel: "Remove post",
      onConfirm: () => {
        // TODO(backend): persist this change
        setRecord((prev) => ({ ...prev, posts: prev.posts.filter((p) => p.id !== postId) }));
        toast.success(`The post by ${post.authorName} was removed.`);
      },
    });
  };

  const removeChannel = () =>
    confirm({
      title: "Remove this channel?",
      description: (
        <>
          <strong className="text-ink">{channel.name}</strong> (owned by {channel.owner}, {channel.followers} followers) will be marked
          as Removed. You can restore it later.
        </>
      ),
      confirmLabel: "Remove channel",
      onConfirm: () => {
        // TODO(backend): persist this change
        setRecord((prev) => ({ ...prev, status: "removed" }));
        toast.success(`${channel.name} was removed.`);
      },
    });

  const restoreChannel = () => {
    // TODO(backend): persist this change
    setRecord((prev) => ({ ...prev, status: "active" }));
    toast.success(`${channel.name} was restored.`);
  };

  return (
    <>
      <DetailPage
        header={
          <DetailHeader
            leading={{ icon: Hash }}
            title={channel.name}
            badges={<StatusBadge status={channel.status} />}
            meta={`${channel.owner} · ${channel.followers} followers`}
            actions={
              isRemoved && (
                <Button variant="secondary" icon={RotateCcw} onClick={restoreChannel}>
                  Restore channel
                </Button>
              )
            }
          />
        }
        main={
          <InfoCard title="Posts">
            {channel.posts.length === 0 ? (
              <p className="body-sm text-muted">No posts in this channel.</p>
            ) : (
              <ul className="space-y-3">
                {channel.posts.map((post) => (
                  <li
                    key={post.id}
                    className={`rounded-control border p-4 ${post.flagged ? "border-danger" : "border-line"}`}
                  >
                    <div className="mb-2 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="body-sm font-semibold text-ink">{post.authorName}</p>
                        <p className="caption">{post.date}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {post.flagged && <StatusBadge status="flagged" />}
                        <IconButton label={`Remove post by ${post.authorName}`} icon={Trash2} tone="danger" onClick={() => removePost(post.id)} />
                      </div>
                    </div>
                    <p className="input-text text-ink">{post.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </InfoCard>
        }
        side={
          <>
            <InfoCard title="Details">
              <KeyValueList
                items={[
                  { label: "Owner", value: channel.owner },
                  { label: "Followers", value: channel.followers },
                ]}
              />
            </InfoCard>
            <InfoCard title="Activity">
              <MiniStat value={channel.posts.length} label="Posts" />
            </InfoCard>
          </>
        }
        danger={
          !isRemoved && (
            <DangerZone explanation="Marks this channel as Removed. You can restore it at any time.">
              <Button variant="danger" icon={Ban} onClick={removeChannel}>
                Remove channel
              </Button>
            </DangerZone>
          )
        }
      />
      {dialog}
    </>
  );
}
