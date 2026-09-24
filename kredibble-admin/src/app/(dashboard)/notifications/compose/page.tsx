"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { notificationBroadcastStore, type Audience } from "@/lib/notification-store";

const AUDIENCES: { label: string; value: Audience }[] = [
  { label: "All Seekers", value: "seekers" },
  { label: "All Hirers", value: "hirers" },
  { label: "Both", value: "both" },
];

export default function NotificationComposerPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<Audience>("both");

  const isValid = title.trim() && message.trim();

  const handleSend = () => {
    if (!isValid) return;
    notificationBroadcastStore.send(title.trim(), message.trim(), audience);
    router.push("/notifications/history");
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold text-kb-text-body mb-1">Notification Composer</h1>
      <p className="text-sm text-kb-text-muted mb-6">
        Send a broadcast message into the recipients&apos; in-app notification feed.
      </p>

      <div className="bg-kb-bg-card border border-kb-border rounded-2xl p-5 flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-kb-text-body mb-1.5">Audience</label>
          <div className="flex gap-2">
            {AUDIENCES.map((a) => (
              <button
                key={a.value}
                onClick={() => setAudience(a.value)}
                className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  audience === a.value
                    ? "bg-kb-primary text-white"
                    : "bg-kb-bg-alt border border-kb-border text-kb-text-muted"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-kb-text-body mb-1.5">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. New verification requirements"
            className="w-full h-11 rounded-lg border border-kb-border-input px-3 text-sm text-kb-text-body outline-none focus:border-kb-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-kb-text-body mb-1.5">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Write the notification body..."
            className="w-full rounded-lg border border-kb-border-input px-3 py-2.5 text-sm text-kb-text-body outline-none focus:border-kb-primary resize-none"
          />
        </div>

        <button
          onClick={handleSend}
          disabled={!isValid}
          className="flex items-center justify-center gap-2 h-11 rounded-lg bg-kb-primary text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          <Send size={15} />
          Send Notification
        </button>
      </div>
    </div>
  );
}
