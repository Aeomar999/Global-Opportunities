"use client";

/**
 * FileDrop: pick or drop ONE image, with a preview and a way to remove it.
 *
 * Empty: a dashed drop area (a real <button>, so Tab + Enter/Space opens the file picker) with an
 * icon and "Click to upload or drag an image here". Dragging an image over it highlights the area.
 * Filled: the image preview (16:9, cover) with "Replace" and "Remove" buttons under it.
 *
 * Only images are accepted (accept="image/*"); anything else shows an inline message and is ignored.
 *
 * Props:
 * - value: the current image URL (an object URL for a new pick, or the saved URL), or undefined
 * - onChange(url | undefined): called with a new object URL, or undefined after Remove
 * - alt: description of the image for screen readers ("Article cover image")
 * - emptyLabel: text in the empty drop area
 * Object URLs created here are revoked when replaced, removed or unmounted.
 */
import { useEffect, useRef, useState, type DragEvent } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useFieldControlProps } from "./Field";

interface FileDropProps {
  value: string | undefined;
  onChange: (url: string | undefined) => void;
  alt: string;
  emptyLabel?: string;
}

export function FileDrop({ value, onChange, alt, emptyLabel = "Click to upload or drag an image here" }: FileDropProps) {
  const fieldProps = useFieldControlProps();
  const inputRef = useRef<HTMLInputElement>(null);
  const ownedUrls = useRef(new Set<string>());
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Free the browser memory of every object URL made here when the form closes.
  useEffect(() => {
    const urls = ownedUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const release = (url: string | undefined) => {
    if (url && ownedUrls.current.has(url)) {
      URL.revokeObjectURL(url);
      ownedUrls.current.delete(url);
    }
  };

  const accept = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("That file is not an image. Choose a PNG, JPG, WebP or SVG.");
      return;
    }
    setMessage(null);
    release(value);
    const url = URL.createObjectURL(file);
    ownedUrls.current.add(url);
    onChange(url);
  };

  const remove = () => {
    release(value);
    setMessage(null);
    onChange(undefined);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    accept(event.dataTransfer.files?.[0]);
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
        onChange={(event) => {
          accept(event.target.files?.[0]);
          event.target.value = ""; // the same file can be picked again
        }}
      />

      {value ? (
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element -- object URLs and arbitrary saved URLs, not optimisable */}
          <img src={value} alt={alt} className="aspect-video w-full rounded-control border border-line object-cover" />
          <div className="mt-3 flex items-center gap-2">
            <Button variant="secondary" size="sm" className="max-sm:h-10" onClick={() => inputRef.current?.click()}>
              Replace
            </Button>
            <Button variant="ghost" size="sm" icon={Trash2} className="max-sm:h-10" onClick={remove}>
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          {...fieldProps}
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-control border border-dashed px-4 text-center transition-colors",
            dragging ? "border-purple-500 bg-purple-50" : "border-input bg-surface-2 hover:border-purple-400",
          )}
        >
          <ImagePlus size={22} strokeWidth={1.75} aria-hidden="true" className="text-muted" />
          <span className="body-sm text-muted">{emptyLabel}</span>
        </button>
      )}

      {message && (
        <p role="alert" className="caption mt-2 text-danger">
          {message}
        </p>
      )}
    </div>
  );
}
