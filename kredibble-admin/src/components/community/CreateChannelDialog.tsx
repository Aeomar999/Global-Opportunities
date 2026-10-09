"use client";

/**
 * CreateChannelDialog: a small modal form that creates a channel through POST /admin/channels.
 *
 * Fields: name, category, short description and visibility. Private channels are invite-only: nobody joins
 * unless an admin adds them (this is what the Ambassadors channel should be). Esc and the backdrop close it.
 * Props: open, onClose, onCreated(channel).
 */
import { useEffect, useState } from "react";
import { createAdminChannel, type ChannelRecord } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import { Select } from "@/components/ui/form/Select";
import { Textarea } from "@/components/ui/form/Textarea";
import { useToast } from "@/components/ui/Toast";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (channel: ChannelRecord) => void;
}

export function CreateChannelDialog({ open, onClose, onCreated }: Props) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async () => {
    if (name.trim().length < 2) {
      setNameError("Give the channel a name (at least 2 characters).");
      return;
    }
    setNameError(null);
    setSaving(true);
    try {
      const channel = await createAdminChannel({ name: name.trim(), bio: bio.trim() || undefined, visibility });
      toast.success(`${channel.name} was created.`);
      setName("");
      setBio("");
      onCreated(channel);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the channel.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label="Create channel" className="card-surface relative w-full max-w-md space-y-4 rounded-card bg-surface p-6">
        <div>
          <h2 className="card-title">Create channel</h2>
          <p className="caption mt-1">Private channels are invite-only: only people you add can read and chat.</p>
        </div>
        <Field label="Name" error={nameError ?? undefined}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kredibble Ambassadors" maxLength={80} autoFocus />
        </Field>
        <Field label="Description" optional>
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={500} />
        </Field>
        <Field label="Who can join">
          <Select
            value={visibility}
            onChange={setVisibility}
            options={[
              { value: "private", label: "Private (invite only)", description: "Recommended for ambassadors" },
              { value: "public", label: "Public", description: "Anyone in the app can find and read it" },
            ]}
          />
        </Field>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            Create channel
          </Button>
        </div>
      </div>
    </div>
  );
}
