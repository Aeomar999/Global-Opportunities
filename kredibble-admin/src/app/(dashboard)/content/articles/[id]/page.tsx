"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertCircle, ChevronLeft, ImagePlus, Loader2, X } from "lucide-react";
import { createArticle, getArticleById, updateArticle, uploadArticleBanner } from "@/lib/api";

type ArticleStatus = "draft" | "published";

export default function ArticleEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = params.id === "new";

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [duration, setDuration] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<ArticleStatus>("draft");
  // Only ever a URL the API returned: a local preview URL is never stored.
  const [bannerImage, setBannerImage] = useState<string | undefined>(undefined);

  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchArticle = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    setLoadError(null);
    try {
      const article = await getArticleById(params.id);
      setTitle(article.title);
      setCategory(article.category);
      setDuration(article.duration ?? "");
      setSummary(article.summary);
      setContent(article.content);
      setStatus(article.status === "published" ? "published" : "draft");
      setBannerImage(article.bannerImage || undefined);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load article");
    } finally {
      setLoading(false);
    }
  }, [isNew, params.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchArticle();
  }, [fetchArticle]);

  const pickBannerImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setUploading(true);
      setActionError(null);
      try {
        const uploaded = await uploadArticleBanner(file);
        setBannerImage(uploaded.url);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Failed to upload the banner image");
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 size={24} className="animate-spin text-kb-primary" />
        <span className="ml-2 text-sm text-kb-text-muted">Loading article...</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <div className="flex items-center gap-2 text-sm text-kb-text-body">
          <AlertCircle size={18} className="text-kb-error" />
          <span>{loadError}</span>
        </div>
        <div className="flex items-center gap-4 mt-3">
          <button onClick={fetchArticle} className="text-sm text-kb-primary font-semibold hover:underline">
            Retry
          </button>
          <button onClick={() => router.push("/content/articles")} className="text-sm text-kb-primary font-semibold">
            Back to Career Resources
          </button>
        </div>
      </div>
    );
  }

  const isValid = Boolean(title.trim() && category.trim() && summary.trim() && content.trim());

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    setActionError(null);
    const fields = {
      title: title.trim(),
      category: category.trim(),
      duration: duration.trim(),
      summary: summary.trim(),
      content: content.trim(),
      status,
    };
    try {
      if (isNew) {
        await createArticle(bannerImage ? { ...fields, bannerImage } : fields);
      } else {
        // An empty string clears a removed banner.
        await updateArticle(params.id, { ...fields, bannerImage: bannerImage ?? "" });
      }
      router.push("/content/articles");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to save the article");
      setSaving(false);
    }
  };

  const saveLabel = isNew ? (status === "published" ? "Publish Article" : "Save Draft") : "Save Changes";

  return (
    <div className="max-w-2xl">
      <button
        onClick={() => router.push("/content/articles")}
        className="flex items-center gap-1.5 text-sm text-kb-text-muted hover:text-kb-text-body mb-6"
      >
        <ChevronLeft size={16} />
        Back to Career Resources
      </button>

      <h1 className="text-xl font-bold text-kb-text-body mb-6">
        {isNew ? "New Article" : "Edit Article"}
      </h1>

      <div className="flex flex-col gap-4">
        <Field label="Banner Image">
          {bannerImage ? (
            <div className="relative rounded-lg overflow-hidden border border-kb-border-input h-40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={bannerImage} alt="Article banner" className="w-full h-full object-cover" />
              <button
                onClick={() => setBannerImage(undefined)}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 hover:bg-black/75 flex items-center justify-center transition-colors"
                title="Remove banner"
              >
                <X size={14} color="#FFFFFF" />
              </button>
              <button
                onClick={pickBannerImage}
                disabled={uploading}
                className="absolute bottom-2 right-2 px-3 py-1.5 rounded-lg bg-black/60 hover:bg-black/75 text-white text-xs font-semibold transition-colors disabled:opacity-60"
              >
                {uploading ? "Uploading..." : "Replace"}
              </button>
            </div>
          ) : (
            <button
              onClick={pickBannerImage}
              disabled={uploading}
              className="flex flex-col items-center justify-center gap-2 w-full h-40 rounded-lg border border-dashed border-kb-border-input bg-kb-bg-alt hover:border-kb-primary transition-colors disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 size={22} className="animate-spin text-kb-primary" />
              ) : (
                <ImagePlus size={22} className="text-kb-text-placeholder" />
              )}
              <span className="text-sm text-kb-text-muted">
                {uploading ? "Uploading..." : "Click to upload a banner image"}
              </span>
            </button>
          )}
        </Field>

        <Field label="Title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. How to write a developer resume that gets noticed"
            className="w-full h-11 rounded-lg border border-kb-border-input px-3 text-sm text-kb-text-body outline-none focus:border-kb-primary"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Category">
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Resume Writing"
              className="w-full h-11 rounded-lg border border-kb-border-input px-3 text-sm text-kb-text-body outline-none focus:border-kb-primary"
            />
          </Field>
          <Field label="Read Time">
            <input
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 5 min read"
              className="w-full h-11 rounded-lg border border-kb-border-input px-3 text-sm text-kb-text-body outline-none focus:border-kb-primary"
            />
          </Field>
        </div>

        <Field label="Summary">
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={2}
            placeholder="One or two sentences shown in the article list"
            className="w-full rounded-lg border border-kb-border-input px-3 py-2.5 text-sm text-kb-text-body outline-none focus:border-kb-primary resize-none"
          />
        </Field>

        <Field label="Content">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
            placeholder="Full article body"
            className="w-full rounded-lg border border-kb-border-input px-3 py-2.5 text-sm text-kb-text-body outline-none focus:border-kb-primary resize-none"
          />
        </Field>

        <Field label="Status">
          <div className="flex gap-2">
            {(["draft", "published"] as ArticleStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  status === s
                    ? "bg-kb-primary text-white"
                    : "bg-kb-bg-card border border-kb-border text-kb-text-muted"
                }`}
              >
                {s === "draft" ? "Draft" : "Published"}
              </button>
            ))}
          </div>
        </Field>

        {actionError && <p className="text-sm text-kb-error">{actionError}</p>}

        <button
          onClick={handleSave}
          disabled={!isValid || saving || uploading}
          className="mt-2 h-11 rounded-lg bg-kb-primary text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          {saving ? "Saving..." : saveLabel}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-kb-text-body mb-1.5">{label}</label>
      {children}
    </div>
  );
}
