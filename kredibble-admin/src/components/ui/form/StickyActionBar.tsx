"use client";

/**
 * StickyActionBar: the Cancel / Save row of a form, pinned to the bottom of the content area.
 *
 *   [ ● Unsaved changes ]                                   [ Cancel ]  [ Save ]
 *
 * - Sticks to the bottom of the viewport while the form is taller than the screen. When the form is short it
 *   still sits at the very bottom of the screen (the page area fills the viewport; the form is a flex column
 *   with this bar last) and never covers the last field. It spans the full width
 *   of the content area.
 * - The status text is a polite live region ("Unsaved changes" by default, shown only while dirty).
 * - Save is a submit button: put the bar inside the <form>. While `saving` it shows a spinner and
 *   is disabled (Button's loading state), and Cancel is disabled too.
 * - It registers itself (action-bar-store) so toasts stay 24px above its top edge.
 * - Phones (below 640px): the status text sits on its own line above the buttons, and the two buttons
 *   share the row, each 44px tall.
 *
 * Props: dirty, saving, saveLabel ("Save changes"), onCancel,
 *        cancelLabel? ("Cancel"; "Reset" on the Roles tab), status? (text instead of "Unsaved changes",
 *        for example "2 changes"), maxWidth? (a CSS width such as "40rem": the buttons then sit under the
 *        right edge of a narrow, left-aligned form instead of the far right of the page)
 */
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { registerActionBar } from "./action-bar-store";

interface StickyActionBarProps {
  dirty: boolean;
  saving: boolean;
  saveLabel: string;
  onCancel: () => void;
  cancelLabel?: string;
  status?: string;
  maxWidth?: string;
}

export function StickyActionBar({ dirty, saving, saveLabel, onCancel, cancelLabel = "Cancel", status = "Unsaved changes", maxWidth }: StickyActionBarProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    registerActionBar(ref.current);
    return () => registerActionBar(null);
  }, []);

  return (
    <>
      {/* Pushes the bar to the bottom of a short form (the form is a flex column that fills the page) and keeps
          at least 24px between the last field and the bar. */}
      <div aria-hidden="true" className="min-h-6 flex-1" />
    <div
      ref={ref}
      // -mb-*: cancels the page's bottom padding, so the bar's bottom edge IS the bottom of the viewport.
      className="sticky bottom-0 z-20 -mx-4 -mb-4 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:-mb-5 sm:px-5 lg:-mx-7 lg:-mb-7 lg:px-7"
    >
      <div className="flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-stretch max-sm:gap-2" style={maxWidth ? { maxWidth } : undefined}>
        <p role="status" aria-live="polite" className="body-sm flex items-center gap-2 text-muted max-sm:empty:hidden">
          {dirty && (
            <>
              <span aria-hidden="true" className="size-2 rounded-pill bg-warning-dot" />
              {status}
            </>
          )}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={saving} className="max-sm:h-11 max-sm:flex-1">
            {cancelLabel}
          </Button>
          <Button type="submit" loading={saving} className="max-sm:h-11 max-sm:flex-1">
            {saveLabel}
          </Button>
        </div>
      </div>
    </div>
    </>
  );
}
