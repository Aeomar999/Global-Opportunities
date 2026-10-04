"use client";

/**
 * Kebab: the "three dots" icon button that opens a Menu of actions
 * (KPI cards, table rows, list items).
 *
 * Props:
 * - label: accessible name for the button, e.g. "More actions for Pending verification"
 * - items: the menu items (see Menu)
 * - align: which edge of the button the menu lines up with (default "end")
 * - defaultOpen: start open (used by the /_design review page)
 * - onDark: light-on-dark hover colours for dark surfaces
 */
import { MoreVertical } from "lucide-react";
import { cn } from "@/lib/cn";
import { Menu, type MenuItem } from "./Menu";

interface KebabProps {
  label: string;
  items: MenuItem[];
  align?: "start" | "end";
  defaultOpen?: boolean;
  onDark?: boolean;
}

export function Kebab({ label, items, align = "end", defaultOpen, onDark = false }: KebabProps) {
  return (
    <Menu
      label={label}
      items={items}
      align={align}
      defaultOpen={defaultOpen}
      triggerAriaLabel={label}
      triggerClassName={cn(
        "inline-flex size-10 items-center justify-center rounded-inset transition-colors duration-150 ease-out",
        onDark ? "text-sb-muted hover:bg-white/10 hover:text-sb-text" : "text-muted hover:bg-neutral-soft hover:text-ink",
      )}
    >
      <MoreVertical size={18} strokeWidth={1.75} aria-hidden="true" />
    </Menu>
  );
}
