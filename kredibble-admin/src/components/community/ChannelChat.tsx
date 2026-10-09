"use client";

/**
 * ChannelChat: the posts of one channel, for the admin. It works like a WhatsApp channel:
 *
 *  - the admin writes a post and decides, with the "Allow replies" switch under the box, whether members may answer it;
 *  - each post shows its reply count and a switch to turn replies on or off later (it takes effect straight away);
 *  - "View replies" opens the thread under the post, where the admin can answer too (an admin can always reply).
 *
 * Data: GET /admin/channels/:id/messages (posts with reply counts) refreshed every 4 seconds while the tab is open (the admin
 * session is an httpOnly cookie, which the realtime socket cannot read, so the dashboard polls; people in the app see
 * new messages instantly), POST /admin/channels/:id/messages (a post, or a reply when parentId is set),
 * PATCH /admin/channels/:id/messages/:messageId (allowReplies) and GET .../:messageId/replies (the thread).
 * Enter sends, Shift+Enter adds a line.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import {
  getChannelMessages, getChannelThread, sendChannelMessage, setPostAllowReplies, type ChatMessageRecord,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/form/Switch";
import { Textarea } from "@/components/ui/form/Textarea";
import { useToast } from "@/components/ui/Toast";

const POLL_MS = 4000;

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const dayOf = (iso: string) => new Date(iso).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });

export function ChannelChat({ channelId }: { channelId: string }) {
  const toast = useToast();
  const [posts, setPosts] = useState<ChatMessageRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [allowReplies, setAllowReplies] = useState(true);
  const [sending, setSending] = useState(false);
  const [openThread, setOpenThread] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);

  const refresh = useCallback(async () => {
    try {
      setPosts(await getChannelMessages(channelId, { limit: 100 }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load posts.");
    }
  }, [channelId]);

  useEffect(() => {
    // Defer the first load so no state is set synchronously inside the effect.
    const first = window.setTimeout(refresh, 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [refresh]);

  useEffect(() => {
    if (posts && posts.length !== lastCount.current) {
      lastCount.current = posts.length;
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
  }, [posts]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const saved = await sendChannelMessage(channelId, body, { allowReplies });
      setPosts((prev) => [...(prev ?? []), saved]);
      setDraft("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the post.");
    } finally {
      setSending(false);
    }
  };

  const toggleReplies = async (post: ChatMessageRecord, next: boolean) => {
    // Optimistic: flip it now, put it back if the server says no.
    setPosts((prev) => prev?.map((p) => (p.id === post.id ? { ...p, allowReplies: next } : p)) ?? prev);
    try {
      await setPostAllowReplies(channelId, post.id, next);
      toast.success(next ? "Members can now reply to this post." : "Replies are turned off for this post.");
    } catch (err) {
      setPosts((prev) => prev?.map((p) => (p.id === post.id ? { ...p, allowReplies: !next } : p)) ?? prev);
      toast.error(err instanceof Error ? err.message : "Could not change this setting.");
    }
  };

  let lastDay = "";

  return (
    <div className="flex h-[620px] flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto rounded-control border border-line bg-surface-2 p-4" aria-live="polite" aria-label="Posts">
        {posts === null && !error && <p className="body-sm text-muted">Loading posts…</p>}
        {error && <p className="body-sm text-danger">{error}</p>}
        {posts?.length === 0 && <p className="body-sm text-muted">No posts yet. Write the first one below. Members can read it, and reply only if you allow it.</p>}
        {posts?.map((post) => {
          const day = dayOf(post.createdAt);
          const showDay = day !== lastDay;
          lastDay = day;
          return (
            <div key={post.id}>
              {showDay && <p className="caption my-2 text-center">{day}</p>}
              <article className="ml-auto max-w-[88%] rounded-control bg-purple-600 px-4 py-3 text-white" aria-label={`Post at ${timeOf(post.createdAt)}`}>
                <p className="input-text whitespace-pre-wrap break-words">{post.body}</p>
                <p className="caption mt-1 text-right text-white/80">{timeOf(post.createdAt)}</p>
              </article>
              <div className="ml-auto mt-2 flex max-w-[88%] flex-wrap items-center justify-end gap-x-4 gap-y-2">
                <button
                  type="button"
                  onClick={() => setOpenThread((current) => (current === post.id ? null : post.id))}
                  aria-expanded={openThread === post.id}
                  className="caption inline-flex items-center gap-1 font-semibold text-purple-700 hover:underline"
                >
                  <MessageSquare size={14} aria-hidden="true" />
                  {post.replyCount === 0 ? "No replies" : `${post.replyCount} ${post.replyCount === 1 ? "reply" : "replies"}`}
                  {openThread === post.id ? " (hide)" : " (view)"}
                </button>
                <div className="min-w-[210px]">
                  <Switch
                    checked={post.allowReplies}
                    onChange={(next) => toggleReplies(post, next)}
                    label="Members can reply"
                    statusText={post.allowReplies ? "On" : "Off"}
                  />
                </div>
              </div>
              {openThread === post.id && <Thread channelId={channelId} post={post} onChanged={refresh} />}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form
        className="mt-3 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <div className="flex items-end gap-3">
          <Textarea
            aria-label="Write a post"
            value={draft}
            rows={2}
            maxLength={2000}
            placeholder="Write a post for the group…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <Button type="submit" icon={Send} loading={sending} disabled={!draft.trim()}>
            Post
          </Button>
        </div>
        <Switch
          checked={allowReplies}
          onChange={setAllowReplies}
          label="Allow members to reply to this post"
          statusText={allowReplies ? "Replies on" : "Replies off"}
          description="Turn this off for announcements. You can change it later from the post."
        />
      </form>
    </div>
  );
}

/** The replies under one post, with a box for the admin to answer. */
function Thread({ channelId, post, onChanged }: { channelId: string; post: ChatMessageRecord; onChanged: () => void }) {
  const toast = useToast();
  const [replies, setReplies] = useState<ChatMessageRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      setReplies((await getChannelThread(channelId, post.id)).replies);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the replies.");
    }
  }, [channelId, post.id]);

  useEffect(() => {
    const first = window.setTimeout(load, 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [load]);

  const reply = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const saved = await sendChannelMessage(channelId, body, { parentId: post.id });
      setReplies((prev) => [...(prev ?? []), saved]);
      setDraft("");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the reply.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="ml-auto mt-3 max-w-[88%] space-y-2 rounded-control border border-line bg-surface p-3" role="group" aria-label="Replies">
      {replies === null && !error && <p className="body-sm text-muted">Loading replies…</p>}
      {error && <p className="body-sm text-danger">{error}</p>}
      {replies?.length === 0 && <p className="body-sm text-muted">{post.allowReplies ? "No replies yet." : "Replies are off for this post."}</p>}
      {replies?.map((r) => (
        <div key={r.id} className={cn("rounded-control px-3 py-2", r.senderRole === "admin" ? "bg-purple-50" : "bg-surface-2")}>
          <p className="caption font-semibold text-purple-700">
            {r.senderName} <span className="font-normal text-muted">· {r.senderRole === "admin" ? "Admin" : r.senderRole} · {timeOf(r.createdAt)}</span>
          </p>
          <p className="input-text whitespace-pre-wrap break-words text-ink">{r.body}</p>
        </div>
      ))}
      <div className="flex items-end gap-2 pt-1">
        <Textarea
          aria-label="Reply"
          value={draft}
          rows={1}
          maxLength={2000}
          placeholder="Reply as admin…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              reply();
            }
          }}
        />
        <Button size="sm" variant="secondary" icon={Send} loading={sending} disabled={!draft.trim()} onClick={reply}>
          Reply
        </Button>
      </div>
    </div>
  );
}
