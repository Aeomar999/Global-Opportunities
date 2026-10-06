"use client";

/**
 * Tabs: a row of tabs that switch between panels of one page (line style, with an optional count).
 * Idea from the 21st.dev "Tabs with Count Badge" candidates, restyled to the brand tokens.
 *
 * Structure follows the WAI-ARIA tabs pattern:
 * - role="tablist" with an aria-label, role="tab" buttons, aria-selected, aria-controls
 * - one tab stop (roving tabindex); Arrow Left/Right move AND select; Home / End jump to the ends
 * - the tab list scrolls sideways only when it must, with no scrollbar shown (overflow-y hidden). When
 *   there is more to scroll to, a soft fade shows on that edge, and the selected tab is centred
 *   in the row on load and on select. Labels and counts never wrap.
 * - the selected tab has a 2px purple underline and purple-700 text (purple marks selection, never orange)
 * - the caller renders the panel with role="tabpanel", id={tabPanelId(idPrefix, value)} and
 *   aria-labelledby={tabId(idPrefix, value)}
 *
 * Props: tabs [{ value, label, count? }], value, onChange, ariaLabel, idPrefix (unique per tab row), className
 * A count is shown in a small pill in tabular numerals.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

export const tabId = (idPrefix: string, value: string) => `${idPrefix}-tab-${value}`;
export const tabPanelId = (idPrefix: string, value: string) => `${idPrefix}-panel-${value}`;

interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface TabsProps<T extends string> {
  tabs: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  idPrefix: string;
  className?: string;
}

export function Tabs<T extends string>({ tabs, value, onChange, ariaLabel, idPrefix, className }: TabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  // Which edges have more tabs hidden beyond them (drives the fades).
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = () => {
    const el = listRef.current;
    if (!el) return;
    const start = el.scrollLeft > 1;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges((current) => (current.start === start && current.end === end ? current : { start, end }));
  };

  // Measure on mount and whenever the list or its tabs change size.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The selected tab is centred in the row on load and whenever it changes (sideways only, the page never
  // moves), so it is fully visible and never sits under an edge fade.
  const activeIndex = tabs.findIndex((tab) => tab.value === value);
  useEffect(() => {
    const list = listRef.current;
    const tab = refs.current[activeIndex];
    if (!list || !tab) return;
    const centred = tab.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2;
    list.scrollTo({ left: Math.max(0, Math.min(centred, list.scrollWidth - list.clientWidth)) });
  }, [activeIndex, tabs.length]);

  const select = (index: number) => {
    const next = (index + tabs.length) % tabs.length;
    onChange(tabs[next].value);
    refs.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const target: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: tabs.length - 1,
    };
    if (event.key in target) {
      event.preventDefault();
      select(target[event.key]);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <div
        ref={listRef}
        role="tablist"
        aria-label={ariaLabel}
        data-edge-fade="true"
        onScroll={measure}
        className={cn(
          // Horizontal scroll only on very narrow screens, with no scrollbar (arrow keys and touch still scroll).
          // overflow-y hidden + no negative margins: the underline sits INSIDE the list, so nothing overflows vertically.
          "no-scrollbar relative flex gap-1 overflow-x-auto overflow-y-hidden",
          // The 1px divider is drawn under the tabs; the selected tab's 2px underline covers it.
          "after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-line",
        )}
      >
        {tabs.map((tab, index) => {
          const selected = tab.value === value;
          return (
            <button
              key={tab.value}
              ref={(el) => {
                refs.current[index] = el;
              }}
              id={tabId(idPrefix, tab.value)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={tabPanelId(idPrefix, tab.value)}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                "button-text relative z-10 inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 transition-colors duration-150",
                selected ? "border-purple-600 text-purple-700" : "border-transparent text-muted hover:text-ink",
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={cn(
                    "caption inline-flex min-w-6 items-center justify-center whitespace-nowrap rounded-pill px-1.5 font-semibold tabular-nums",
                    selected ? "bg-purple-50 text-purple-700" : "bg-neutral-soft text-muted",
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {/* Edge fades: shown only while more tabs are hidden on that side. Decorative. */}
      <span
        aria-hidden="true"
        data-testid="tabs-fade-start"
        className={cn("pointer-events-none absolute inset-y-0 left-0 z-20 w-8 bg-linear-to-r from-canvas to-transparent transition-opacity", edges.start ? "opacity-100" : "opacity-0")}
      />
      <span
        aria-hidden="true"
        data-testid="tabs-fade-end"
        className={cn("pointer-events-none absolute inset-y-0 right-0 z-20 w-8 bg-linear-to-l from-canvas to-transparent transition-opacity", edges.end ? "opacity-100" : "opacity-0")}
      />
    </div>
  );
}
