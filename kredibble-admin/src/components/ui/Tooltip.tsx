"use client";

/**
 * Tooltip: a short text label that appears on hover AND keyboard focus.
 *
 * - Appears after a 150ms delay (so it does not flash while the pointer
 *   passes over), disappears immediately on leave / blur.
 * - Escape dismisses it, even when the pointer (not focus) opened it.
 * - The bubble is a DOM child of the wrapper, so moving the pointer onto it
 *   keeps it open (WCAG "hoverable"); padding on the bubble bridges the gap.
 * - role="tooltip" on the bubble and aria-describedby on the trigger while open.
 * - The bubble uses `position: fixed` with coordinates measured from the
 *   trigger, so it is never clipped by a scrolling or overflow-hidden parent
 *   (the sidebar rail's nav list scrolls).
 *
 * Props:
 * - label: the tooltip text
 * - children: ONE element (button, link...) that receives aria-describedby
 * - placement: top | bottom | left | right (default "top")
 * - forceOpen: always show it, positioned absolutely (used by /_design review)
 * - disabled: never show it (used by TruncatedText, which only needs a tooltip while truncated)
 * - wrap: allow long text to wrap (max 20rem wide) instead of one long line
 * - wrapperClassName: classes for the wrapper element (default "inline-flex"); use "block min-w-0"
 *   around text that must be able to shrink and show an ellipsis
 *
 * Look: violet-black bubble, white text, a 1px translucent-white border and
 * the menu shadow, so it stays distinct on both light and dark surfaces.
 */
import { cloneElement, useCallback, useEffect, useId, useRef, useState, type ReactElement } from "react";
import { cn } from "@/lib/cn";

const SHOW_DELAY_MS = 150;

type Placement = "top" | "bottom" | "left" | "right";

// forceOpen only: absolute placement relative to the wrapper.
const ABSOLUTE_CLASSES: Record<Placement, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 pb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 pt-2",
  left: "right-full top-1/2 -translate-y-1/2 pr-2",
  right: "left-full top-1/2 -translate-y-1/2 pl-2",
};

// Normal use: fixed at the measured anchor point, shifted by its own size. The padding side bridges the gap.
const FIXED_CLASSES: Record<Placement, string> = {
  top: "-translate-x-1/2 -translate-y-full pb-2",
  bottom: "-translate-x-1/2 pt-2",
  left: "-translate-x-full -translate-y-1/2 pr-2",
  right: "-translate-y-1/2 pl-2",
};

interface TooltipProps {
  label: string;
  children: ReactElement<{ "aria-describedby"?: string }>;
  placement?: Placement;
  forceOpen?: boolean;
  disabled?: boolean;
  wrap?: boolean;
  wrapperClassName?: string;
}

/** Anchor point on the trigger's edge for each placement. */
function anchorFor(rect: DOMRect, placement: Placement) {
  switch (placement) {
    case "top":
      return { x: rect.left + rect.width / 2, y: rect.top };
    case "bottom":
      return { x: rect.left + rect.width / 2, y: rect.bottom };
    case "left":
      return { x: rect.left, y: rect.top + rect.height / 2 };
    case "right":
      return { x: rect.right, y: rect.top + rect.height / 2 };
  }
}

export function Tooltip({
  label,
  children,
  placement = "top",
  forceOpen = false,
  disabled = false,
  wrap = false,
  wrapperClassName,
}: TooltipProps) {
  const id = useId();
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const show = useCallback(() => {
    clearTimer();
    timer.current = setTimeout(() => {
      if (wrapperRef.current) setAnchor(anchorFor(wrapperRef.current.getBoundingClientRect(), placement));
      setOpen(true);
    }, SHOW_DELAY_MS);
  }, [placement]);
  const hide = useCallback(() => {
    clearTimer();
    setOpen(false);
  }, []);

  // Clear a pending timer if the component unmounts mid-delay.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // Escape dismisses the tooltip even when the pointer (not focus) is what opened it.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => event.key === "Escape" && hide();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, hide]);

  const visible = !disabled && (forceOpen || (open && anchor !== null));

  return (
    <span
      ref={wrapperRef}
      // Only the absolutely positioned review mode needs a positioned wrapper; the normal fixed bubble does not.
      className={cn(forceOpen && "relative", wrapperClassName ?? "inline-flex")}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {cloneElement(children, { "aria-describedby": visible ? id : undefined })}
      {visible && (
        <span
          role="tooltip"
          id={id}
          className={cn("z-50", forceOpen ? `absolute ${ABSOLUTE_CLASSES[placement]}` : `fixed ${FIXED_CLASSES[placement]}`)}
          style={forceOpen || !anchor ? undefined : { left: anchor.x, top: anchor.y }}
        >
          <span
            className={cn(
              "badge-text block rounded-inset border border-white/18 bg-ink px-2 py-1 font-medium text-white shadow-pop",
              wrap ? "max-w-xs whitespace-normal break-words" : "whitespace-nowrap",
            )}
          >
            {label}
          </span>
        </span>
      )}
    </span>
  );
}
