"use client";

/**
 * KanbanBoard: items grouped into ordered columns (a pipeline), moved from one column to another. Built for the Partners
 * pipeline but generic: it knows nothing about partners.
 *
 * Every card can be moved in THREE ways, so no one is left out:
 *   1. Drag and drop with the pointer (640px and up). Native HTML5 drag: pick up the grip, drop on a column.
 *   2. The "Move to…" menu on every card (the Menu component): a real button, reachable with Tab, opened with Enter,
 *      Space or the arrow keys, listing every OTHER column. This is the keyboard and touch way. From 640px up the button
 *      is an icon (arrows left and right, a 28px button with a 40px hit area, a tooltip "Move to…"); below 640px it keeps the words.
 *      Its name is always "Move <name> to another stage".
 *   3. On phones (below 640px) the columns become a scrollable tab strip with counts, one column's cards at a time, and
 *      the same "Move to…" menu (no drag).
 * While a card is dragged, every column that can take it is outlined, the column it came from is dimmed, and the column under
 * the pointer is filled. An empty column shows a dashed "No partners here" zone, which is a drop target like the rest.
 * Every move is announced in a polite live region ("Acme Foundation moved to Proposal"). With canMove = false (a
 * view-only role) there is no menu and no drag handle at all.
 *
 * Look: a column has its label, a count pill, an optional marker (e.g. "Closed") and a thin purple line; cards are white
 * with a 1px line border. A column is never narrower than 11rem (176px), so all six columns need 1116px of board (6 x 176px
 * plus five 12px gaps). The board is the page width minus the sidebar (248px expanded, 72px as a rail) and 56px of padding, so:
 * it FITS at 1440px and wider with the sidebar open (1136px of board) and from 1280px with the sidebar collapsed to the rail
 * (1152px); it SCROLLS at 1280px with the sidebar open (976px) and at 1024px (720px). The measured numbers are in the
 * "Partners board width" test. When it scrolls, it does so sideways inside itself (the page never scrolls sideways), a soft
 * fade shows on each edge that has more columns, and the scroller takes keyboard focus (arrow keys, Home and End scroll it).
 * Structure ideas (native drag and drop, a column drop highlight, a live region) come from the 21st.dev "Kanban Board"
 * candidates; the look and the keyboard menu are ours.
 *
 * Props:
 * - ariaLabel: names the board ("Partner pipeline")
 * - columns: [{ key, label, marker? }] in order; the keys are fixed, the labels may be edited elsewhere
 * - items, getId, getColumnKey, getName: the cards and where each one sits (getName is what is announced)
 * - renderCard(item): the content of a card (the board adds the grip and the menu)
 * - onMove(item, toKey): called after a drop or a menu choice; the page changes the data and shows a toast
 * - canMove: false hides the menu and the grip and turns dragging off
 * - itemNoun: "partners" (for the column names and the empty text)
 * - loading: shows skeleton columns
 * Test ids: kanban-column-<key>, kanban-count-<key>, kanban-card-<id>, kanban-live, kanban-grip.
 */
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { ArrowRightLeft, CheckCircle2, GripVertical } from "lucide-react";
import { cn } from "@/lib/cn";
import { useMediaQuery } from "@/lib/use-media-query";
import { Menu } from "@/components/ui/Menu";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs, tabId, tabPanelId } from "@/components/ui/Tabs";
import { Tooltip } from "@/components/ui/Tooltip";

export interface KanbanColumn {
  key: string;
  label: string;
  /** A small text shown in the column header, e.g. "Closed". */
  marker?: string;
}

interface KanbanBoardProps<T> {
  ariaLabel: string;
  columns: KanbanColumn[];
  items: readonly T[];
  getId: (item: T) => string;
  getColumnKey: (item: T) => string;
  getName: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  onMove: (item: T, toKey: string) => void;
  canMove: boolean;
  itemNoun?: string;
  loading?: boolean;
}

// Below 640px: icon and words. From 640px: the icon alone in a 40px square.
const MENU_TRIGGER =
  "relative inline-flex items-center justify-center gap-1.5 rounded-control text-sm font-semibold text-purple-700 transition-colors duration-150 ease-out hover:bg-purple-50 max-sm:h-10 max-sm:px-2 sm:size-7 sm:before:absolute sm:before:-inset-1.5 sm:before:content-['']";

export function KanbanBoard<T>({ ariaLabel, columns, items, getId, getColumnKey, getName, renderCard, onMove, canMove, itemNoun = "items", loading = false }: KanbanBoardProps<T>) {
  const phone = useMediaQuery("(max-width: 639px)");
  const [announcement, setAnnouncement] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [phoneKey, setPhoneKey] = useState(columns[0]?.key ?? "");

  // Edge fades for the sideways scroll between 640px and the width where all columns fit.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  // True while the columns are wider than the board: only then does the scroller need keyboard focus.
  const [overflowing, setOverflowing] = useState(false);
  const measure = () => {
    const el = scrollRef.current;
    if (!el) return;
    const start = el.scrollLeft > 1;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges((current) => (current.start === start && current.end === end ? current : { start, end }));
    setOverflowing(el.scrollWidth > el.clientWidth + 1);
  };
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // The scroller only exists once the board is shown (not while it loads, not on a phone), so attach then.
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [phone, loading]);

  // While a card is dragged: its column is the "source" (dimmed), every other column can accept it, and the one under the pointer is "over".
  const sourceKey = dragId ? (() => { const dragged = items.find((entry) => getId(entry) === dragId); return dragged ? getColumnKey(dragged) : null; })() : null;
  const dragState = (key: string): "idle" | "source" | "accept" | "over" =>
    !dragId || !canMove ? "idle" : key === sourceKey ? "source" : overKey === key ? "over" : "accept";

  const labelOf = (key: string) => columns.find((column) => column.key === key)?.label ?? key;
  const inColumn = (key: string) => items.filter((item) => getColumnKey(item) === key);

  const move = (item: T, toKey: string) => {
    if (getColumnKey(item) === toKey) return;
    onMove(item, toKey);
    setAnnouncement(`${getName(item)} moved to ${labelOf(toKey)}`);
  };

  const onDragStart = (event: DragEvent<HTMLLIElement>, id: string) => {
    event.dataTransfer.setData("text/plain", id);
    event.dataTransfer.effectAllowed = "move";
    setDragId(id);
  };
  const onDrop = (event: DragEvent<HTMLElement>, key: string) => {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain") || dragId;
    const item = items.find((entry) => getId(entry) === id);
    setDragId(null);
    setOverKey(null);
    if (item) move(item, key);
  };

  /** One card: the grip (drag), the content, and the "Move to…" menu. */
  const card = (item: T) => {
    const id = getId(item);
    const name = getName(item);
    const current = getColumnKey(item);
    const draggable = canMove && !phone;
    return (
      <li
        key={id}
        data-testid={`kanban-card-${id}`}
        draggable={draggable || undefined}
        onDragStart={draggable ? (event) => onDragStart(event, id) : undefined}
        onDragEnd={() => {
          setDragId(null);
          setOverKey(null);
        }}
        className={cn(
          "rounded-card border border-line bg-surface px-3 pt-3 pb-2 shadow-card transition-opacity",
          draggable && "cursor-grab active:cursor-grabbing",
          dragId === id && "opacity-50",
        )}
      >
        <div className="flex items-start gap-2">
          {draggable && <GripVertical data-testid="kanban-grip" size={16} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-muted" />}
          <div className="min-w-0 flex-1">{renderCard(item)}</div>
        </div>
        {canMove && (
          <div className="mt-1 flex justify-end">
            <Tooltip label="Move to…" placement="top" disabled={phone}>
              <Menu
                label={`Move ${name} to another stage`}
                sheetTitle={`Move ${name} to`}
                align="end"
                triggerAriaLabel={`Move ${name} to another stage`}
                triggerClassName={MENU_TRIGGER}
                items={columns.filter((column) => column.key !== current).map((column) => ({ label: column.label, onSelect: () => move(item, column.key) }))}
              >
                <ArrowRightLeft size={16} strokeWidth={1.75} aria-hidden="true" />
                {/* The words show on phones only; from 640px the icon stands alone (the name comes from the aria-label). */}
                <span className="sm:hidden">Move to…</span>
              </Menu>
            </Tooltip>
          </div>
        )}
      </li>
    );
  };

  const header = (column: KanbanColumn, count: number) => (
    <div>
      <div className="flex items-center gap-2">
        <h3 className="font-display text-sm font-bold leading-5 text-ink">{column.label}</h3>
        <span data-testid={`kanban-count-${column.key}`} className="badge-text rounded-pill bg-surface-2 px-2 py-0.5 tabular-nums text-muted" aria-label={`${count} ${itemNoun}`}>
          {count}
        </span>
        {column.marker && (
          <span data-testid={`kanban-marker-${column.key}`} className="ml-auto inline-flex items-center gap-1 rounded-pill bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">
            <CheckCircle2 size={12} strokeWidth={2} aria-hidden="true" />
            {column.marker}
          </span>
        )}
      </div>
      <div aria-hidden="true" className="mt-2 h-0.5 rounded-pill bg-purple-500" />
    </div>
  );

  if (loading) {
    return (
      <div aria-busy="true" aria-label={`${ariaLabel} (loading)`} className="grid grid-flow-col auto-cols-[minmax(11rem,1fr)] gap-3 overflow-hidden max-sm:auto-cols-[100%]">
        {columns.slice(0, phone ? 1 : columns.length).map((column) => (
          <div key={column.key} className="space-y-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ))}
      </div>
    );
  }

  const liveRegion = (
    <p role="status" aria-live="polite" data-testid="kanban-live" className="sr-only">
      {announcement}
    </p>
  );

  // Phones: a tab strip with counts and one column at a time.
  if (phone) {
    const column = columns.find((entry) => entry.key === phoneKey) ?? columns[0];
    const cards = inColumn(column.key);
    return (
      <section aria-label={ariaLabel} className="space-y-3">
        <Tabs
          ariaLabel={`${ariaLabel} stages`}
          idPrefix="kanban"
          value={column.key}
          onChange={setPhoneKey}
          tabs={columns.map((entry) => ({ value: entry.key, label: entry.label, count: inColumn(entry.key).length }))}
        />
        <div role="tabpanel" id={tabPanelId("kanban", column.key)} aria-labelledby={tabId("kanban", column.key)} data-testid={`kanban-column-${column.key}`} className="space-y-3">
          {column.marker && (
            <p data-testid={`kanban-marker-${column.key}`} className="inline-flex items-center gap-1 rounded-pill bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">
              <CheckCircle2 size={12} strokeWidth={2} aria-hidden="true" />
              {column.marker}
            </p>
          )}
          {cards.length === 0 ? <p className="caption rounded-card border border-dashed border-line px-3 py-6 text-center">No {itemNoun} in {column.label}.</p> : <ul className="space-y-3">{cards.map(card)}</ul>}
        </div>
        {liveRegion}
      </section>
    );
  }

  return (
    <section aria-label={ariaLabel} className="relative">
      <div
        ref={scrollRef}
        data-edge-fade="true"
        data-testid="kanban-scroller"
        // A scroller that overflows must be reachable and scrollable from the keyboard (arrow keys, Home, End).
        tabIndex={overflowing ? 0 : undefined}
        role={overflowing ? "group" : undefined}
        aria-label={overflowing ? `${ariaLabel} columns (scrolls sideways)` : undefined}
        onScroll={measure}
        // The arrow keys already scroll a focused scroller sideways; Home and End jump to its two ends.
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget || (event.key !== "Home" && event.key !== "End")) return;
          event.preventDefault();
          event.currentTarget.scrollTo({ left: event.key === "Home" ? 0 : event.currentTarget.scrollWidth });
        }}
        // "relative": the screen-reader-only text inside the cards is absolutely positioned; without a positioned scroller it would
        // escape the scrolling box and make the whole PAGE scroll sideways.
        className="no-scrollbar relative grid grid-flow-col auto-cols-[minmax(11rem,1fr)] gap-3 overflow-x-auto pb-2"
      >
        {columns.map((column) => {
          const cards = inColumn(column.key);
          return (
            <section
              key={column.key}
              data-testid={`kanban-column-${column.key}`}
              aria-label={`${column.label}, ${cards.length} ${itemNoun}`}
              onDragOver={canMove ? (event) => { event.preventDefault(); setOverKey(column.key); } : undefined}
              onDragLeave={canMove ? () => setOverKey((current) => (current === column.key ? null : current)) : undefined}
              onDrop={canMove ? (event) => onDrop(event, column.key) : undefined}
              data-drag-state={dragState(column.key)}
              className={cn(
                "min-w-0 rounded-card bg-surface-2/60 p-3 transition-colors",
                dragState(column.key) === "source" && "opacity-60",
                dragState(column.key) === "accept" && "outline-2 outline-dashed outline-purple-300",
                dragState(column.key) === "over" && "bg-purple-50 outline-2 outline-dashed outline-purple-500",
              )}
            >
              {header(column, cards.length)}
              {cards.length === 0 ? (
                // An empty column is still a drop target: a dashed zone says so.
                <div data-testid={`kanban-empty-${column.key}`} className="caption mt-3 flex min-h-24 items-center justify-center rounded-card border-2 border-dashed border-line px-3 text-center">
                  No {itemNoun} here
                </div>
              ) : (
                <ul className="mt-3 space-y-3">{cards.map(card)}</ul>
              )}
            </section>
          );
        })}
      </div>
      <span
        aria-hidden="true"
        data-testid="kanban-fade-start"
        className={cn("pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-linear-to-r from-canvas to-transparent transition-opacity", edges.start ? "opacity-100" : "opacity-0")}
      />
      <span
        aria-hidden="true"
        data-testid="kanban-fade-end"
        className={cn("pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-linear-to-l from-canvas to-transparent transition-opacity", edges.end ? "opacity-100" : "opacity-0")}
      />
      {liveRegion}
    </section>
  );
}
