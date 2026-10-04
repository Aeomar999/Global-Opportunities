"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ChevronRight, Hash, Loader2 } from "lucide-react";
import { getCommunityChannels, type ChannelRecord } from "@/lib/api";

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "#F0FDF4", text: "#16A34A", label: "Active" },
  flagged: { bg: "#FFFBEB", text: "#B7791F", label: "Flagged" },
  removed: { bg: "#FEF2F2", text: "#ED4C5C", label: "Removed" },
};

export default function CommunityChannelsPage() {
  const [channels, setChannels] = useState<ChannelRecord[]>([]);
  const [flaggedCount, setFlaggedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChannels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, flagged] = await Promise.all([
        getCommunityChannels({ limit: 100 }),
        getCommunityChannels({ status: "flagged", limit: 1 }),
      ]);
      setChannels(list.data);
      setFlaggedCount(flagged.meta.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load channels");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchChannels();
  }, [fetchChannels]);

  return (
    <div>
      <h1 className="text-xl font-bold text-kb-text-body mb-1">Community Channels</h1>
      <p className="text-sm text-kb-text-muted mb-6">
        All channels across the platform. {flaggedCount} flagged for review.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={24} className="animate-spin text-kb-primary" />
          <span className="ml-2 text-sm text-kb-text-muted">Loading channels...</span>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-10 text-center">
          <AlertCircle size={24} className="text-kb-error mr-2" />
          <div className="text-sm text-kb-text-body">
            <p className="font-medium">Failed to load channels</p>
            <p className="text-xs text-kb-text-muted mt-1">{error}</p>
            <button onClick={fetchChannels} className="mt-3 text-sm text-kb-primary hover:underline">
              Retry
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-kb-bg-card border border-kb-border rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[1.8fr_1.4fr_1fr_1fr_1fr_20px] gap-4 px-5 py-3 border-b border-kb-border text-xs font-semibold uppercase tracking-wide text-kb-text-placeholder">
            <span>Channel</span>
            <span>Owner</span>
            <span>Followers</span>
            <span>Posts</span>
            <span>Status</span>
            <span />
          </div>

          {channels.map((channel) => {
            const style = STATUS_STYLES[channel.status] || STATUS_STYLES.active;
            return (
              <Link
                key={channel.id}
                href={`/community/${channel.id}`}
                className="grid grid-cols-[1.8fr_1.4fr_1fr_1fr_1fr_20px] gap-4 px-5 py-4 items-center border-b border-kb-border last:border-b-0 hover:bg-kb-bg-alt transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-kb-bg-alt flex items-center justify-center shrink-0">
                    <Hash size={16} className="text-kb-text-muted" />
                  </div>
                  <span className="text-sm font-semibold text-kb-text-body truncate" title={channel.name}>
                    {channel.name}
                  </span>
                </div>
                <span className="text-sm text-kb-text-muted truncate">{channel.owner || "—"}</span>
                <span className="text-sm text-kb-text-muted truncate">{channel.followers || "—"}</span>
                <span className="text-sm text-kb-text-muted truncate">{channel.postsCount}</span>
                <span
                  className="inline-flex w-fit text-xs font-semibold rounded-full px-2.5 py-1"
                  style={{ backgroundColor: style.bg, color: style.text }}
                >
                  {style.label}
                </span>
                <ChevronRight size={18} className="text-kb-text-placeholder justify-self-end" />
              </Link>
            );
          })}

          {channels.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-kb-text-muted">No channels yet.</div>
          )}
        </div>
      )}
    </div>
  );
}
