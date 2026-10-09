"use client";

/**
 * Community Channels: every channel across the platform.
 * Built on the shared list template; this file holds the column config and the data.
 * Data: the real API (GET /admin/community/channels). In mock mode (NEXT_PUBLIC_USE_MOCKS=true) the sample channels in
 * src/lib/mock-channels.ts are shown instead.
 *
 * "Create channel" opens a small form (name, category, description, private or public). Private, invite-only channels are
 * how the Ambassadors group is made. Each row opens the channel: members and group chat.
 *
 * A flagged channel's status badge shows a flag ICON with the text "Flagged". Emoji in stored channel
 * names (e.g. a siren) are removed from the title so the marker is never an emoji.
 */
import { useCallback, useState } from "react";
import { Flag, Hash, Plus } from "lucide-react";
import { getCommunityChannels } from "@/lib/api";
import { stripEmoji } from "@/lib/format";
import { channels, type Channel } from "@/lib/mock-channels";
import { overlayRows, subscribeMockStore } from "@/lib/mock-store";
import { isMockMode } from "@/lib/services/mock-mode";
import { useListData } from "@/lib/use-list-data";
import { CreateChannelDialog } from "@/components/community/CreateChannelDialog";
import { DataTable } from "@/components/list/DataTable";
import { ListPage } from "@/components/list/ListPage";
import { TableToolbar } from "@/components/list/TableToolbar";
import type { Column } from "@/components/list/types";
import { Button } from "@/components/ui/Button";

const loadChannels = async (): Promise<Channel[]> => {
  if (isMockMode()) return overlayRows("channels", channels);
  const page = await getCommunityChannels({ limit: 100 });
  return page.data.map((c) => ({
    id: c.id,
    name: c.name,
    owner: c.visibility === "private" ? `${c.owner ?? "Admin"} (private)` : c.owner ?? "Public",
    category: c.category,
    followers: c.followers ?? "",
    postsCount: c.postsCount ?? 0,
    status: c.status === "removed" || c.status === "flagged" ? c.status : "active",
    posts: [],
  }));
};

const COLUMNS: Column<Channel>[] = [
  { key: "channel", header: "Channel", type: "primary", width: "32%", title: (r) => stripEmoji(r.name), leading: () => ({ icon: Hash }) },
  { key: "owner", header: "Owner", type: "text", width: "22%", value: (r) => r.owner },
  { key: "followers", header: "Followers", type: "number", width: "14%", value: (r) => r.followers },
  { key: "posts", header: "Posts", type: "number", width: "12%", value: (r) => r.postsCount },
  { key: "status", header: "Status", type: "status", width: "20%", status: (r) => r.status, icon: (r) => (r.status === "flagged" ? Flag : undefined) },
];

export default function CommunityChannelsPage() {
  const { rows, isLoading, error, retry } = useListData(loadChannels, { subscribe: subscribeMockStore });
  const [creating, setCreating] = useState(false);
  const closeDialog = useCallback(() => setCreating(false), []);
  const flaggedCount = (rows ?? []).filter((c) => c.status === "flagged").length;

  return (
    <>
      <ListPage
        title="Community Channels"
        subtitle={rows ? `All channels across the platform. ${flaggedCount} flagged for review.` : "All channels across the platform."}
        toolbar={
          !isMockMode() && (
            <TableToolbar>
              <Button icon={Plus} onClick={() => setCreating(true)}>
                Create channel
              </Button>
            </TableToolbar>
          )
        }
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
          emptyNoData={{ icon: Hash, title: "No channels yet", description: "Create one, for example a private group for your ambassadors." }}
          emptyNoResults={{ icon: Hash, title: "No channels match" }}
        />
      </ListPage>
      <CreateChannelDialog open={creating} onClose={closeDialog} onCreated={retry} />
    </>
  );
}
