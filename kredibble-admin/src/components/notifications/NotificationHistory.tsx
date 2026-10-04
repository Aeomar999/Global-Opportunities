"use client";

/**
 * Notification history: every broadcast sent, newest first, with its audience and time.
 * Data: the in-memory notification store (src/lib/notification-store.ts). It is live: a notification
 * sent from the composer appears at the top straight away (the store's subscription).
 * States: an empty list shows an empty state (there is no loading or error: the data is in memory).
 */
import { useSyncExternalStore } from "react";
import { BellOff } from "lucide-react";
import { AUDIENCE_ICON, AUDIENCE_LABEL } from "@/components/notifications/audience";
import { formatDateTime } from "@/lib/format";
import { notificationBroadcastStore } from "@/lib/notification-store";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { TagPill } from "@/components/ui/TagPill";

// The store replaces its `history` array on every change, so the array itself is a valid snapshot.
const subscribe = (notify: () => void) => notificationBroadcastStore.subscribe(notify);
const getSnapshot = () => notificationBroadcastStore.history;

export function NotificationHistory() {
  const history = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return (
    <Card as="section" ariaLabel="History">
      <CardHeader
        title="History"
        subtitle={`${history.length} ${history.length === 1 ? "broadcast" : "broadcasts"} sent.`}
      />
      {history.length === 0 ? (
        <EmptyState icon={BellOff} title="No broadcasts sent yet" description="Notifications you send appear here." />
      ) : (
        <ul className="space-y-3">
          {history.map((item) => {
            const Icon = AUDIENCE_ICON[item.audience];
            return (
              <li key={item.id} className="rounded-control border border-line p-4">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <p className="body-sm min-w-0 break-words font-semibold text-ink">{item.title}</p>
                  <TagPill icon={Icon}>{AUDIENCE_LABEL[item.audience]}</TagPill>
                </div>
                <p className="body-sm mb-2 break-words text-muted">{item.message}</p>
                <p className="caption">{formatDateTime(item.sentAt)}</p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
