"use client";

/**
 * DatePicker: the app's own date field. It replaces the browser's native date input, whose picker is drawn by the operating
 * system (system colours, a different look on every device).
 *
 * The field (the same 40px control as every text field): a text input that shows the shared date format ("7 Oct 2026") with a
 * calendar button at its right. A person can TYPE a date ("2026-10-07", "7 Oct 2026" or "7 October 2026"): it is used as soon as
 * it is a real date, and the field shows the shared format again when it loses focus. Or open the calendar (the button, or the
 * Down arrow in the field).
 *
 * The calendar (a popover; a BOTTOM SHEET below 640px). The popover is placed with fixed coordinates measured from the field: directly
 * BELOW it (a 4px gap) and aligned to its left edge when there is room, ABOVE it when there is not, and when neither side has room for
 * its full height it takes the side with more room and scrolls inside. It never covers the field itself, always stays inside the
 * viewport (also sideways), and follows the field when the page scrolls or the window is resized.
 * - role="dialog" with an aria-label; Tab stays inside it; Esc closes it and puts focus back on the field
 * - a header with the month and year and Previous / Next month buttons (40px hit areas)
 * - a 7-column grid of days, Monday first, 40px cells; today has a purple ring, the chosen day is filled purple-500 with white text
 * - days before `min` or after `max` are disabled, and their aria-label says why ("... unavailable: after the latest date you
 *   can choose"); they stay focusable so a screen reader can read the reason
 * - keyboard in the grid: Left / Right move by a day, Up / Down by a week, PageUp / PageDown by a month (Shift: a year),
 *   Home / End to the start and end of the week, Enter or Space chooses the day
 * - a "Today" shortcut (disabled when today is outside min and max)
 * A typed date outside min and max is still passed to onChange, so the form can say why it is refused; only the calendar blocks it.
 *
 * Props:
 * - value: "YYYY-MM-DD" or "" (none)
 * - onChange(iso): the new date ("" when the field is emptied)
 * - min / max: "YYYY-MM-DD", the earliest and latest date the calendar allows
 * - label: the calendar dialog's accessible name (default "Choose a date"); the field itself is named by its <Field> label
 * - error: a message, shown under the field when the DatePicker is used outside a <Field> (inside one, give the Field the error)
 * - onBlur, placeholder, disabled, ariaLabel (the field's name when there is no <Field>)
 * - invalid, describedBy: for a DatePicker used outside a <Field> (the DateTimeField): aria-invalid and aria-describedby on the field
 */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  MONTH_NAMES,
  WEEKDAYS,
  addDays,
  addMonths,
  clampDate,
  disabledReason,
  endOfWeek,
  isoToParts,
  longDate,
  monthGrid,
  parseTyped,
  shortDate,
  startOfWeek,
} from "@/lib/date-picker";
import { todayIsoDate } from "@/lib/services/listings";
import { useMediaQuery } from "@/lib/use-media-query";
import { CONTROL_CLASSES, useFieldControlProps } from "./Field";

interface DatePickerProps {
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  label?: string;
  error?: string;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  invalid?: boolean;
  describedBy?: string;
}

const DAY = "inline-flex size-10 items-center justify-center rounded-inset text-sm tabular-nums transition-colors";
const NAV = "inline-flex size-10 shrink-0 items-center justify-center rounded-inset text-muted transition-colors hover:bg-neutral-soft hover:text-ink";

export function DatePicker({ value, onChange, min, max, label = "Choose a date", error, onBlur, placeholder = "e.g. 7 Oct 2026", disabled = false, ariaLabel, invalid, describedBy }: DatePickerProps) {
  const fieldProps = useFieldControlProps();
  const ownId = useId();
  const inputId = (fieldProps as { id?: string }).id ?? ownId;
  const dialogId = useId();
  const titleId = useId();
  const phone = useMediaQuery("(max-width: 639px)");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ? shortDate(value) : "");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const today = todayIsoDate();
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight?: number } | null>(null);

  // The field follows the value when it changes from outside (a form that was saved and reset), unless it is being typed in.
  useEffect(() => {
    if (document.activeElement === inputRef.current && parseTyped(draft) === value) return;
    setDraft(value ? shortDate(value) : "");
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Opening forgets the last placement, so the popover is measured (hidden for that one frame) before it is shown.
  const openCalendar = () => {
    setPos(null);
    setOpen(true);
  };

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // A click outside the field and the calendar closes it.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapperRef.current?.contains(target) || dialogRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Placement with a collision check against the viewport; measured when it opens and again on scroll and resize.
  useLayoutEffect(() => {
    if (!open || phone) return;
    const place = () => {
      const anchor = wrapperRef.current?.getBoundingClientRect();
      const pop = popRef.current;
      if (!anchor || !pop) return;
      const MARGIN = 8;
      const GAP = 4;
      const height = pop.scrollHeight;
      const width = pop.offsetWidth;
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
      const left = Math.min(Math.max(anchor.left, MARGIN), Math.max(MARGIN, window.innerWidth - width - MARGIN));
      setPos((current) => (current && current.top === top && current.left === left && current.maxHeight === maxHeight ? current : { top, left, maxHeight }));
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, phone]);

  const commit = (text: string) => {
    setDraft(text);
    if (!text.trim()) {
      onChange("");
      return;
    }
    const iso = parseTyped(text);
    if (iso) onChange(iso);
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || (event.altKey && event.key === "ArrowDown")) {
      event.preventDefault();
      openCalendar();
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      close(true);
    }
  };

  const pick = (iso: string) => {
    onChange(iso);
    setDraft(shortDate(iso));
    close(true);
  };

  const calendar = open ? (
    <Calendar
      dialogRef={dialogRef}
      dialogId={dialogId}
      titleId={titleId}
      label={label}
      value={value}
      min={min}
      max={max}
      today={today}
      sheet={phone}
      visible={phone || pos !== null}
      onPick={pick}
      onClose={() => close(true)}
    />
  ) : null;

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          {...fieldProps}
          id={inputId}
          aria-invalid={invalid || (fieldProps as { "aria-invalid"?: boolean })["aria-invalid"] || undefined}
          aria-describedby={describedBy ?? (fieldProps as { "aria-describedby"?: string })["aria-describedby"]}
          type="text"
          role="combobox"
          inputMode="numeric"
          autoComplete="off"
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? dialogId : undefined}
          disabled={disabled}
          placeholder={placeholder}
          value={draft}
          onChange={(event) => commit(event.target.value)}
          onKeyDown={onInputKeyDown}
          onBlur={() => {
            // The field shows the shared format again: a date that was typed in another form is written the shared way, and text
            // that is not a date goes back to the chosen date.
            const typed = parseTyped(draft);
            setDraft(typed ? shortDate(typed) : value ? shortDate(value) : "");
            onBlur?.();
          }}
          className={cn(CONTROL_CLASSES, "h-10 pr-12")}
        />
        <button
          type="button"
          disabled={disabled}
          aria-label={open ? "Close calendar" : "Open calendar"}
          aria-expanded={open}
          onClick={() => (open ? close(true) : openCalendar())}
          className="absolute right-0 top-0 inline-flex size-10 items-center justify-center rounded-control text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          <CalendarDays size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
      {error && !(fieldProps as { id?: string }).id && (
        <p role="alert" className="caption mt-1.5 flex items-start gap-1.5 text-danger">
          <AlertCircle size={14} strokeWidth={2} aria-hidden="true" className="mt-px shrink-0" />
          <span>{error}</span>
        </p>
      )}
      {open && !phone && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            data-testid="date-picker-popover"
            className="fixed z-80 overflow-y-auto rounded-control"
            // Data-driven position (measured from the field): the one legitimate inline style. Hidden for the one frame it is measured in.
            style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, maxHeight: pos?.maxHeight, visibility: pos ? "visible" : "hidden" }}
          >
            {calendar}
          </div>,
          document.body,
        )}
      {open && phone && typeof document !== "undefined" && createPortal(calendar, document.body)}
    </div>
  );
}

interface CalendarProps {
  dialogRef: React.RefObject<HTMLDivElement | null>;
  dialogId: string;
  titleId: string;
  label: string;
  value: string;
  min?: string;
  max?: string;
  today: string;
  sheet: boolean;
  /** False for the one frame in which the popover is measured (it is hidden then, and a hidden element cannot take focus). */
  visible: boolean;
  onPick: (iso: string) => void;
  onClose: () => void;
}

function Calendar({ dialogRef, dialogId, titleId, label, value, min, max, today, sheet, visible, onPick, onClose }: CalendarProps) {
  // The day that has focus: the chosen day, or today, kept inside min and max.
  const [focusDate, setFocusDate] = useState(() => clampDate(value && isoToParts(value) ? value : today, min, max));
  const gridRef = useRef<HTMLDivElement>(null);
  const parts = isoToParts(focusDate)!;
  const days = monthGrid(parts.year, parts.month);

  // Focus moves into the calendar when it opens.
  useEffect(() => {
    if (visible) gridRef.current?.querySelector<HTMLElement>('[data-focus="true"]')?.focus();
  }, [visible]);

  const moveTo = (iso: string, keepFocus = true) => {
    setFocusDate(clampDate(iso, min, max));
    if (keepFocus) requestAnimationFrame(() => gridRef.current?.querySelector<HTMLElement>('[data-focus="true"]')?.focus());
  };

  const onGridKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, string | undefined> = {
      ArrowLeft: addDays(focusDate, -1),
      ArrowRight: addDays(focusDate, 1),
      ArrowUp: addDays(focusDate, -7),
      ArrowDown: addDays(focusDate, 7),
      PageUp: addMonths(focusDate, event.shiftKey ? -12 : -1),
      PageDown: addMonths(focusDate, event.shiftKey ? 12 : 1),
      Home: startOfWeek(focusDate),
      End: endOfWeek(focusDate),
    };
    const next = step[event.key];
    if (next) {
      event.preventDefault();
      moveTo(next);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!disabledReason(focusDate, min, max)) onPick(focusDate);
    }
  };

  const onDialogKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    // Focus trap: Tab cycles through Previous, Next, the day that has focus and Today (and the sheet's Close button).
    const focusables = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [data-focus="true"]') ?? []).filter((el) => el.tabIndex !== -1 || el.dataset.focus === "true");
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const todayDisabled = disabledReason(today, min, max) !== null;

  const body = (
    <div
      ref={dialogRef}
      id={dialogId}
      role="dialog"
      aria-modal={sheet || undefined}
      aria-label={label}
      data-testid="date-picker-calendar"
      onKeyDown={onDialogKey}
      className={cn(sheet ? "sheet-enter absolute inset-x-0 bottom-0 rounded-t-[20px] bg-surface pb-[max(env(safe-area-inset-bottom),12px)] shadow-pop" : "w-[21rem] rounded-control border border-line bg-surface p-3 shadow-pop")}
    >
      {sheet && (
        <>
          <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 rounded-pill bg-line-strong" />
          <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-2">
            <h2 id={titleId} className="card-title">
              {label}
            </h2>
            <button type="button" onClick={onClose} aria-label="Close" className={NAV}>
              <X size={20} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </>
      )}
      <div className={cn(sheet && "px-3")}>
        <div className="flex items-center justify-between gap-1 pb-2">
          <button type="button" aria-label="Previous month" onClick={() => moveTo(addMonths(focusDate, -1), false)} className={NAV}>
            <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <p aria-live="polite" data-testid="date-picker-month" className="font-display text-sm font-bold text-ink">
            {MONTH_NAMES[parts.month - 1]} {parts.year}
          </p>
          <button type="button" aria-label="Next month" onClick={() => moveTo(addMonths(focusDate, 1), false)} className={NAV}>
            <ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        <div ref={gridRef} role="grid" aria-label={`${MONTH_NAMES[parts.month - 1]} ${parts.year}`} onKeyDown={onGridKey}>
          <div role="row" className="grid grid-cols-7">
            {WEEKDAYS.map((weekday) => (
              <span key={weekday.long} role="columnheader" aria-label={weekday.long} className="caption flex h-8 items-center justify-center font-semibold">
                {weekday.short}
              </span>
            ))}
          </div>
          {Array.from({ length: 6 }, (_, week) => (
            <div key={week} role="row" className="grid grid-cols-7">
              {days.slice(week * 7, week * 7 + 7).map((iso) => {
                const day = isoToParts(iso)!;
                const outside = day.month !== parts.month;
                const reason = disabledReason(iso, min, max);
                const selected = iso === value;
                const isToday = iso === today;
                const focused = iso === focusDate;
                return (
                  <div key={iso} role="gridcell" aria-selected={selected} className="flex justify-center">
                    <button
                      type="button"
                      data-date={iso}
                      data-focus={focused ? "true" : undefined}
                      tabIndex={focused ? 0 : -1}
                      aria-disabled={reason ? true : undefined}
                      aria-current={isToday ? "date" : undefined}
                      aria-label={reason ? `${longDate(iso)}, unavailable: ${reason}` : `${longDate(iso)}${isToday ? ", today" : ""}${selected ? ", selected" : ""}`}
                      onClick={() => {
                        if (reason) return;
                        onPick(iso);
                      }}
                      onFocus={() => setFocusDate(iso)}
                      className={cn(
                        DAY,
                        // Three different looks: SELECTED = a solid purple fill (white text); FOCUSED (the keyboard day) = a 2px purple
                        // outline and NO fill; TODAY = a thin 1px purple ring. The outline and the ring are purple-700 (7:1 on white).
                        selected ? "bg-purple-500 font-semibold text-white" : reason ? "cursor-not-allowed text-muted/50" : outside ? "text-muted hover:bg-neutral-soft" : "text-ink hover:bg-purple-50",
                        isToday && "ring-1 ring-purple-700",
                        "focus:outline-2 focus:outline-offset-0 focus:outline-purple-700",
                        selected && "focus:outline-offset-2",
                      )}
                    >
                      {day.day}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex justify-end pt-2">
          <button
            type="button"
            disabled={todayDisabled}
            onClick={() => onPick(today)}
            className="inline-flex h-10 items-center rounded-control px-3 text-sm font-semibold text-purple-700 transition-colors hover:bg-purple-50 disabled:cursor-not-allowed disabled:text-muted"
          >
            Today
          </button>
        </div>
      </div>
    </div>
  );

  if (!sheet) return body;
  return (
    <div className="fixed inset-0 z-80">
      <div aria-hidden="true" data-testid="date-picker-backdrop" onClick={onClose} className="absolute inset-0 bg-ink/40" />
      {body}
    </div>
  );
}
