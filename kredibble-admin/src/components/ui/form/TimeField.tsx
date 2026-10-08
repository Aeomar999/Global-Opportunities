"use client";

/**
 * TimeField: the time part of the DateTimeField. A 40px text field with a clock button, and a list of 30-minute slots.
 *
 * Typing: "6:00 PM", "6pm", "6 pm", "6:30pm", "18:00" and "18:45" are all times (case does not matter). The field is read when it
 * loses focus (or on Enter) and then shows the 12-hour form, "6:00 PM". A time it cannot read goes back to the last good time, and the
 * field reports it through onInvalid (the DateTimeField writes "Enter a time like 6:00 PM" under the group).
 *
 * The slots (the custom Select look, role="listbox", 12:00 AM to 11:30 PM in 30-minute steps, 12-hour labels):
 * - opened with the clock button or the Down arrow, scrolled so the current time is in view
 * - Up / Down move, Home and End jump to the first and last slot, Enter chooses the active slot, Esc closes and returns focus to the
 *   field; typing while it is open jumps to the first slot that starts with what has been typed (type-ahead)
 * - a popover under the field (4px gap, above it when there is no room, always inside the viewport, following the page when it scrolls);
 *   BELOW 640px a bottom sheet (a title, a 40px close button, 48px rows, a dimmed backdrop, Esc closes), like the DatePicker
 *
 * Props: value ("HH:mm" or ""), onChange(time), ariaLabel, invalid?, describedBy?, onInvalid?(), onBlur?, disabled?, placeholder?
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, Clock, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { TIME_SLOTS, formatTime12, parseTime, slotFor } from "@/lib/date-picker";
import { useMediaQuery } from "@/lib/use-media-query";
import { CONTROL_CLASSES } from "./Field";

interface TimeFieldProps {
  value: string;
  onChange: (time: string) => void;
  ariaLabel: string;
  invalid?: boolean;
  describedBy?: string;
  onInvalid?: () => void;
  onBlur?: () => void;
  disabled?: boolean;
  placeholder?: string;
}

const display = (value: string) => (value ? formatTime12(value) : "");

export function TimeField({ value, onChange, ariaLabel, invalid, describedBy, onInvalid, onBlur, disabled = false, placeholder = "e.g. 6:00 PM" }: TimeFieldProps) {
  const listId = useId();
  const titleId = useId();
  const phone = useMediaQuery("(max-width: 639px)");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(display(value));
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight?: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // The field follows the value when it changes from outside, unless it is being typed in.
  useEffect(() => {
    if (document.activeElement === inputRef.current && parseTime(draft) === value) return;
    setDraft(display(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const slotIndex = (time: string) => Math.max(0, TIME_SLOTS.findIndex((slot) => slot.value === slotFor(time)));

  const openList = () => {
    setPos(null);
    setActive(slotIndex(parseTime(draft) ?? value));
    setOpen(true);
  };
  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) requestAnimationFrame(() => inputRef.current?.focus());
  };

  // A click outside the field and the list closes it.
  useEffect(() => {
    if (!open || phone) return; // (the phone sheet has its own backdrop)
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapperRef.current?.contains(target) || popRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, phone]);

  // Placement: below the field with a 4px gap and the field's width, above when there is no room, inside the viewport.
  useLayoutEffect(() => {
    if (!open || phone) return;
    const place = () => {
      const anchor = wrapperRef.current?.getBoundingClientRect();
      const pop = popRef.current;
      if (!anchor || !pop) return;
      const MARGIN = 8;
      const GAP = 4;
      const height = pop.scrollHeight;
      const below = window.innerHeight - anchor.bottom - GAP - MARGIN;
      const above = anchor.top - GAP - MARGIN;
      let top: number;
      let maxHeight: number | undefined;
      if (height <= below) top = anchor.bottom + GAP;
      else if (height <= above) top = anchor.top - GAP - height;
      else if (below >= above) {
        top = anchor.bottom + GAP;
        maxHeight = Math.max(below, 120);
      } else {
        maxHeight = Math.max(above, 120);
        top = anchor.top - GAP - maxHeight;
      }
      const width = Math.max(anchor.width, 160);
      const left = Math.min(Math.max(anchor.left, MARGIN), Math.max(MARGIN, window.innerWidth - width - MARGIN));
      setPos((current) => (current && current.top === top && current.left === left && current.width === width && current.maxHeight === maxHeight ? current : { top, left, width, maxHeight }));
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, phone]);

  // The active slot is kept in view (and the list opens scrolled to the current value).
  const visible = phone || pos !== null;
  useEffect(() => {
    if (!open || !visible) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, visible, active]);

  const commit = (text: string) => {
    if (!text.trim()) {
      onChange("");
      setDraft("");
      return true;
    }
    const time = parseTime(text);
    if (!time) return false;
    onChange(time);
    setDraft(formatTime12(time));
    return true;
  };

  const choose = (index: number) => {
    const slot = TIME_SLOTS[index];
    onChange(slot.value);
    setDraft(slot.label);
    close(true);
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const last = TIME_SLOTS.length - 1;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) openList();
      else setActive((index) => Math.min(last, Math.max(0, index + (event.key === "ArrowDown" ? 1 : -1))));
    } else if (event.key === "Home" && open) {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End" && open) {
      event.preventDefault();
      setActive(last);
    } else if (event.key === "Enter") {
      if (open) {
        event.preventDefault();
        choose(active);
      } else if (!commit(draft)) {
        event.preventDefault();
        onInvalid?.();
        setDraft(display(value));
      }
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    }
  };

  // Type-ahead: while the list is open, what is typed jumps to the first slot that starts with it ("6:" -> 6:00 AM, "6:30 p" -> 6:30 PM).
  const onType = (text: string) => {
    setDraft(text);
    if (!open) return;
    const typed = text.toLowerCase().replace(/\s+/g, "");
    if (!typed) return;
    const index = TIME_SLOTS.findIndex((slot) => slot.label.toLowerCase().replace(/\s+/g, "").startsWith(typed));
    if (index >= 0) setActive(index);
  };

  // In the phone sheet focus moves into the list (the same keys work there), and Tab cycles between the list and the close button.
  const sheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open && phone) listRef.current?.focus();
  }, [open, phone]);
  const onSheetKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "Tab") {
      const focusables = Array.from(sheetRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), [role='listbox']") ?? []);
      if (focusables.length === 0) return;
      const at = focusables.indexOf(document.activeElement as HTMLElement);
      const next = at < 0 ? 0 : (at + (event.shiftKey ? -1 : 1) + focusables.length) % focusables.length;
      event.preventDefault();
      focusables[next].focus();
    }
  };

  const list = (
    <ul ref={listRef} id={listId} role="listbox" tabIndex={phone ? 0 : -1} onKeyDown={phone ? onInputKeyDown : undefined} aria-activedescendant={open ? `${listId}-${active}` : undefined} aria-label={`${ariaLabel} slots`} className="max-h-60 overflow-y-auto p-1 max-sm:max-h-[55vh] max-sm:space-y-0.5 max-sm:px-2 max-sm:pb-3">
      {TIME_SLOTS.map((slot, index) => {
        const selected = slot.value === value;
        return (
          <li
            key={slot.value}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={selected}
            data-index={index}
            data-value={slot.value}
            onMouseEnter={() => setActive(index)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(index)}
            className={cn(
              "flex cursor-pointer items-center justify-between rounded-inset px-3 text-sm tabular-nums",
              phone ? "h-12" : "h-10",
              index === active && "bg-surface-2",
              selected ? "font-semibold text-purple-700" : "text-ink",
            )}
          >
            {slot.label}
            {selected && <Check size={16} strokeWidth={2} aria-hidden="true" />}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div ref={wrapperRef} className="relative min-w-0">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open ? `${listId}-${active}` : undefined}
          aria-autocomplete="list"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder}
          value={draft}
          onChange={(event) => onType(event.target.value)}
          onKeyDown={onInputKeyDown}
          onBlur={() => {
            if (!commit(draft)) {
              // not a time: back to the last good time, and the group says why
              setDraft(display(value));
              onInvalid?.();
            }
            onBlur?.();
          }}
          className={cn(CONTROL_CLASSES, "h-10 pr-12")}
        />
        <button
          type="button"
          disabled={disabled}
          aria-label={open ? "Close the list of times" : "Open the list of times"}
          aria-expanded={open}
          onClick={() => (open ? close(true) : openList())}
          className="absolute right-0 top-0 inline-flex size-10 items-center justify-center rounded-control text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Clock size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
      {open && !phone && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            data-testid="time-list-popover"
            className="fixed z-80 overflow-y-auto rounded-control border border-line bg-surface shadow-pop"
            // Data-driven position (measured from the field): the one legitimate inline style. Hidden for the one frame it is measured in.
            style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, width: pos?.width ?? 160, maxHeight: pos?.maxHeight, visibility: pos ? "visible" : "hidden" }}
          >
            {list}
          </div>,
          document.body,
        )}
      {open && phone && typeof document !== "undefined" &&
        createPortal(
          <div ref={sheetRef} className="fixed inset-0 z-80" onKeyDown={onSheetKeyDown}>
            <div aria-hidden="true" data-testid="time-sheet-backdrop" onClick={() => close(false)} className="absolute inset-0 bg-ink/40" />
            <div role="dialog" aria-modal="true" aria-labelledby={titleId} data-testid="time-sheet" className="sheet-enter absolute inset-x-0 bottom-0 rounded-t-[20px] bg-surface pb-[env(safe-area-inset-bottom)] shadow-pop">
              <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 rounded-pill bg-line-strong" />
              <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-2">
                <h2 id={titleId} className="card-title">
                  Choose a time
                </h2>
                <button type="button" onClick={() => close(true)} aria-label="Close" className="inline-flex size-10 shrink-0 items-center justify-center rounded-inset text-muted transition-colors hover:bg-neutral-soft hover:text-ink">
                  <X size={20} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </div>
              {list}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
