/**
 * IconTile: a rounded square (or circle) holding one icon, tinted by tone.
 * Used for list-row icons (36px, radius 10) and key icons on cards.
 *
 * Props:
 * - icon: a lucide-react icon component
 * - tone: accent (purple, default structure colour) | brand (orange accent) |
 *   success | warning | danger | neutral | dark (translucent, for dark surfaces)
 * - size: "sm" (36px), "md" (44px, default) or "lg" (56px, detail headers)
 * - shape: "square" (10px radius, default) or "circle" (timelines)
 * The icon is decorative (aria-hidden); put the meaning in nearby text.
 *
 * Tint pairs all keep 4.5:1+ between icon and background.
 */
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export type Tone = "brand" | "accent" | "success" | "warning" | "danger" | "neutral" | "dark";

// Tinted background + icon colour.
export const TONE_CLASSES: Record<Tone, string> = {
  brand: "bg-orange-50 text-orange-700",
  accent: "bg-purple-50 text-purple-700",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-neutral-soft text-neutral",
  dark: "bg-white/10 text-sb-text",
};

interface IconTileProps {
  icon: LucideIcon;
  tone?: Tone;
  size?: "sm" | "md" | "lg";
  shape?: "square" | "circle";
  className?: string;
}

export function IconTile({ icon: Icon, tone = "accent", size = "md", shape = "square", className }: IconTileProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        shape === "circle" ? "rounded-full" : "rounded-inset",
        size === "lg" ? "size-14" : size === "md" ? "size-11" : "size-9",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <Icon size={size === "lg" ? 26 : size === "md" ? 20 : 18} strokeWidth={1.75} />
    </span>
  );
}
