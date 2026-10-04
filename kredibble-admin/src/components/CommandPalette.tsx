"use client";

/**
 * CommandPalette: the Cmd/Ctrl+K page finder.
 * A modal dialog listing every page from NAV_GROUPS. Type to filter, Arrow
 * Up/Down move the highlight, Enter opens the page, Esc closes. Focus goes to
 * the input on open, stays inside the dialog while it is open, and returns to
 * whatever had it before when it closes.
 *
 * There is no content search endpoint yet, so it searches page names and
 * group names only.
 *
 * ARIA: role="dialog" aria-modal, the input is a combobox controlling a
 * listbox, and the highlighted option is exposed with aria-activedescendant.
 *
 * Props:
 * - open: show the palette (it unmounts when closed, so its state resets)
 * - onClose: called on Esc, on a click outside, and after a page is opened
 * - counts: known counts, shown as pills next to the matching pages
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { useRoles } from "@/components/access/RoleProvider";
import { visibleNavGroups } from "@/lib/nav";
import type { NavCounts } from "@/lib/services/nav-counts";
import { CountPill } from "@/components/ui/CountPill";
import { IconTile } from "@/components/ui/IconTile";
import { Kbd } from "@/components/ui/Kbd";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  counts: NavCounts;
}

export function CommandPalette({ open, onClose, counts }: CommandPaletteProps) {
  return open ? <PaletteDialog onClose={onClose} counts={counts} /> : null;
}

function PaletteDialog({ onClose, counts }: { onClose: () => void; counts: NavCounts }) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  // Every page the current roles can view, with its group, flattened for searching.
  const { can } = useRoles();
  const results = useMemo(() => {
    const pages = visibleNavGroups(can).flatMap((group) => group.children.map((child) => ({ ...child, group: group.group })));
    const q = query.trim().toLowerCase();
    return q ? pages.filter((page) => `${page.label} ${page.group}`.toLowerCase().includes(q)) : pages;
  }, [query, can]);

  // Focus the input on open; give focus back to the previous element on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => previous?.focus();
  }, []);

  const openPage = (href: string) => {
    onClose();
    router.push(href);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setHighlight((h) => Math.min(h + 1, results.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
        break;
      case "Enter":
        event.preventDefault();
        if (results[highlight]) openPage(results[highlight].href);
        break;
      case "Escape":
        event.preventDefault();
        onClose();
        break;
      case "Tab":
        event.preventDefault(); // keep focus inside the dialog: the input is its only control
        break;
    }
  };

  return (
    <div
      className="fixed inset-0 z-60 flex items-start justify-center bg-ink/40 px-4 pt-24"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={onKeyDown}
        className="w-full max-w-xl overflow-hidden rounded-card border border-line bg-surface shadow-pop"
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-muted" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results[highlight] ? `${listId}-${highlight}` : undefined}
            aria-autocomplete="list"
            aria-label="Search pages"
            placeholder="Search pages"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setHighlight(0);
            }}
            className="input-text h-12 flex-1 bg-transparent text-ink outline-none placeholder:text-muted"
          />
          <Kbd>Esc</Kbd>
        </div>

        <ul id={listId} role="listbox" aria-label="Pages" className="max-h-96 overflow-y-auto p-2">
          {results.length === 0 ? (
            <li role="presentation" className="body-sm px-3 py-6 text-center text-muted">
              No pages match &ldquo;{query}&rdquo;
            </li>
          ) : (
            results.map((page, index) => {
              const count = page.countKey ? counts[page.countKey] : undefined;
              return (
                <li
                  key={page.href}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === highlight}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    openPage(page.href);
                  }}
                  onMouseMove={() => setHighlight(index)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-inset px-3 py-2",
                    index === highlight ? "bg-purple-50" : "bg-transparent",
                  )}
                >
                  <IconTile icon={page.icon} tone="accent" size="sm" />
                  <span className="body-sm flex-1 font-semibold text-ink">{page.label}</span>
                  {count !== undefined && count > 0 && <CountPill count={count} label="pending" />}
                  <span className="caption">{page.group}</span>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
