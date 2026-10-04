/**
 * Avatar: circle with the person's initials (no photo upload exists yet).
 * The tint is picked from the name so the same person always gets the same
 * colour: purple, orange, success or warning tints from the palette.
 *
 * Props: name (required), size "sm" (32px) | "md" (40px, default) | "lg" (56px, detail headers).
 * Decorative by default: the name is expected to be shown next to it.
 */
import { cn } from "@/lib/cn";
import { TONE_CLASSES, type Tone } from "./IconTile";

const AVATAR_TONES: Tone[] = ["accent", "brand", "success", "warning"];

export const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

const AVATAR_SIZES = { sm: "size-8", md: "size-10", lg: "size-14 text-lg" } as const;

export function Avatar({ name, size = "md" }: { name: string; size?: keyof typeof AVATAR_SIZES }) {
  // Cheap stable hash: sum of char codes picks one of the tones.
  const hash = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const tone = AVATAR_TONES[hash % AVATAR_TONES.length];

  return (
    <span
      aria-hidden="true"
      className={cn(
        "badge-text inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold",
        AVATAR_SIZES[size],
        TONE_CLASSES[tone],
      )}
    >
      {getInitials(name)}
    </span>
  );
}
