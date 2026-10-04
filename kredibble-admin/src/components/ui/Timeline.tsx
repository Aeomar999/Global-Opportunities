/**
 * Timeline: vertical activity feed. Each entry has a 36px circular tinted icon
 * tile, a 1px connector line down to the next entry, a 14/20 semibold title,
 * and a 12/16 muted description and time.
 *
 * Structure idea (an ordered list with a rail between avatars) comes from the
 * 21st.dev "Activity Timeline" candidate; restyled to our tokens.
 *
 * Props:
 * - items: [{ key, icon, tone, title, description, time }]
 * Rendered as <ol> so screen readers announce "list, N items".
 */
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconTile, type Tone } from "./IconTile";

export interface TimelineItem {
  key: string;
  icon: LucideIcon;
  tone: Tone;
  title: string;
  description: string;
  time: string;
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol>
      {items.map((item, index) => (
        <li key={item.key} className="flex gap-3">
          {/* Left column: the tile, then a 1px connector that runs from the bottom of this tile to
              the top of the next one (the column stretches through the 20px gap below). */}
          <div className="flex flex-col items-center">
            <IconTile icon={item.icon} tone={item.tone} size="sm" shape="circle" />
            {index < items.length - 1 && <span aria-hidden="true" className="w-px flex-1 bg-line-strong" />}
          </div>
          <div className={cn("min-w-0 flex-1", index < items.length - 1 && "pb-5")}>
            <p className="text-sm font-semibold leading-5 text-ink">{item.title}</p>
            <p className="caption mt-1">{item.description}</p>
            <p className="caption mt-1">{item.time}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
