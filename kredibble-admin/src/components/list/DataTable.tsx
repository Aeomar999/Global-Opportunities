"use client";

/**
 * DataTable: the table card used by every list page (design brief, section 7).
 *
 * Desktop (640px and up)
 * - A card holding a real <table>: a surface-2 header band (36px, 10px radius) and 56px rows with
 *   a 1px divider and a surface-2 hover.
 * - Every row is a real link: the first (primary) cell holds the <a>, stretched over the whole
 *   row, with a chevron at the end. Keyboard users tab to it and see a focus ring around the row.
 * - A footer inside the card: "Showing 1-5 of 5" with Previous / Next (disabled when there is
 *   only one page).
 *
 * Below 640px each row becomes a stacked card: the title and the status badge on top, then
 * "Label  value" pairs. The header band is hidden visually (kept for screen readers).
 *
 * States (same card, same row height, so nothing jumps)
 * - loading: the header band plus skeleton rows
 * - error: an inline message with "Try again"
 * - empty: two different messages: `emptyNoData` when there is nothing at all, `emptyNoResults`
 *   when a search or filter matched nothing (decided by `isFiltered`)
 *
 * Props:
 * - columns: Column config (see ./types)
 * - rows: the rows to show (already searched / filtered by the page)
 * - getRowKey / getRowHref: stable key and detail link of a row
 * - label: accessible name of the table
 * - isFiltered: true when a search or filter is active (selects the empty message)
 * - emptyNoData / emptyNoResults: copy for the two empty states
 * - loading / error / onRetry: load state (from useListData)
 * - resetKey: change it (e.g. the filter + query) to go back to page 1
 * - pageSize: rows per page (default 10)
 */
import { useState } from "react";
import { AlertTriangle, ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { CSSProperties } from "react";
import { TagPill } from "@/components/ui/TagPill";
import { TruncatedLink, TruncatedText } from "@/components/ui/TruncatedText";
import type { Column, EmptyCopy } from "./types";

const SKELETON_ROWS = 5;
const DEFAULT_PAGE_SIZE = 10;

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  getRowHref: (row: T) => string;
  label: string;
  isFiltered?: boolean;
  emptyNoData: EmptyCopy;
  emptyNoResults: EmptyCopy;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  resetKey?: string;
  pageSize?: number;
}

// Narrowest a progress column may get: the 180px cell plus its 12px side padding.
const PROGRESS_MIN_PX = 204;

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  getRowHref,
  label,
  isFiltered = false,
  emptyNoData,
  emptyNoResults,
  loading = false,
  error = null,
  onRetry,
  resetKey = "",
  pageSize = DEFAULT_PAGE_SIZE,
}: DataTableProps<T>) {
  // Page state that resets to 1 whenever resetKey changes (derived-state pattern, no effect).
  const [pager, setPager] = useState({ key: resetKey, page: 1 });
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = pager.key !== resetKey ? 1 : Math.min(pager.page, pageCount);
  if (pager.key !== resetKey) setPager({ key: resetKey, page: 1 });

  const start = (page - 1) * pageSize;
  const visibleRows = rows.slice(start, start + pageSize);
  const lastStatusKey = [...columns].reverse().find((column) => column.type === "status")?.key;

  const showRows = !loading && !error && rows.length > 0;
  const message = error
    ? null
    : loading
      ? null
      : rows.length === 0
        ? isFiltered
          ? emptyNoResults
          : emptyNoData
        : null;

  // A progress column is a percentage of the table, so the table keeps a minimum width that
  // leaves that column at least PROGRESS_MIN_PX wide (cell padding included).
  const progressColumn = columns.find((column) => column.type === "progress" && column.width?.endsWith("%"));
  const tableMinWidth = progressColumn
    ? Math.ceil(PROGRESS_MIN_PX / (parseFloat(progressColumn.width as string) / 100))
    : undefined;

  return (
    <Card flush as="section" ariaLabel={label}>
      {/* From 640px up, a table too narrow for its progress column scrolls sideways INSIDE the card, never the page. */}
      <div className="overflow-x-auto p-3 pb-0 max-sm:overflow-visible">
        <table
          // The minimum width belongs to the TABLE layout only (640px and up). The stacked cards below 640px have none.
          className="w-full table-fixed text-left sm:min-w-(--table-min) max-sm:block"
          style={tableMinWidth ? ({ "--table-min": `${tableMinWidth}px` } as CSSProperties) : undefined}
          aria-label={label}
          aria-busy={loading || undefined}
        >
          <colgroup className="max-sm:hidden">
            {columns.map((column) => (
              <col key={column.key} style={column.width ? { width: column.width } : undefined} />
            ))}
            <col className="w-10" />
          </colgroup>

          {/* Header band: 36px, surface-2, 10px radius. Hidden visually on mobile, still read by screen readers. */}
          <thead className="max-sm:sr-only">
            <tr className="bg-surface-2">
              {columns.map((column, index) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "table-head h-9 px-3 font-semibold",
                    index === 0 && "rounded-l-inset",
                  )}
                >
                  {column.header}
                </th>
              ))}
              <th scope="col" className="h-9 rounded-r-inset">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>

          <tbody className="max-sm:block">
            {loading &&
              Array.from({ length: SKELETON_ROWS }, (_, i) => (
                <tr key={i} className="border-b border-line last:border-b-0 max-sm:block max-sm:py-4">
                  {columns.map((column) => (
                    <td key={column.key} className="h-14 px-3 max-sm:flex max-sm:h-auto max-sm:px-0 max-sm:py-1">
                      <Skeleton className="h-4 w-3/4" />
                    </td>
                  ))}
                  <td className="max-sm:hidden" />
                </tr>
              ))}

            {showRows &&
              visibleRows.map((row) => (
                <tr
                  key={getRowKey(row)}
                  data-testid="table-row"
                  className={cn(
                    "relative border-b border-line transition-colors duration-150 ease-out last:border-b-0 hover:bg-surface-2",
                    // Mobile: a two-column card (title | badge) with label/value pairs below. Cards are separated by flat
                    // full-width lines (the border-b above); no rounded corners, so the line has no curved end-caps.
                    "max-sm:grid max-sm:grid-cols-[1fr_auto] max-sm:items-center max-sm:gap-x-3 max-sm:gap-y-2 max-sm:px-3 max-sm:py-4",
                  )}
                >
                  {columns.map((column) => (
                    <Cell
                      key={column.key}
                      column={column}
                      row={row}
                      href={getRowHref(row)}
                      isBadgeColumn={column.key === lastStatusKey}
                    />
                  ))}
                  <td className="w-10 pr-3 text-right max-sm:hidden" aria-hidden="true">
                    <ChevronRight size={18} strokeWidth={1.75} className="ml-auto text-muted" />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>

        {error && (
          <EmptyState
            icon={AlertTriangle}
            tone="danger"
            title="Could not load this list"
            description={error}
            action={
              onRetry && (
                <Button variant="secondary" onClick={onRetry}>
                  Try again
                </Button>
              )
            }
          />
        )}
        {message && <EmptyState icon={message.icon} title={message.title} description={message.description} />}
      </div>

      {/* Footer: "Showing 1-5 of 5" and Previous / Next (disabled for a single page) */}
      <footer className="mt-3 flex items-center justify-between gap-3 border-t border-line px-5 py-3">
        <p className="caption" aria-live="polite">
          {showRows
            ? `Showing ${start + 1}-${start + visibleRows.length} of ${rows.length}`
            : loading
              ? "Loading…"
              : "Showing 0 of 0"}
        </p>
        {/* Previous / Next only exist when there is more than one page; "Showing 1-5 of 5" always stays. */}
        {pageCount > 1 && (
          <nav aria-label="Pagination" className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!showRows || page <= 1}
              onClick={() => setPager({ key: resetKey, page: page - 1 })}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!showRows || page >= pageCount}
              onClick={() => setPager({ key: resetKey, page: page + 1 })}
            >
              Next
            </Button>
          </nav>
        )}
      </footer>
    </Card>
  );
}

/** The small leading icon of a text cell (a component prop, so it is not "created during render"). */
function TextIcon({ icon: Icon }: { icon?: LucideIcon }) {
  return Icon ? <Icon size={14} strokeWidth={1.75} aria-hidden="true" className="shrink-0" /> : null;
}

interface CellProps<T> {
  column: Column<T>;
  row: T;
  href: string;
  isBadgeColumn: boolean;
}

/** Renders one cell from its column spec. */
function Cell<T>({ column, row, href, isBadgeColumn }: CellProps<T>) {
  // Common cell box: 56px tall on desktop; on mobile a labelled line (or the card's title / badge).
  const base = "h-14 px-3 align-middle max-sm:min-w-0";
  // Phones: text wraps (never an ellipsis); a value sits at the right of its row and its lines stay left-aligned.
  const wrapOnPhone = "max-sm:overflow-visible max-sm:whitespace-normal max-sm:break-words max-sm:text-clip";
  const labelled =
    "max-sm:col-span-2 max-sm:flex max-sm:h-auto max-sm:items-center max-sm:justify-between max-sm:gap-4 max-sm:px-0 " +
    "max-sm:before:text-xs max-sm:before:font-semibold max-sm:before:text-muted max-sm:before:content-[attr(data-label)]";
  const label = column.mobileLabel ?? column.header;

  switch (column.type) {
    case "primary": {
      const leading = column.leading?.(row);
      const subtitle = column.subtitle?.(row);
      return (
        <td className={cn(base, "max-sm:col-span-1 max-sm:h-auto max-sm:px-0")}>
          <div className="flex min-w-0 items-center gap-3">
            {leading &&
              (leading.imageSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={leading.imageSrc} alt="" className="size-9 shrink-0 rounded-inset object-cover" />
              ) : (
                <IconTile icon={leading.icon} tone={leading.tone ?? "accent"} size="sm" />
              ))}
            <div className="min-w-0">
              {/* Stretched link: its ::after covers the whole row (the <tr> is relative). When the title
                  is cut off it also gets a title attribute and a tooltip (hover and focus). */}
              <TruncatedLink
                href={href}
                text={column.title(row)}
                className={cn(
                  wrapOnPhone,
                  "table-text rounded-inset font-semibold text-ink outline-none after:absolute after:inset-0 after:rounded-inset",
                  "focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus",
                )}
              />
              {subtitle && <TruncatedText text={subtitle} className={cn("caption", wrapOnPhone)} />}
            </div>
          </div>
        </td>
      );
    }
    case "text": {
      return (
        <td className={cn(base, "table-text text-muted", labelled)} data-label={label}>
          <span className="flex min-w-0 items-center gap-2 max-sm:justify-end max-sm:text-left max-sm:text-ink">
            <TextIcon icon={column.icon?.(row)} />
            <TruncatedText text={column.value(row)} className={wrapOnPhone} />
          </span>
        </td>
      );
    }
    case "number":
      return (
        <td className={cn(base, "table-text text-muted", labelled)} data-label={label}>
          <span className="max-sm:text-left max-sm:text-ink">{column.value(row)}</span>
        </td>
      );
    case "status":
      return (
        <td
          className={cn(
            base,
            // The last status column is the card's badge (top right on mobile); others are labelled pairs.
            isBadgeColumn ? "max-sm:col-span-1 max-sm:col-start-2 max-sm:row-start-1 max-sm:h-auto max-sm:px-0" : labelled,
          )}
          data-label={label}
        >
          {column.status(row) ? (
            <StatusBadge status={column.status(row) as string} kind={column.kind} icon={column.icon?.(row)} />
          ) : (
            <span className="table-text text-muted max-sm:text-ink" aria-label="Not applicable">
              —
            </span>
          )}
        </td>
      );
    case "progress": {
      const percent = Math.min(100, Math.max(0, column.percent(row)));
      return (
        // Phones: "Label   figure  pct" on one line, then the full-width bar under it.
        <td className={cn(base, labelled, "max-sm:flex-wrap max-sm:gap-y-1.5")} data-label={label}>
          {/* Table: sizes to its content (never truncated), at least 180px, the bar spans the cell.
              Phones: the wrapper dissolves so the figure line and the bar become rows of the card. */}
          <div className="w-max min-w-45 max-w-full max-sm:contents">
            <div className="table-text flex items-baseline justify-between gap-3 whitespace-nowrap max-sm:ml-auto">
              <span className="text-ink">{column.label(row)}</span>
              <span className="font-semibold tabular-nums text-ink">{percent}%</span>
            </div>
            <div
              role="progressbar"
              aria-label={`${column.header}: ${percent}%`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="mt-1 h-1.5 overflow-hidden rounded-pill bg-track max-sm:mt-0 max-sm:w-full max-sm:basis-full"
            >
              {/* Data-driven width: the one legitimate inline style. */}
              <div className="h-full rounded-pill bg-purple-500" style={{ width: `${percent}%` }} />
            </div>
          </div>
        </td>
      );
    }
    case "pill":
      return (
        <td className={cn(base, labelled)} data-label={label}>
          <div className="flex flex-wrap gap-1.5 max-sm:justify-end">
            {[column.label(row)].flat().map((text) => (
              <TagPill key={text}>{text}</TagPill>
            ))}
          </div>
        </td>
      );
  }
}
