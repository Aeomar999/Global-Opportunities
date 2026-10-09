"use client";

/**
 * ChannelMembers: who is in a channel, and who can be added.
 *
 * - Members: GET /admin/channels/:id/members, each with a Remove action (confirm dialog).
 * - Approved ambassadors not yet in the channel: from GET /admin/ambassador-requests?status=approved, one click adds them
 *   (POST /admin/channels/:id/members). Adding sends the person a notification.
 */
import { useCallback, useEffect, useState } from "react";
import { UserMinus, UserPlus } from "lucide-react";
import {
  addChannelMember, getAmbassadorRequests, getChannelMembers, removeChannelMember,
  type AmbassadorRequestRecord, type ChannelMemberRecord,
} from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { IconButton } from "@/components/ui/IconButton";
import { useToast } from "@/components/ui/Toast";

export function ChannelMembers({ channelId, creatorId }: { channelId: string; creatorId?: string | null }) {
  const toast = useToast();
  const { confirm, dialog } = useConfirmDialog();
  const [members, setMembers] = useState<ChannelMemberRecord[] | null>(null);
  const [candidates, setCandidates] = useState<AmbassadorRequestRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [list, approved] = await Promise.all([getChannelMembers(channelId), getAmbassadorRequests({ status: "approved", limit: 100 })]);
      setMembers(list);
      setCandidates(approved.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load members.");
    }
  }, [channelId]);

  useEffect(() => {
    const first = window.setTimeout(refresh, 0);
    return () => window.clearTimeout(first);
  }, [refresh]);

  const memberIds = new Set((members ?? []).map((m) => m.userId));
  const addable = candidates.filter((c) => !memberIds.has(c.userId));

  const add = async (request: AmbassadorRequestRecord) => {
    setBusy(request.userId);
    try {
      await addChannelMember(channelId, request.userId);
      toast.success(`${request.name} was added.`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add this person.");
    } finally {
      setBusy(null);
    }
  };

  const remove = (member: ChannelMemberRecord) =>
    confirm({
      title: "Remove this member?",
      description: (
        <>
          <strong className="text-ink">{member.name ?? "This person"}</strong> will no longer see or send messages in this channel.
        </>
      ),
      confirmLabel: "Remove member",
      onConfirm: async () => {
        try {
          await removeChannelMember(channelId, member.userId);
          toast.success(`${member.name ?? "The member"} was removed.`);
          await refresh();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not remove this member.");
        }
      },
    });

  return (
    <div className="space-y-6">
      <section aria-label="Members">
        <h3 className="card-title mb-3">Members{members ? ` (${members.length})` : ""}</h3>
        {error && <p className="body-sm text-danger">{error}</p>}
        {members?.length === 0 && <p className="body-sm text-muted">Nobody has joined yet.</p>}
        <ul className="divide-y divide-line">
          {members?.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={m.name ?? "Member"} />
                <div className="min-w-0">
                  <p className="body-sm truncate font-semibold text-ink">
                    {m.name ?? "Member"} {m.role === "admin" && <span className="caption font-normal text-purple-700">· Admin</span>}
                  </p>
                  <p className="caption truncate">{m.email}</p>
                </div>
              </div>
              {m.userId !== creatorId && m.role !== "admin" && (
                <IconButton label={`Remove ${m.name ?? "member"}`} icon={UserMinus} tone="danger" onClick={() => remove(m)} />
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Approved ambassadors to add">
        <h3 className="card-title mb-3">Approved ambassadors not in this channel</h3>
        {addable.length === 0 ? (
          <p className="body-sm text-muted">Everyone approved is already here. New approvals can be added from their application.</p>
        ) : (
          <ul className="divide-y divide-line">
            {addable.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={c.name} />
                  <div className="min-w-0">
                    <p className="body-sm truncate font-semibold text-ink">{c.name}</p>
                    <p className="caption truncate">{c.email}</p>
                  </div>
                </div>
                <Button size="sm" variant="secondary" icon={UserPlus} loading={busy === c.userId} onClick={() => add(c)}>
                  Add
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {dialog}
    </div>
  );
}
