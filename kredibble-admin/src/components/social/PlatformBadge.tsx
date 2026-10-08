"use client";

/**
 * PlatformBadge: a platform as a text badge with a tinted initial tile (a small rounded square with the first letter). No brand
 * logos: the name is always written, so the tile is only decoration. The tile's tint is fixed for each platform.
 *
 * Props: platform (a PostPlatform), highlight? (the leading platform: an orange tile instead of the platform's tint)
 */
import { cn } from "@/lib/cn";
import { POST_PLATFORM_LABELS, type PostPlatform } from "@/lib/mock-entities";

const TILE: Record<PostPlatform, string> = {
  facebook: "bg-purple-50 text-purple-700",
  instagram: "bg-orange-100 text-orange-hover",
  x: "bg-neutral-soft text-ink",
  linkedin: "bg-purple-100 text-purple-700",
  tiktok: "bg-success-soft text-success",
  youtube: "bg-danger-soft text-danger",
  whatsapp: "bg-warning-soft text-warning",
  other: "bg-surface-2 text-muted",
};

export function PlatformBadge({ platform, highlight = false }: { platform: PostPlatform; highlight?: boolean }) {
  const label = POST_PLATFORM_LABELS[platform];
  return (
    <span data-testid="platform-badge" className="inline-flex min-w-0 items-center gap-2 whitespace-nowrap">
      <span
        aria-hidden="true"
        className={cn("badge-text inline-flex size-6 shrink-0 items-center justify-center rounded-inset font-display font-bold", highlight ? "bg-orange-500 text-white" : TILE[platform])}
      >
        {label.charAt(0)}
      </span>
      <span className="table-text font-semibold text-ink">{label}</span>
    </span>
  );
}
