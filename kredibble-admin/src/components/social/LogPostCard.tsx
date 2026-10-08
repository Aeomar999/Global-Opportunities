"use client";

/**
 * LogPostCard: the "Log a post" card on /social. Posts are logged by hand (there is no live platform API).
 *
 * Fields (all required except the opportunity): Platform (Facebook, Instagram, X, LinkedIn, TikTok, YouTube, WhatsApp, Other),
 * Post title, Post URL (checked: a full http or https link), Reach and Engagement (whole numbers, 0 or more), Linked
 * opportunity (optional: a published listing) and Date posted (the DatePicker: today by default; the calendar cannot pick a day
 * after today, and a typed future date is refused by the form and by the service).
 * Saving adds a PUBLISHED post to the store (services/social.ts), so the monthly totals, the platform table, the posts list and
 * the Posts published, Social reach and Social engagement KPIs all change in the same render. The form then resets (the date goes
 * back to today) and a toast says what was logged. Leaving with unsaved changes asks first (the shared guard).
 * Errors show after a field is left and on submit; the first invalid field takes focus. The save carries a TODO(backend).
 *
 * Props: onLogged?(post): called after a save (the page uses it to follow the month of the post when it is in another month)
 */
import { useMemo, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field } from "@/components/ui/form/Field";
import { DatePicker } from "@/components/ui/form/DatePicker";
import { Input } from "@/components/ui/form/Input";
import { Select, type SelectOption } from "@/components/ui/form/Select";
import { focusFirstInvalid, useTouched } from "@/components/ui/form/use-touched";
import { useUnsavedGuard } from "@/components/ui/form/use-unsaved-guard";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/format";
import { POST_PLATFORM_LABELS, SOCIAL_POST_PLATFORMS, type PostPlatform, type SocialPost } from "@/lib/mock-entities";
import { todayIsoDate } from "@/lib/services/listings";
import { logPost, opportunityOptions, validatePost, type PostFormState } from "@/lib/services/social";

const NONE = "none";
const PLATFORM_OPTIONS: SelectOption<PostPlatform>[] = SOCIAL_POST_PLATFORMS.map((value) => ({ value, label: POST_PLATFORM_LABELS[value] }));

const emptyForm = (): PostFormState => ({ platform: "", title: "", url: "", reach: "", engagement: "", listingId: NONE, postedAt: todayIsoDate() });

export function LogPostCard({ onLogged }: { onLogged?: (post: SocialPost) => void }) {
  const opportunities = useMemo(() => opportunityOptions(), []);
  const [form, setForm] = useState<PostFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { show, touch, touchAll, reset } = useTouched();
  const toast = useToast();

  const today = todayIsoDate();
  const blank = emptyForm();
  const dirty = (Object.keys(blank) as (keyof PostFormState)[]).some((key) => form[key] !== blank[key]);
  const guard = useUnsavedGuard(dirty && !saving);
  const errors = validatePost(form, today);
  const listingSelect: SelectOption<string>[] = [{ value: NONE, label: "No linked opportunity" }, ...opportunities.map((o) => ({ value: o.id, label: o.title, description: o.organisation }))];

  const set = <K extends keyof PostFormState>(key: K, value: PostFormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    touchAll();
    if (Object.keys(errors).length > 0) {
      focusFirstInvalid(formRef.current);
      return;
    }
    setSaving(true);
    // TODO(backend): persist this change (log the post; the API sets who logged it).
    await new Promise((resolve) => setTimeout(resolve, 300));
    const result = logPost({
      platform: form.platform as PostPlatform,
      title: form.title,
      url: form.url,
      reach: Number(form.reach),
      engagement: Number(form.engagement),
      listingId: form.listingId === NONE ? undefined : form.listingId,
      postedAt: form.postedAt,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`A ${POST_PLATFORM_LABELS[result.post.platform]} post was logged for ${formatDate(result.post.postedAt)}.`);
    setForm(emptyForm());
    reset();
    onLogged?.(result.post);
  };

  return (
    <Card as="section" ariaLabel="Log a post" className="flex flex-1 flex-col">
      <CardHeader title="Log a post" subtitle="Add a post you published. It counts in the month of its date." />
      <form ref={formRef} onSubmit={submit} noValidate className="flex flex-1 flex-col gap-4">
        <Field label="Platform" error={show("platform") ? errors.platform : undefined}>
          <Select options={PLATFORM_OPTIONS} value={form.platform} onChange={(value) => set("platform", value)} onBlur={() => touch("platform")} placeholder="Choose a platform" sheetTitle="Platform" />
        </Field>
        <Field label="Post title" error={show("title") ? errors.title : undefined}>
          <Input value={form.title} onChange={(e) => set("title", e.target.value)} onBlur={() => touch("title")} placeholder="e.g. Applications are open for the fellowship" autoComplete="off" />
        </Field>
        <Field label="Post URL" error={show("url") ? errors.url : undefined}>
          <Input type="url" inputMode="url" value={form.url} onChange={(e) => set("url", e.target.value)} onBlur={() => touch("url")} placeholder="https://www.instagram.com/p/…" autoComplete="off" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Reach" error={show("reach") ? errors.reach : undefined}>
            <Input inputMode="numeric" value={form.reach} onChange={(e) => set("reach", e.target.value)} onBlur={() => touch("reach")} placeholder="0" autoComplete="off" />
          </Field>
          <Field label="Engagement" error={show("engagement") ? errors.engagement : undefined}>
            <Input inputMode="numeric" value={form.engagement} onChange={(e) => set("engagement", e.target.value)} onBlur={() => touch("engagement")} placeholder="0" autoComplete="off" />
          </Field>
        </div>
        <Field label="Linked opportunity" optional helper="The opportunity the post promotes, if there is one.">
          <Select options={listingSelect} value={form.listingId} onChange={(value) => set("listingId", value)} sheetTitle="Linked opportunity" />
        </Field>
        <Field label="Date posted" error={show("postedAt") ? errors.postedAt : undefined}>
          <DatePicker value={form.postedAt} onChange={(iso) => set("postedAt", iso)} onBlur={() => touch("postedAt")} max={today} label="Choose the date posted" />
        </Field>
        <div className="mt-auto flex justify-end">
          <Button type="submit" loading={saving}>
            Log post
          </Button>
        </div>
      </form>
      {guard.dialog}
    </Card>
  );
}
