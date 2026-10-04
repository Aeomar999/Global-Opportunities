"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Ban, ChevronLeft, Flag, Loader2, RotateCcw, Trash2 } from "lucide-react";
import {
  deleteCommunityPost,
  getCommunityChannelById,
  getCommunityChannelPosts,
  updateCommunityChannel,
  type ChannelPost,
  type ChannelRecord,
} from "@/lib/api";

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "#F0FDF4", text: "#16A34A", label: "Active" },
  flagged: { bg: "#FFFBEB", text: "#B7791F", label: "Flagged" },
  removed: { bg: "#FEF2F2", text: "#ED4C5C", label: "Removed" },
};

const postDate = (post: ChannelPost) => post.date || new Date(post.createdAt).toLocaleDateString();

export default function ChannelReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [channel, setChannel] = useState<ChannelRecord | null>(null);
  const [posts, setPosts] = useState<ChannelPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchChannel = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [record, page] = await Promise.all([
        getCommunityChannelById(params.id),
        getCommunityChannelPosts(params.id, { limit: 100 }),
      ]);
      setChannel(record);
      setPosts(page.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load channel");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchChannel();
  }, [fetchChannel]);

  const removePost = async (postId: string) => {
    setSaving(true);
    setActionError(null);
    try {
      await deleteCommunityPost(postId);
      setPosts((prev) => prev.filter((post) => post.id !== postId));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to remove post");
    } finally {
      setSaving(false);
    }
  };

  const toggleChannelStatus = async () => {
    if (!channel) return;
    setSaving(true);
    setActionError(null);
    try {
      // A removed channel is hidden from users by the API (SEC-077).
      setChannel(await updateCommunityChannel(params.id, { status: channel.status === "removed" ? "active" : "removed" }));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update channel");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 size={24} className="animate-spin text-kb-primary" />
        <span className="ml-2 text-sm text-kb-text-muted">Loading channel...</span>
      </div>
    );
  }

  if (error || !channel) {
    return (
      <div>
        <div className="flex items-center gap-2 text-sm text-kb-text-body">
          <AlertCircle size={18} className="text-kb-error" />
          <span>{error || "Channel not found."}</span>
        </div>
        <div className="flex items-center gap-4 mt-3">
          <button onClick={fetchChannel} className="text-sm text-kb-primary font-semibold hover:underline">
            Retry
          </button>
          <Link href="/community" className="text-sm text-kb-primary font-semibold">
            Back to Community Channels
          </Link>
        </div>
      </div>
    );
  }

  const style = STATUS_STYLES[channel.status] || STATUS_STYLES.active;
  const isRemoved = channel.status === "removed";

  return (
    <div>
      <button
        onClick={() => router.push("/community")}
        className="flex items-center gap-1.5 text-sm text-kb-text-muted hover:text-kb-text-body mb-6"
      >
        <ChevronLeft size={16} />
        Back to Community Channels
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-kb-text-body">{channel.name}</h1>
          <p className="text-sm text-kb-text-muted mt-1">
            {[channel.owner, channel.followers].filter(Boolean).join(" · ") || channel.category}
          </p>
        </div>
        <span
          className="text-xs font-semibold rounded-full px-3 py-1.5"
          style={{ backgroundColor: style.bg, color: style.text }}
        >
          {style.label}
        </span>
      </div>

      {actionError && <p className="text-sm text-kb-error mb-3">{actionError}</p>}

      <h2 className="text-sm font-bold text-kb-text-body mb-3">Posts</h2>
      <div className="flex flex-col gap-3 mb-6">
        {posts.length === 0 && <p className="text-sm text-kb-text-muted">No posts in this channel.</p>}
        {posts.map((post) => (
          <div
            key={post.id}
            className={`bg-kb-bg-card border rounded-2xl p-4 ${post.flagged ? "border-red-200" : "border-kb-border"}`}
          >
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <p className="text-sm font-semibold text-kb-text-body">{post.authorName}</p>
                <p className="text-xs text-kb-text-muted mt-0.5">{postDate(post)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {post.flagged && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 rounded-full px-2.5 py-1">
                    <Flag size={11} />
                    Flagged
                  </span>
                )}
                <button
                  onClick={() => removePost(post.id)}
                  disabled={saving}
                  className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors disabled:opacity-60"
                  title="Remove post"
                >
                  <Trash2 size={14} color="#ED4C5C" />
                </button>
              </div>
            </div>
            {post.title && <p className="text-sm font-semibold text-kb-text-body mb-1">{post.title}</p>}
            <p className="text-sm text-kb-text-body leading-relaxed">{post.body}</p>
          </div>
        ))}
      </div>

      <button
        onClick={toggleChannelStatus}
        disabled={saving}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 ${
          isRemoved ? "bg-green-50 hover:bg-green-100 text-green-700" : "bg-red-50 hover:bg-red-100 text-red-600"
        }`}
      >
        {isRemoved ? <RotateCcw size={16} strokeWidth={2.5} /> : <Ban size={16} strokeWidth={2.5} />}
        {isRemoved ? "Restore channel" : "Remove channel"}
      </button>
    </div>
  );
}
