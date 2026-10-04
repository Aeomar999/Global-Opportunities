"use client";

/**
 * Career Resources editor: New article (/content/articles/new) and Edit article (/content/articles/[id]).
 * Built on the shared form system (src/components/ui/form).
 *
 * Fields (all kept from the old page, with the same required rules):
 * - Title (required), Summary (required), Body (required; the same plain textarea as before)
 * - Publishing: Draft or Published
 * - Details: Category (required), Read time (optional)
 * - Cover image (optional): was "Banner Image"
 *
 * Behaviour: errors show after a field is left and on submit; Save shows a spinner while saving, then a
 * toast and back to the list; leaving with unsaved changes asks first (see useUnsavedGuard).
 * Data: mock articles (src/lib/mock-articles.ts). Nothing is persisted yet.
 */
import { useRef, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { useBreadcrumbLabel } from "@/lib/breadcrumb-label";
import { articles, type ArticleStatus } from "@/lib/mock-articles";
import { DetailNotFound } from "@/components/detail/DetailStates";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field } from "@/components/ui/form/Field";
import { FileDrop } from "@/components/ui/form/FileDrop";
import { Input } from "@/components/ui/form/Input";
import { StickyActionBar } from "@/components/ui/form/StickyActionBar";
import { Switch } from "@/components/ui/form/Switch";
import { Textarea } from "@/components/ui/form/Textarea";
import { focusFirstInvalid, useTouched } from "@/components/ui/form/use-touched";
import { useUnsavedGuard } from "@/components/ui/form/use-unsaved-guard";
import { useToast } from "@/components/ui/Toast";

const LIST_HREF = "/content/articles";

interface ArticleForm {
  title: string;
  summary: string;
  content: string;
  status: ArticleStatus;
  category: string;
  duration: string;
  bannerImage: string | undefined;
}

const EMPTY_FORM: ArticleForm = { title: "", summary: "", content: "", status: "draft", category: "", duration: "", bannerImage: undefined };

/** The required-field rules (same as before: each must have text once trimmed). */
function validate(form: ArticleForm) {
  const errors: Partial<Record<"title" | "summary" | "content" | "category", string>> = {};
  if (!form.title.trim()) errors.title = "Enter a title.";
  if (!form.summary.trim()) errors.summary = "Enter a summary.";
  if (!form.content.trim()) errors.content = "Enter the article body.";
  if (!form.category.trim()) errors.category = "Enter a category.";
  return errors;
}

export default function ArticleEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const existing = isNew ? undefined : articles.find((a) => a.id === id);

  const initial: ArticleForm = existing
    ? {
        title: existing.title,
        summary: existing.summary,
        content: existing.content,
        status: existing.status,
        category: existing.category,
        duration: existing.duration,
        bannerImage: existing.bannerImage,
      }
    : EMPTY_FORM;

  const [form, setForm] = useState<ArticleForm>(initial);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { show, touch, touchAll } = useTouched();
  const toast = useToast();

  const dirty = (Object.keys(form) as (keyof ArticleForm)[]).some((key) => form[key] !== initial[key]);
  const guard = useUnsavedGuard(dirty && !saving);
  const errors = validate(form);

  useBreadcrumbLabel(isNew ? "New article" : existing ? existing.title : "Not found");

  if (!isNew && !existing) {
    return <DetailNotFound noun="Article" listLabel="Career Resources" listHref={LIST_HREF} />;
  }

  const set = <K extends keyof ArticleForm>(key: K, value: ArticleForm[K]) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    touchAll();
    if (Object.keys(errors).length > 0) {
      focusFirstInvalid(formRef.current);
      return;
    }
    setSaving(true);
    // TODO(backend): persist this change (create or update the article). Until then this only waits briefly,
    // like a request would, and returns to the list.
    await new Promise((resolve) => setTimeout(resolve, 700));
    toast.success(isNew ? (form.status === "published" ? "The article was published." : "The draft was saved.") : "Your changes were saved.");
    guard.leaveNow(LIST_HREF);
  };

  const saveLabel = isNew ? (form.status === "published" ? "Publish article" : "Save draft") : "Save changes";

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-1 flex-col">
      <div className="mb-6">
        <h1 data-testid="page-title" className="page-title">{isNew ? "New article" : "Edit article"}</h1>
        <p className="page-subtitle mt-1">
          {isNew ? "Write a Career Resources article for seekers." : "Update this Career Resources article."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Main column: the writing */}
        <Card className="space-y-5 lg:col-span-2">
          <Field label="Title" error={show("title") ? errors.title : undefined}>
            <Input
              large
              value={form.title}
              onChange={(event) => set("title", event.target.value)}
              onBlur={() => touch("title")}
              placeholder="e.g. How to write a developer resume that gets noticed"
            />
          </Field>
          <Field label="Summary" helper="One or two sentences shown in the article list." error={show("summary") ? errors.summary : undefined}>
            <Textarea
              rows={2}
              value={form.summary}
              onChange={(event) => set("summary", event.target.value)}
              onBlur={() => touch("summary")}
              placeholder="e.g. Practical tips for a resume that stands out"
            />
          </Field>
          <Field label="Body" error={show("content") ? errors.content : undefined}>
            {/* The same plain textarea as the old page; only its container changed. */}
            <Textarea
              rows={14}
              value={form.content}
              onChange={(event) => set("content", event.target.value)}
              onBlur={() => touch("content")}
              placeholder="Full article body"
            />
          </Field>
        </Card>

        {/* Side column: publishing, details, cover image */}
        <div className="space-y-4 lg:col-span-1">
          <Card>
            <CardHeader title="Publishing" />
            <Switch
              checked={form.status === "published"}
              onChange={(checked) => set("status", checked ? "published" : "draft")}
              label="Published"
              statusText={form.status === "published" ? "Published" : "Draft"}
              description="Visible to seekers when on. Saved as a draft when off."
            />
          </Card>

          <Card>
            <CardHeader title="Details" />
            <div className="space-y-4">
              <Field label="Category" error={show("category") ? errors.category : undefined}>
                <Input
                  value={form.category}
                  onChange={(event) => set("category", event.target.value)}
                  onBlur={() => touch("category")}
                  placeholder="e.g. Resume Writing"
                />
              </Field>
              <Field label="Read time" optional>
                <Input value={form.duration} onChange={(event) => set("duration", event.target.value)} placeholder="e.g. 5 min read" />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Cover image" />
            <Field label="Image" optional helper="Shown at the top of the article.">
              <FileDrop value={form.bannerImage} onChange={(url) => set("bannerImage", url)} alt="Article cover image" />
            </Field>
          </Card>
        </div>
      </div>

      <StickyActionBar dirty={dirty} saving={saving} saveLabel={saveLabel} onCancel={() => guard.leave(LIST_HREF)} />
      {guard.dialog}
    </form>
  );
}
