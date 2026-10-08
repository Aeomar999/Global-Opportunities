"use client";

/**
 * LogAmplificationDialog: a small form in a ConfirmDialog ("Log amplification") for recording one share by hand.
 *   Channel (required, a Select of the social platforms) and a Note (optional).
 * Saving adds an entry to the ambassador's amplification log dated today, which counts toward this month's shares on the
 * detail page and on the leaderboard. The dialog has the ConfirmDialog behaviour: focus moves in, stays inside, Esc and the
 * backdrop cancel, and focus returns to the button that opened it.
 *
 * Props:
 * - open: shown or not (state lives in the page)
 * - ambassadorName: who it is for (named in the text, so the person can check)
 * - onSave(channel, note): called with a chosen channel; the page writes it and shows the toast
 * - onCancel: close without saving
 */
import { useState } from "react";
import { PLATFORM_LABELS } from "@/components/network/network-meta";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/form/Field";
import { Select, type SelectOption } from "@/components/ui/form/Select";
import { Textarea } from "@/components/ui/form/Textarea";
import { SOCIAL_PLATFORMS, type SocialPlatform } from "@/lib/mock-entities";

const CHANNEL_OPTIONS: SelectOption<SocialPlatform>[] = SOCIAL_PLATFORMS.map((value) => ({ value, label: PLATFORM_LABELS[value] }));

interface LogAmplificationDialogProps {
  open: boolean;
  ambassadorName: string;
  onSave: (channel: SocialPlatform, note: string) => void;
  onCancel: () => void;
}

export function LogAmplificationDialog({ open, ambassadorName, onSave, onCancel }: LogAmplificationDialogProps) {
  const [channel, setChannel] = useState<SocialPlatform | "">("");
  const [note, setNote] = useState("");
  const [attempted, setAttempted] = useState(false);

  const reset = () => {
    setChannel("");
    setNote("");
    setAttempted(false);
  };

  return (
    <ConfirmDialog
      open={open}
      tone="neutral"
      title="Log amplification"
      confirmLabel="Log amplification"
      description={
        <div className="space-y-4 text-left">
          <p>
            Record one share by <strong className="text-ink">{ambassadorName}</strong>. It is dated today and counts toward this month&apos;s shares.
          </p>
          <Field label="Channel" error={attempted && !channel ? "Choose the channel they shared on." : undefined}>
            <Select options={CHANNEL_OPTIONS} value={channel} onChange={setChannel} placeholder="Choose a channel" sheetTitle="Channel" />
          </Field>
          <Field label="Note" optional>
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Which listing, or where it was shared" />
          </Field>
        </div>
      }
      onConfirm={() => {
        if (!channel) {
          setAttempted(true);
          return false;
        }
        onSave(channel, note);
        reset();
        return undefined;
      }}
      onCancel={() => {
        reset();
        onCancel();
      }}
    />
  );
}
