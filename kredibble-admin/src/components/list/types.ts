/**
 * Column configuration for DataTable. A list page describes its columns with
 * these specs and passes data; it never writes table markup.
 *
 * Every column has a `key`, a `header` and a `type` that decides how the cell
 * renders:
 *
 * - primary   the first column: a title that is the row's link, with an optional muted second
 *             line and an optional leading tile (an icon or a thumbnail image)
 * - text      plain muted text, optionally with a small leading icon
 * - number    a number or short figure (tabular numerals)
 * - status    a StatusBadge (status from lib/status-map.ts). On mobile the LAST status column
 *             becomes the badge in the card's title row; earlier ones are label/value pairs
 * - progress  a figure such as "46/150" with a 6px purple bar and the percentage
 * - pill      a purple-tinted pill (for example a role); a list of labels shows one pill for each
 * - custom    whatever the page renders for the cell (a rank badge); a labelled pair on phones
 *
 * `width` is an optional CSS width for the desktop table (e.g. "28%"); columns without one share
 * the rest. `mobileLabel` overrides the label shown in the stacked-card layout (default: header).
 */
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { StatusKind } from "@/lib/status-map";

interface ColumnBase {
  key: string;
  header: string;
  width?: string;
  mobileLabel?: string;
}

export type Column<T> = ColumnBase &
  (
    | {
        type: "primary";
        title: (row: T) => string;
        subtitle?: (row: T) => string | undefined;
        /** Leading 36px tile: an icon tile, or a thumbnail when `imageSrc` returns a URL. */
        leading?: (row: T) => { icon: LucideIcon; imageSrc?: string; /** "brand" = the orange entity tile (Programs, Opportunities); default is the purple structure tile. */ tone?: "accent" | "brand" } | { avatarName: string; imageSrc?: string };
      }
    | { type: "text"; value: (row: T) => string; icon?: (row: T) => LucideIcon | undefined }
    | { type: "number"; value: (row: T) => number | string }
    | {
        type: "status";
        /** Undefined shows "—" (the row has no such status, e.g. vetting on a hirer posting). */
        status: (row: T) => string | undefined;
        kind?: StatusKind;
        /** An icon shown instead of the dot for some rows (for example a flag for flagged channels). */
        icon?: (row: T) => LucideIcon | undefined;
      }
    | { type: "progress"; label: (row: T) => string; percent: (row: T) => number }
    | { type: "pill"; label: (row: T) => string | string[]; /** The full wording, shown in the shared Tooltip when the label is a short form. */ tooltip?: (row: T) => string | undefined }
    /** Anything else a cell needs (a rank badge): the page renders it. It is a labelled pair on phones. */
    | { type: "custom"; render: (row: T) => ReactNode }
  );

/** Copy for an empty table. */
export interface EmptyCopy {
  icon: LucideIcon;
  title: string;
  description?: string;
}
