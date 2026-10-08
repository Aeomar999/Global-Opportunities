"use client";

/**
 * DateTimeField: a date AND a time in one field, replacing the browser's native datetime-local input (whose picker is drawn by the
 * operating system). It is built on the DatePicker (the date part) and the TimeField (the time part), so it looks and behaves like
 * the rest of the form system.
 *
 *   Start date and time                                  <- the label (and "Optional" when it is)
 *   [ 2 Aug 2026            [cal] ]  [ 6:00 PM   [clock] ]  GMT     <- side by side from 640px, stacked below
 *   Enter a time like 6:00 PM                            <- the error (announced; the first invalid part takes focus on submit)
 *
 * - It is ONE role="group" named by its label; the two parts are named "Date" and "Time" inside it, so a screen reader says
 *   "Start date and time, group, Date".
 * - The value is a single ISO date-time with no zone written in it: "2026-08-02T18:00" (as the forms always stored it). The zone is the
 *   desk's (DESK_TIME_ZONE in config/time.ts, "GMT"): it is shown, muted, after the time. An empty date OR an empty time gives an EMPTY
 *   value (the parts are kept while the other one is filled in).
 * - Errors, in this order: a time that cannot be read ("Enter a time like 6:00 PM", the field goes back to the last good time),
 *   then the error the form passes in (required, or its own wording for "the end must be after the start"), then, when
 *   minTimeAfter is set and the value is not after it, "End must be after the start". They are linked with aria-describedby and the
 *   parts that are wrong have aria-invalid, so the form's "focus the first invalid field" lands on the right one.
 *
 * Props:
 * - value: "YYYY-MM-DDTHH:mm" or ""    - onChange(value)
 * - label: the visible label and the group's name
 * - min / max: earliest and latest date-time (their dates limit the calendar; the form checks the rest)
 * - error: the form's message, shown now (the form decides when, as for every field)
 * - required / optional: "Optional" is shown when optional; required is the default and is not marked
 * - minTimeAfter: a date-time the value must come after (the start, for an end value); the calendar starts at its date
 * - helper, onBlur (when focus leaves the whole group)
 */
import { useId, useState, type FocusEvent } from "react";
import { AlertCircle } from "lucide-react";
import { DESK_TIME_ZONE } from "@/config/time";
import { joinDateTime, splitDateTime } from "@/lib/date-picker";
import { DatePicker } from "./DatePicker";
import { TimeField } from "./TimeField";

interface DateTimeFieldProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  min?: string;
  max?: string;
  error?: string;
  required?: boolean;
  optional?: boolean;
  minTimeAfter?: string;
  helper?: string;
  onBlur?: () => void;
}

export const TIME_ERROR = "Enter a time like 6:00 PM";
export const AFTER_ERROR = "End must be after the start";

export function DateTimeField({ value, onChange, label, min, max, error, optional = false, minTimeAfter, helper, onBlur }: DateTimeFieldProps) {
  const labelId = useId();
  const errorId = useId();
  const helperId = useId();
  const initial = splitDateTime(value);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [timeUnreadable, setTimeUnreadable] = useState(false);

  // The parts follow the value when it changes from outside (a form that was saved, reset or loaded with another record). Adjusting
  // state while rendering (not in an effect) keeps the page from drawing a frame with the old parts.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (value !== joinDateTime(date, time)) {
      const next = splitDateTime(value);
      setDate(next.date);
      setTime(next.time);
    }
  }

  const changeDate = (nextDate: string) => {
    setDate(nextDate);
    onChange(joinDateTime(nextDate, time));
  };
  const changeTime = (nextTime: string) => {
    setTime(nextTime);
    setTimeUnreadable(false);
    onChange(joinDateTime(date, nextTime));
  };

  const after = minTimeAfter && value && value <= minTimeAfter ? AFTER_ERROR : undefined;
  const message = timeUnreadable ? TIME_ERROR : (error ?? after);
  const describedBy = [message ? errorId : null, helper ? helperId : null].filter(Boolean).join(" ") || undefined;
  // Which part is wrong: an unreadable or missing time is the time; a missing date is the date; a problem with the pair is flagged on the date first.
  const timeInvalid = !!message && (timeUnreadable || !time);
  const dateInvalid = !!message && !timeUnreadable && (!date || !!(date && time));

  const onGroupBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onBlur?.();
  };

  return (
    <div role="group" aria-labelledby={labelId} aria-describedby={describedBy} onBlur={onGroupBlur} className="min-w-0">
      <div className="mb-1.5 flex items-baseline gap-2">
        <span id={labelId} className="field-label text-ink">
          {label}
        </span>
        {optional && <span className="caption">Optional</span>}
      </div>
      <div className="grid min-w-0 gap-2 sm:grid-cols-2">
        <DatePicker
          value={date}
          onChange={changeDate}
          min={minTimeAfter ? splitDateTime(minTimeAfter).date || undefined : min ? splitDateTime(min).date || undefined : undefined}
          max={max ? splitDateTime(max).date || undefined : undefined}
          ariaLabel="Date"
          label={`Choose the ${label.toLowerCase().replace(/ date and time$/, "")} date`}
          invalid={dateInvalid}
          describedBy={describedBy}
        />
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1">
            <TimeField value={time} onChange={changeTime} ariaLabel="Time" invalid={timeInvalid} describedBy={describedBy} onInvalid={() => setTimeUnreadable(true)} />
          </div>
          <span data-testid="time-zone" className="caption shrink-0">
            {DESK_TIME_ZONE}
          </span>
        </div>
      </div>
      {helper && !message && (
        <p id={helperId} className="caption mt-1.5">
          {helper}
        </p>
      )}
      {message && (
        <p id={errorId} role="alert" className="caption mt-1.5 flex items-start gap-1.5 text-danger">
          <AlertCircle size={14} strokeWidth={2} aria-hidden="true" className="mt-px shrink-0" />
          <span>{message}</span>
        </p>
      )}
    </div>
  );
}
