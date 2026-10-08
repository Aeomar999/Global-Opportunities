"use client";

/**
 * Menu: an accessible dropdown menu (WAI-ARIA "menu button" pattern).
 *
 * Keyboard:
 * - Enter / Space / ArrowDown on the trigger opens it and focuses the first item
 *   (ArrowUp focuses the last)
 * - ArrowUp / ArrowDown move between items (wrapping), Home / End jump
 * - Escape closes and returns focus to the trigger
 * - Tab closes it; a click outside closes it
 * - Enter or Space on an item activates it
 *
 * Items are real links (`href`) or buttons (`onSelect`) with role="menuitem". An item with `checked` set is a
 * checkbox item (role="menuitemcheckbox", aria-checked) with a box on the left; `keepOpen` leaves the menu open
 * after it is chosen. `groupLabel` prints a small caption above that item.
 * An item with `current: true` marks the page you are on: aria-current="page",
 * font weight 600 and a check icon on the right.
 *
 * Props:
 * - label: accessible name of the menu ("Pages in Users & Companies")
 * - items: [{ label, href?, onSelect?, icon?, danger?, disabled? }]
 * - children: content of the trigger button (text, icon, caret...)
 * - triggerAriaLabel: needed when the trigger has no visible text (icon-only)
 * - triggerClassName: styling for the trigger button
 * - align: "start" (default) or "end", which edge of the trigger the panel lines up with
 * - header: plain content shown at the top of the panel, above the items (not focusable; e.g. who you are signed in as)
 * - defaultOpen: start open (used by the /_design review page)
 * - sheetTitle: the title of the phone sheet (default: label). Below 640px a menu with MORE THAN THREE items opens as a BOTTOM SHEET
 *   (role="dialog" aria-modal, a grabber, the title, a 40px close button, 48px rows, a dimmed backdrop that closes it, Tab kept
 *   inside, Esc closes and returns focus to the trigger); the menu inside it keeps role="menu" and the same keyboard. From 640px, and
 *   for a short menu on a phone, it is the popover.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Check, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { useMediaQuery } from "@/lib/use-media-query";

export interface MenuItem {
  label: string;
  href?: string;
  onSelect?: () => void;
  icon?: LucideIcon;
  danger?: boolean;
  disabled?: boolean;
  /** Marks the current page: check icon on the right, weight 600, aria-current="page". */
  current?: boolean;
  /** Makes this a checkbox item. */
  checked?: boolean;
  /** Do not close the menu when this item is chosen (checkbox lists). */
  keepOpen?: boolean;
  /** A small caption shown above this item. */
  groupLabel?: string;
}

interface MenuProps {
  label: string;
  items: MenuItem[];
  children: ReactNode;
  triggerAriaLabel?: string;
  triggerClassName?: string;
  align?: "start" | "end";
  header?: ReactNode;
  defaultOpen?: boolean;
  sheetTitle?: string;
}

const ITEM_CLASSES =
  "body-sm flex h-10 w-full items-center gap-2 rounded-inset px-3 text-left transition-colors duration-150 ease-out";

export function Menu({
  label,
  items,
  children,
  triggerAriaLabel,
  triggerClassName,
  align = "start",
  header,
  defaultOpen = false,
  sheetTitle,
}: MenuProps) {
  const menuId = useId();
  const titleId = useId();
  const phone = useMediaQuery("(max-width: 639px)");
  const asSheet = phone && items.length > 3;
  const sheetRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(defaultOpen);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  // Which item to focus once the panel has rendered: set when the USER opens it,
  // so a menu that starts open (defaultOpen) does not steal focus on page load.
  const focusOnOpen = useRef<"first" | "last" | null>(null);

  const enabledIndexes = items.flatMap((item, i) => (item.disabled ? [] : [i]));

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  // Move focus into the panel after it opens.
  useEffect(() => {
    if (!open || !focusOnOpen.current) return;
    const target = focusOnOpen.current === "first" ? enabledIndexes[0] : enabledIndexes[enabledIndexes.length - 1];
    itemRefs.current[target]?.focus();
    focusOnOpen.current = null;
  });

  // Close on outside click (the sheet has its own backdrop).
  useEffect(() => {
    if (!open || asSheet) return;
    const onPointer = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open, asSheet]);

  const onTriggerKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusOnOpen.current = event.key === "ArrowDown" ? "first" : "last";
      setOpen(true);
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent) => {
    const current = itemRefs.current.findIndex((el) => el === document.activeElement);
    const position = enabledIndexes.indexOf(current);
    const focusAt = (p: number) => itemRefs.current[enabledIndexes[(p + enabledIndexes.length) % enabledIndexes.length]]?.focus();

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusAt(position + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusAt(position - 1);
        break;
      case "Home":
        event.preventDefault();
        focusAt(0);
        break;
      case "End":
        event.preventDefault();
        focusAt(enabledIndexes.length - 1);
        break;
      case "Escape":
        event.preventDefault();
        close(true);
        break;
      case "Tab":
        if (!asSheet) setOpen(false); // let focus move on naturally (in the sheet Tab is kept inside it)
        break;
    }
  };

  // In the sheet: Esc closes (and returns focus to the trigger); Tab and Shift+Tab cycle between the close button and the items.
  const onSheetKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "Tab") {
      const focusables = Array.from(sheetRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]") ?? []);
      if (focusables.length === 0) return;
      const at = focusables.indexOf(document.activeElement as HTMLElement);
      const next = at < 0 ? 0 : (at + (event.shiftKey ? -1 : 1) + focusables.length) % focusables.length;
      event.preventDefault();
      focusables[next].focus();
    }
  };

  const select = (item: MenuItem) => {
    item.onSelect?.();
    if (!item.keepOpen) close(!item.href); // a link navigates away, so only return focus for button items
  };

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={triggerAriaLabel}
        onClick={() => {
          focusOnOpen.current = open ? null : "first";
          setOpen((v) => !v);
        }}
        onKeyDown={onTriggerKeyDown}
        className={triggerClassName}
      >
        {children}
      </button>

      {open && !asSheet && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className={cn(
            "absolute top-full z-50 mt-2 max-h-[70vh] min-w-48 overflow-y-auto rounded-card border border-line bg-surface p-1 shadow-pop",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {header && <div role="presentation">{header}</div>}
          {items.map((item, index) => {
            const Icon = item.icon;
            const classes = cn(
              ITEM_CLASSES,
              asSheet && "h-12",
              item.danger ? "text-danger hover:bg-danger-soft" : "text-ink hover:bg-surface-2",
              item.current && "font-semibold",
              item.disabled && "cursor-not-allowed text-muted hover:bg-transparent",
            );
            const content = (
              <>
                {item.checked !== undefined && (
                  <span aria-hidden="true" className={cn("flex size-4 shrink-0 items-center justify-center rounded-inset border", item.checked ? "border-purple-600 bg-purple-600 text-white" : "border-input")}>
                    {item.checked && <Check size={12} strokeWidth={3} />}
                  </span>
                )}
                {Icon && <Icon size={16} strokeWidth={1.75} aria-hidden="true" />}
                <span className="flex-1">{item.label}</span>
                {item.current && <Check size={16} strokeWidth={2} aria-hidden="true" className="shrink-0 text-purple-700" />}
              </>
            );

            const element = item.href && !item.disabled ? (
              <Link
                key={item.label}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                href={item.href}
                role="menuitem"
                aria-current={item.current ? "page" : undefined}
                tabIndex={-1}
                onClick={() => select(item)}
                onKeyDown={(e) => e.key === " " && (e.preventDefault(), e.currentTarget.click())}
                className={classes}
              >
                {content}
              </Link>
            ) : (
              <button
                key={item.label}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                role={item.checked !== undefined ? "menuitemcheckbox" : "menuitem"}
                aria-checked={item.checked}
                aria-current={item.current ? "page" : undefined}
                tabIndex={-1}
                disabled={item.disabled}
                aria-disabled={item.disabled || undefined}
                onClick={() => select(item)}
                className={classes}
              >
                {content}
              </button>
            );

            return item.groupLabel ? (
              <div key={item.label}>
                <p role="presentation" className="caption px-3 pb-1 pt-3">
                  {item.groupLabel}
                </p>
                {element}
              </div>
            ) : (
              element
            );
          })}
        </div>
      )}

      {open && asSheet && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-80" onKeyDown={onSheetKeyDown}>
            {/* Dimmed backdrop: tap to close. */}
            <div aria-hidden="true" data-testid="menu-sheet-backdrop" onClick={() => close(true)} className="absolute inset-0 bg-ink/40" />
            <div
              ref={sheetRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="sheet-enter absolute inset-x-0 bottom-0 max-h-[85vh] overflow-auto rounded-t-[20px] bg-surface pb-[env(safe-area-inset-bottom)] shadow-pop"
            >
              <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 rounded-pill bg-line-strong" />
              <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-2">
                <h2 id={titleId} className="card-title">
                  {sheetTitle ?? label}
                </h2>
                <button
                  type="button"
                  onClick={() => close(true)}
                  aria-label="Close"
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-inset text-muted transition-colors hover:bg-neutral-soft hover:text-ink"
                >
                  <X size={20} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </div>
              <div id={menuId} role="menu" aria-label={label} onKeyDown={onMenuKeyDown} className="space-y-0.5 px-2 pb-3">
                {header && <div role="presentation">{header}</div>}
          {items.map((item, index) => {
            const Icon = item.icon;
            const classes = cn(
              ITEM_CLASSES,
              asSheet && "h-12",
              item.danger ? "text-danger hover:bg-danger-soft" : "text-ink hover:bg-surface-2",
              item.current && "font-semibold",
              item.disabled && "cursor-not-allowed text-muted hover:bg-transparent",
            );
            const content = (
              <>
                {item.checked !== undefined && (
                  <span aria-hidden="true" className={cn("flex size-4 shrink-0 items-center justify-center rounded-inset border", item.checked ? "border-purple-600 bg-purple-600 text-white" : "border-input")}>
                    {item.checked && <Check size={12} strokeWidth={3} />}
                  </span>
                )}
                {Icon && <Icon size={16} strokeWidth={1.75} aria-hidden="true" />}
                <span className="flex-1">{item.label}</span>
                {item.current && <Check size={16} strokeWidth={2} aria-hidden="true" className="shrink-0 text-purple-700" />}
              </>
            );

            const element = item.href && !item.disabled ? (
              <Link
                key={item.label}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                href={item.href}
                role="menuitem"
                aria-current={item.current ? "page" : undefined}
                tabIndex={-1}
                onClick={() => select(item)}
                onKeyDown={(e) => e.key === " " && (e.preventDefault(), e.currentTarget.click())}
                className={classes}
              >
                {content}
              </Link>
            ) : (
              <button
                key={item.label}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                role={item.checked !== undefined ? "menuitemcheckbox" : "menuitem"}
                aria-checked={item.checked}
                aria-current={item.current ? "page" : undefined}
                tabIndex={-1}
                disabled={item.disabled}
                aria-disabled={item.disabled || undefined}
                onClick={() => select(item)}
                className={classes}
              >
                {content}
              </button>
            );

            return item.groupLabel ? (
              <div key={item.label}>
                <p role="presentation" className="caption px-3 pb-1 pt-3">
                  {item.groupLabel}
                </p>
                {element}
              </div>
            ) : (
              element
            );
          })}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
