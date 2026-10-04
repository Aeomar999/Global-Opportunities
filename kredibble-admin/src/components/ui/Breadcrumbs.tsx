"use client";

/**
 * Breadcrumbs: Home / Group (with a dropdown caret) / Current page [count pill].
 * Presentational for now: pages pass the trail in; nothing is derived from the
 * route yet.
 *
 * Props:
 * - items: ordered trail. Each item is { label, href?, menu?, count? }
 *   - href: makes a non-last item a link (muted, purple-700 underline on hover)
 *   - menu: MenuItem[]; adds a caret button that opens a menu of sibling pages
 *   - count: optional CountPill (usually on the last item)
 *   - loading: shows a skeleton bar instead of the label (the entity name of a detail page that is
 *     still loading; "Details" is never shown as a stand-in)
 *   The LAST item is the current page: strongest (600) and aria-current="page".
 *
 * Below 640px everything but the current page collapses to "… / Current page".
 * Separators are a light "/".
 */
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { CountPill } from "./CountPill";
import { Menu, type MenuItem } from "./Menu";
import { Skeleton } from "./Skeleton";

export interface Crumb {
  label: string;
  href?: string;
  menu?: MenuItem[];
  count?: number;
  loading?: boolean;
}

const LINK_CLASSES = "rounded-inset text-muted transition-colors duration-150 ease-out hover:text-purple-700 hover:underline";

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const lastIndex = items.length - 1;

  return (
    <nav aria-label="Breadcrumb">
      <ol className="breadcrumb flex items-center gap-2">
        {/* Mobile: the collapsed trail */}
        {items.length > 1 && (
          <li aria-hidden="true" className="flex items-center gap-2 text-muted sm:hidden">
            …<span className="text-line-strong">/</span>
          </li>
        )}

        {items.map((item, index) => {
          const isLast = index === lastIndex;
          return (
            <li key={item.label} className={cn("flex items-center gap-2", !isLast && "max-sm:hidden")}>
              {index > 0 && (
                <span aria-hidden="true" className="max-sm:hidden text-line-strong">
                  /
                </span>
              )}

              {isLast ? (
                <span aria-current="page" aria-busy={item.loading || undefined} className="flex items-center gap-2 font-semibold text-ink">
                  {item.loading ? (
                    <>
                      <Skeleton className="h-4 w-28" />
                      <span className="sr-only">Loading</span>
                    </>
                  ) : (
                    item.label
                  )}
                  {item.count !== undefined && <CountPill count={item.count} />}
                </span>
              ) : item.menu ? (
                <Menu
                  label={`Pages in ${item.label}`}
                  items={item.menu}
                  triggerClassName={cn("inline-flex h-10 items-center gap-1 px-1", LINK_CLASSES)}
                >
                  {item.label}
                  <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" />
                </Menu>
              ) : item.href ? (
                <Link href={item.href} className={cn("inline-flex h-10 items-center px-1", LINK_CLASSES)}>
                  {item.label}
                </Link>
              ) : (
                <span className="px-1 text-muted">{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
