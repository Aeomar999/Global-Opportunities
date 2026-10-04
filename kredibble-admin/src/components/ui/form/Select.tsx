"use client";

/**
 * Select: a single-choice dropdown whose options can carry a one-line description
 * ("Moderator: reviews reports and removes content") or a small badge ("Current"). A native <select> cannot
 * show those and its open list is drawn by the browser (system colours, square corners), so this follows the
 * WAI-ARIA "select-only combobox" pattern: a button (role="combobox") that opens a listbox. It is the ONE
 * dropdown of the app (Role field, month selector).
 *
 * Desktop and tablet (640px and up): a dropdown panel under the trigger
 * - white, 12px radius, 1px line border, the menu shadow, a 4px gap, as wide as the trigger (200px at least),
 *   max 320px tall with its own scroll (shorter when the room is smaller); it flips ABOVE the trigger when
 *   there is more room there
 * - the page behind does not scroll while it is open
 * - focus stays on the trigger; the highlighted option is aria-activedescendant
 *
 * Phones (below 640px), when `sheetTitle` is given: the same options in a BOTTOM SHEET
 * - role="dialog" aria-modal pinned to the bottom, 20px top radius, a grabber, the title, a 40px close button,
 *   48px rows, a dimmed backdrop (tap to close), safe-area padding, slides up in 200ms (not with reduced motion)
 * - focus moves into the sheet and is trapped there (Tab cycles between the close button and the list)
 *
 * Keyboard (both): Arrow Up / Down, Home, End move the highlight; Enter / Space choose it; Esc closes and returns
 * focus to the trigger; typing a letter jumps to the next option that starts with it. A click outside closes
 * the dropdown. The chosen option has purple text, semibold weight and a check mark on the right.
 *
 * Props: options [{ value, label, description?, badge? }], value, onChange(value), placeholder?, onBlur?,
 *        icon? (shown before the label), className? (the wrapper: use "w-fit" for an inline trigger),
 *        ariaLabel? (the name when there is no surrounding <Field>), sheetTitle? (turns on the phone sheet)
 * Put it inside a <Field> so the label, helper and error are connected.
 */
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { useMediaQuery } from "@/lib/use-media-query";
import { CONTROL_CLASSES, useFieldControlProps } from "./Field";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  /** A small muted word shown after the label ("Current"). */
  badge?: string;
}

interface SelectProps<T extends string> {
  options: SelectOption<T>[];
  value: T | "";
  onChange: (value: T) => void;
  placeholder?: string;
  onBlur?: () => void;
  icon?: LucideIcon;
  className?: string;
  ariaLabel?: string;
  sheetTitle?: string;
}

const PANEL_MAX_HEIGHT_PX = 320;
const ROW_PX = 40;
const ROW_WITH_DESCRIPTION_PX = 56;

/** Stops the page behind from scrolling while `locked` (keeps the layout width, so nothing jumps). */
function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const { overflow, paddingRight } = document.body.style;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    return () => {
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
    };
  }, [locked]);
}

export function Select<T extends string>({
  options,
  value,
  onChange,
  placeholder = "Choose an option",
  onBlur,
  icon: Icon,
  className,
  ariaLabel,
  sheetTitle,
}: SelectProps<T>) {
  const fieldProps = useFieldControlProps();
  const listId = useId();
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetListRef = useRef<HTMLUListElement>(null);
  const sheetCloseRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [placement, setPlacement] = useState<"down" | "up">("down");
  // The panel never grows past 320px, nor past the room on its side of the trigger (it then scrolls).
  const [panelMax, setPanelMax] = useState(PANEL_MAX_HEIGHT_PX);

  const isPhone = useMediaQuery("(max-width: 639px)");
  const asSheet = isPhone && !!sheetTitle;

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;
  const optionId = (index: number) => `${listId}-option-${index}`;

  useScrollLock(open);

  const openList = () => {
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    // Flip upward when the list would not fit below the trigger but there is more room above.
    const box = rootRef.current?.getBoundingClientRect();
    if (box) {
      const rowHeight = options.some((option) => option.description) ? ROW_WITH_DESCRIPTION_PX : ROW_PX;
      const needed = Math.min(PANEL_MAX_HEIGHT_PX, options.length * rowHeight + 8) + 4;
      const below = window.innerHeight - box.bottom;
      const above = box.top;
      const up = below < needed && above > below;
      setPlacement(up ? "up" : "down");
      setPanelMax(Math.max(ROW_PX * 2, Math.min(PANEL_MAX_HEIGHT_PX, (up ? above : below) - 12)));
    }
    setOpen(true);
  };

  /** Close and hand focus back to the trigger. */
  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const choose = (index: number) => {
    onChange(options[index].value);
    close();
  };

  // Dropdown only: a click anywhere outside closes the list (the sheet has its own backdrop).
  useEffect(() => {
    if (!open || asSheet) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, asSheet]);

  // Sheet only: move focus into the sheet when it opens.
  useEffect(() => {
    if (open && asSheet) sheetListRef.current?.focus();
  }, [open, asSheet]);

  /** The keys shared by the dropdown and the sheet. Returns true when the key was handled. */
  const handleListKey = (event: KeyboardEvent): boolean => {
    switch (event.key) {
      case "ArrowDown":
        setActive((index) => Math.min(options.length - 1, index + 1));
        return true;
      case "ArrowUp":
        setActive((index) => Math.max(0, index - 1));
        return true;
      case "Home":
        setActive(0);
        return true;
      case "End":
        setActive(options.length - 1);
        return true;
      case "Enter":
      case " ":
        choose(active);
        return true;
      case "Escape":
        event.stopPropagation(); // do not also close a surrounding dialog
        close();
        return true;
      default:
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
          const letter = event.key.toLowerCase();
          const ordered = [...options.keys()];
          const next = [...ordered.slice(active + 1), ...ordered.slice(0, active + 1)].find((index) =>
            options[index].label.toLowerCase().startsWith(letter),
          );
          if (next !== undefined) setActive(next);
          return true;
        }
        return false;
    }
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    if (handleListKey(event)) event.preventDefault();
  };

  /** Sheet: list keys, plus Tab kept inside (close button <-> list). */
  const onSheetKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Tab") {
      event.preventDefault();
      const onList = document.activeElement === sheetListRef.current;
      (onList ? sheetCloseRef.current : sheetListRef.current)?.focus();
      return;
    }
    if (event.target === sheetCloseRef.current && event.key !== "Escape") return; // Enter / Space press the close button
    if (handleListKey(event)) event.preventDefault();
  };

  /** The option rows. `rowClass` gives a row its height: 40px in the dropdown (taller with a description), 48px in the sheet. */
  const renderOptions = (rowClass: (option: SelectOption<T>) => string) =>
    options.map((option, index) => {
      const isSelected = option.value === value;
      return (
        <li
          key={option.value}
          id={optionId(index)}
          role="option"
          aria-selected={isSelected}
          onPointerEnter={() => setActive(index)}
          // Dropdown: mousedown (not click) so the trigger keeps focus and blur does not fire first.
          onMouseDown={
            asSheet
              ? undefined
              : (event) => {
                  event.preventDefault();
                  choose(index);
                }
          }
          onClick={asSheet ? () => choose(index) : undefined}
          className={cn("flex cursor-pointer items-center gap-3 rounded-inset px-3", rowClass(option), index === active ? "bg-purple-50" : "bg-transparent")}
        >
          <span className="min-w-0 flex-1">
            <span className={cn("input-text block", isSelected ? "font-semibold text-purple-700" : "font-medium text-ink")}>{option.label}</span>
            {option.description && <span className="caption block">{option.description}</span>}
          </span>
          {option.badge && <span className="caption shrink-0">{option.badge}</span>}
          {isSelected && <Check size={16} strokeWidth={2.25} aria-hidden="true" className="shrink-0 text-purple-700" />}
        </li>
      );
    });

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        {...fieldProps}
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label={fieldProps.id ? undefined : ariaLabel}
        aria-haspopup={asSheet ? "dialog" : "listbox"}
        aria-expanded={open}
        aria-controls={open ? (asSheet ? undefined : listId) : undefined}
        aria-activedescendant={open && !asSheet ? optionId(active) : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onTriggerKeyDown}
        onBlur={onBlur}
        className={cn(CONTROL_CLASSES, "flex h-10 items-center gap-2 text-left", Icon ? "pl-3" : "")}
      >
        {Icon && <Icon size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-muted" />}
        <span className={cn("min-w-0 flex-1 truncate", !selected && "text-muted")}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={16} strokeWidth={2} aria-hidden="true" className={cn("shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && !asSheet && (
        <ul
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          className={cn(
            "absolute left-0 z-30 w-full min-w-50 overflow-auto rounded-control border border-line bg-surface p-1 shadow-pop",
            placement === "down" ? "top-full mt-1" : "bottom-full mb-1",
          )}
          // Data-driven cap: 320px from the brief, less when the room on this side is smaller; it scrolls inside.
          style={{ maxHeight: panelMax }}
        >
          {renderOptions((option) => (option.description ? "py-2" : "h-10"))}
        </ul>
      )}

      {open && asSheet && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-80" onKeyDown={onSheetKeyDown}>
            {/* Dimmed backdrop: tap to close. */}
            <div aria-hidden="true" data-testid="select-sheet-backdrop" onClick={close} className="absolute inset-0 bg-ink/40" />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="sheet-enter absolute inset-x-0 bottom-0 max-h-[85vh] overflow-auto rounded-t-[20px] bg-surface pb-[env(safe-area-inset-bottom)] shadow-pop"
            >
              <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 rounded-pill bg-line-strong" />
              <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-2">
                <h2 id={titleId} className="card-title">
                  {sheetTitle}
                </h2>
                <button
                  ref={sheetCloseRef}
                  type="button"
                  onClick={close}
                  aria-label="Close"
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-inset text-muted transition-colors hover:bg-neutral-soft hover:text-ink"
                >
                  <X size={20} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </div>
              <ul
                ref={sheetListRef}
                role="listbox"
                aria-label={sheetTitle}
                tabIndex={0}
                aria-activedescendant={optionId(active)}
                className="space-y-0.5 px-2 pb-3 outline-none"
              >
                {renderOptions(() => "min-h-12")}
              </ul>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
