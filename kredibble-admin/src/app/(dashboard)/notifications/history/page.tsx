"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Users, Building2, Globe } from "lucide-react";
import { notificationBroadcastStore, type Audience, type SentNotification } from "@/lib/notification-store";

const AUDIENCE_META: Record<Audience, { label: string; icon: typeof Users }> = {
  seekers: { label: "All Seekers", icon: Users },
  hirers: { label: "All Hirers", icon: Building2 },
  both: { label: "Everyone", icon: Globe },
};

export default function NotificationHistoryPage() {
  const [history, setHistory] = useState<SentNotification[]>(notificationBroadcastStore.history);

  useEffect(() => {
    const timer = setTimeout(() => {
      setHistory([...notificationBroadcastStore.history]);
    }, 0);
    const unsubscribe = notificationBroadcastStore.subscribe(() => {
      setHistory([...notificationBroadcastStore.history]);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-kb-text-body">Notification History</h1>
        <Link
          href="/notifications/compose"
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-kb-primary text-white text-sm font-semibold"
        >
          <Plus size={15} strokeWidth={2.5} />
          Compose New
        </Link>
      </div>
      <p className="text-sm text-kb-text-muted mb-6">{history.length} broadcasts sent.</p>

      <div className="flex flex-col gap-3">
        {history.map((item) => {
          const meta = AUDIENCE_META[item.audience];
          return (
            <div key={item.id} className="bg-kb-bg-card border border-kb-border rounded-2xl p-4">
              <div className="flex items-start justify-between gap-4 mb-2">
                <p className="text-sm font-semibold text-kb-text-body">{item.title}</p>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-kb-primary bg-kb-primary/10 rounded-full px-2.5 py-1 shrink-0">
                  <meta.icon size={12} />
                  {meta.label}
                </span>
              </div>
              <p className="text-sm text-kb-text-muted leading-relaxed mb-2">{item.message}</p>
              <p className="text-xs text-kb-text-placeholder">{item.sentAt}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
