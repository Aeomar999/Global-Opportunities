"use client";

/**
 * TableToolbar: the row between a list page's header and its table.
 * A search field on the left (where the page has search) and a SegmentedControl
 * of filters (where the page has filters), each optionally with counts.
 *
 * Props:
 * - search: { value, onChange, placeholder, label } renders a 40px search input
 * - filters: { options: [{ value, label, count? }], value, onChange, label } renders the segmented
 *   control (label = its accessible name)
 * Either or both can be given; with neither (and no children) it renders nothing.
 * - children: more controls after the filters (a second SegmentedControl, Select dropdowns...); the row wraps.
 */
import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

interface TableToolbarProps<F extends string> {
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    label: string;
  };
  filters?: {
    options: { value: F; label: string; count?: number }[];
    value: F;
    onChange: (value: F) => void;
    label: string;
  };
  children?: ReactNode;
}

export function TableToolbar<F extends string>({ search, filters, children }: TableToolbarProps<F>) {
  if (!search && !filters && !children) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {search && (
        <div className="relative w-full max-w-sm">
          <Search
            size={16}
            strokeWidth={1.75}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={search.value}
            onChange={(event) => search.onChange(event.target.value)}
            placeholder={search.placeholder}
            aria-label={search.label}
            className="input-text h-10 w-full rounded-control border border-border-input bg-surface pl-9 pr-3 text-ink placeholder:text-muted"
          />
        </div>
      )}
      {filters && (
        <SegmentedControl options={filters.options} value={filters.value} onChange={filters.onChange} ariaLabel={filters.label} />
      )}
      {children}
    </div>
  );
}
