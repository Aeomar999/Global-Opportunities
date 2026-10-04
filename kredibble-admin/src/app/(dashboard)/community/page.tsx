"use client";

/**
 * Community Channels: every channel across the platform.
 * Built on the shared list template; this file holds the column config and the data.
 * Data: mock channels (src/lib/mock-channels.ts), unchanged.
 *
 * A flagged channel's status badge shows a flag ICON with the text "Flagged". Emoji in stored channel
 * names (e.g. a siren) are removed from the title so the marker is never an emoji.
 */
import { Flag, Hash } from "lucide-react";
import { stripEmoji } from "@/lib/format";
import { channels, type Channel } from "@/lib/mock-channels";
import { overlayRows, subscribeMockStore } from "@/lib/mock-store";
import { useListData } from "@/lib/use-list-data";
import { DataTable } from "@/components/list/DataTable";
import { ListPage } from "@/components/list/ListPage";
import type { Column } from "@/components/list/types";

// Mock records with this session's changes (see mock-store.ts) laid over them.
const loadChannels = () => Promise.resolve(overlayRows("channels", channels));

const COLUMNS: Column<Channel>[] = [
  { key: "channel", header: "Channel", type: "primary", width: "32%", title: (r) => stripEmoji(r.name), leading: () => ({ icon: Hash }) },
  { key: "owner", header: "Owner", type: "text", width: "22%", value: (r) => r.owner },
  { key: "followers", header: "Followers", type: "number", width: "14%", value: (r) => r.followers },
  { key: "posts", header: "Posts", type: "number", width: "12%", value: (r) => r.postsCount },
  { key: "status", header: "Status", type: "status", width: "20%", status: (r) => r.status, icon: (r) => (r.status === "flagged" ? Flag : undefined) },
];

export default function CommunityChannelsPage() {
  const { rows, isLoading, error, retry } = useListData(loadChannels, { subscribe: subscribeMockStore });
  const flaggedCount = (rows ?? []).filter((c) => c.status === "flagged").length;

  return (
    <ListPage
      title="Community Channels"
      subtitle={rows ? `All channels across the platform. ${flaggedCount} flagged for review.` : "All channels across the platform."}
    >
      <DataTable
        label="Channels"
        columns={COLUMNS}
        rows={rows ?? []}
        getRowKey={(r) => r.id}
        getRowHref={(r) => `/community/${r.id}`}
        loading={isLoading}
        error={error}
        onRetry={retry}
        emptyNoData={{ icon: Hash, title: "No channels yet", description: "Community channels appear here once they are created." }}
        emptyNoResults={{ icon: Hash, title: "No channels match" }}
      />
    </ListPage>
  );
}
