"use client";

/**
 * Notification composer: Audience, Title, Message (with a character counter) and a live PREVIEW card.
 *
 * Send is disabled until the title and the message both have text. It opens a confirmation dialog that
 * states the audience (a broadcast cannot be undone); on confirm it sends through the in-memory store,
 * shows a toast, clears the form, and the new item appears at the top of History straight away.
 * Built on the shared form system (Field, Input, Textarea) and the shared ConfirmDialog.
 */
import { useState, type FormEvent } from "react";
import { Bell, Send } from "lucide-react";
import { AUDIENCE_LABEL } from "@/components/notifications/audience";
import { notificationBroadcastStore, type Audience } from "@/lib/notification-store";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import { Textarea } from "@/components/ui/form/Textarea";
import { IconTile } from "@/components/ui/IconTile";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/Toast";

const AUDIENCE_OPTIONS: { value: Audience; label: string }[] = [
  { value: "seekers", label: "All Seekers" },
  { value: "hirers", label: "All Hirers" },
  { value: "both", label: "Everyone" },
];

export function NotificationComposer() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<Audience>("both");
  const toast = useToast();
  const { confirm, dialog } = useConfirmDialog();

  const isValid = title.trim() !== "" && message.trim() !== "";
  const audienceLabel = AUDIENCE_LABEL[audience];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!isValid) return;
    const sent = { title: title.trim(), message: message.trim(), audience };
    confirm({
      title: "Send this notification?",
      description: (
        <>
          <strong className="text-ink">&ldquo;{sent.title}&rdquo;</strong> will be sent to{" "}
          <strong className="text-ink">{audienceLabel}</strong>. A broadcast cannot be undone.
        </>
      ),
      confirmLabel: "Send notification",
      tone: "neutral",
      onConfirm: () => {
        // TODO(backend): persist this change (send the broadcast). The in-memory store stands in for now.
        notificationBroadcastStore.send(sent.title, sent.message, sent.audience);
        toast.success(`The notification was sent to ${audienceLabel}.`);
        setTitle("");
        setMessage("");
      },
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Compose" />
        <form onSubmit={submit} noValidate className="space-y-4">
          <div>
            <p id="audience-label" className="field-label mb-1.5 text-ink">
              Audience
            </p>
            <SegmentedControl ariaLabel="Audience" options={AUDIENCE_OPTIONS} value={audience} onChange={setAudience} />
          </div>
          <Field label="Title">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. New verification requirements" />
          </Field>
          <Field label="Message" helper={`${message.length} ${message.length === 1 ? "character" : "characters"}`}>
            <Textarea rows={5} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write the notification body..." />
          </Field>
          <Button type="submit" icon={Send} disabled={!isValid}>
            Send notification
          </Button>
        </form>
      </Card>

      <Card as="section" ariaLabel="Preview">
        <CardHeader title="Preview" subtitle="How it will look in the notification feed." />
        <div className="flex items-start gap-3 rounded-control border border-line bg-surface-2 p-4">
          <IconTile icon={Bell} tone="accent" size="md" />
          <div className="min-w-0 flex-1">
            <p className={title.trim() ? "body-sm break-words font-semibold text-ink" : "body-sm font-semibold text-muted"}>
              {title.trim() || "Notification title"}
            </p>
            <p className={message.trim() ? "body-sm mt-0.5 whitespace-pre-line break-words text-ink" : "body-sm mt-0.5 text-muted"}>
              {message.trim() || "Your message appears here."}
            </p>
            <p className="caption mt-2">Just now · {audienceLabel}</p>
          </div>
        </div>
      </Card>
      {dialog}
    </div>
  );
}
