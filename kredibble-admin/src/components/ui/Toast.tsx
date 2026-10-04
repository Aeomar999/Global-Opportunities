"use client";

/**
 * Toast: short confirmation messages in the bottom-right corner, 24px from the viewport edges
 * (72px from the bottom in development, so they clear the Next.js dev badge).
 * When a StickyActionBar is on screen the stack sits 24px ABOVE the bar's top edge, never over it
 * (see form/action-bar-store.ts); it follows the bar while scrolling and resizing.
 *
 * - <ToastProvider> wraps the dashboard shell once.
 * - useToast() returns { success(message), info(message) }. Messages are one sentence in past tense
 *   with no capitalised status words mid-sentence: "Enoch Mensah was suspended."
 * - The stack is a polite live region (role="status", aria-live="polite"), so screen readers hear the
 *   message without focus moving. It sits at the bottom, so it never covers the page header or its
 *   actions. Newer toasts stack UPWARD above older ones. At most 3 are shown.
 * - Each toast dismisses itself after 5s. The timer pauses while the pointer is over the toast or
 *   focus is inside it, and continues with the time that was left.
 * - Each toast has a close button with an aria-label.
 *
 * Success toasts use the success tone (green) with a check icon and text; colour is never the only signal.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useActionBar } from "./form/action-bar-store";

type ToastTone = "success" | "info";

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const AUTO_DISMISS_MS = 5000;
const MAX_TOASTS = 3;
const IS_DEV = process.env.NODE_ENV === "development";

const BASE_BOTTOM_PX = IS_DEV ? 72 : 24;
const BAR_GAP_PX = 24;

/** Distance of the stack from the viewport bottom: the base offset, or 24px above a visible action bar. */
function useToastBottom(): number {
  const bar = useActionBar();
  const [clearance, setClearance] = useState(0);

  useEffect(() => {
    if (!bar) return;
    const measure = () => {
      const box = bar.getBoundingClientRect();
      // A hidden bar (inactive tab) has no size: ignore it.
      setClearance(box.width === 0 && box.height === 0 ? 0 : Math.max(0, window.innerHeight - box.top));
    };
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      observer.disconnect();
      setClearance(0);
    };
  }, [bar]);

  return Math.max(BASE_BOTTOM_PX, clearance > 0 ? clearance + BAR_GAP_PX : 0);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const bottom = useToastBottom();

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback((tone: ToastTone, message: string) => {
    const id = nextId.current++;
    setToasts((list) => [...list.slice(-(MAX_TOASTS - 1)), { id, tone, message }]);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push("success", message),
      info: (message) => push("info", message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* flex-col-reverse: the oldest toast is at the bottom, newer ones stack upward. */}
      <div
        role="status"
        aria-live="polite"
        aria-label="Status messages"
        className="pointer-events-none fixed right-6 z-70 flex w-[calc(100%-3rem)] max-w-sm flex-col-reverse gap-2"
        // Data-driven (follows the action bar), so inline.
        style={{ bottom }}
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(AUTO_DISMISS_MS);

  // Counts down while not paused; on pause it keeps what was left.
  useEffect(() => {
    if (paused) return;
    const startedAt = Date.now();
    const timer = setTimeout(() => onDismiss(toast.id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - startedAt;
    };
  }, [paused, onDismiss, toast.id]);

  const Icon = toast.tone === "success" ? CheckCircle2 : Info;
  return (
    <div
      data-testid="toast"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto flex items-start gap-3 rounded-card border border-line bg-surface p-4 shadow-pop"
    >
      <Icon
        size={20}
        strokeWidth={1.75}
        aria-hidden="true"
        className={cn("mt-0.5 shrink-0", toast.tone === "success" ? "text-success" : "text-purple-700")}
      />
      <p className="body-sm min-w-0 flex-1 font-semibold text-ink">{toast.message}</p>
      <button
        type="button"
        aria-label="Dismiss message"
        onClick={() => onDismiss(toast.id)}
        className="relative inline-flex size-6 shrink-0 items-center justify-center rounded-inset text-muted transition-colors before:absolute before:-inset-2 before:content-[''] hover:bg-neutral-soft hover:text-ink"
      >
        <X size={14} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}

/** Shows a toast. Must be used under <ToastProvider> (the dashboard shell provides it). */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside <ToastProvider>");
  return api;
}
