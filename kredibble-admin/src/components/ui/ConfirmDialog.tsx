"use client";

/**
 * ConfirmDialog: asks "are you sure?" before a destructive or irreversible action.
 *
 * Accessibility
 * - role="alertdialog" with aria-modal, labelled by its title and described by its text.
 * - Focus moves into the dialog on open, to the SAFE button (Cancel), stays trapped inside
 *   (Tab / Shift+Tab cycle), and returns to whatever opened it when the dialog closes.
 * - Esc cancels; so does a click on the dimmed backdrop.
 * - The confirm button names the action ("Suspend account"), never just "OK" or "Yes".
 * - The description restates who or what is affected, so the person can check before confirming.
 *
 * Usage: `useConfirmDialog()` returns { confirm, dialog }. Render {dialog} once in the page and call
 *   confirm({ title, description, confirmLabel, onConfirm }) from a button handler.
 *
 * Props of the component itself (used by the hook):
 * - open: shown or not (it unmounts when closed so its focus handling resets)
 * - title / description / confirmLabel / cancelLabel
 * - tone: "danger" (solid red confirm button, the default) or "neutral" (primary confirm button)
 * - onConfirm / onCancel
 */
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "neutral";
  onConfirm: () => void;
  onCancel: () => void;
}

const FOCUSABLE = "button:not([disabled]), [href], input, [tabindex]:not([tabindex='-1'])";

export function ConfirmDialog(props: ConfirmDialogProps) {
  return props.open ? <DialogBody {...props} /> : null;
}

function DialogBody({
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus the safe button on open, restore focus on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => previous?.focus();
  }, []);

  // Esc cancels. Tab is trapped inside the dialog.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;
      const items = [...(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-ink/40 p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onCancel()}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-pop"
      >
        <h2 id={titleId} className="card-title">
          {title}
        </h2>
        <div id={descriptionId} className="page-subtitle mt-2">
          {description}
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button ref={cancelRef} variant="secondary" onClick={onCancel} data-testid="confirm-dialog-cancel">
            {cancelLabel}
          </Button>
          <Button variant={tone === "danger" ? "danger-solid" : "primary"} onClick={onConfirm} data-testid="confirm-dialog-confirm">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** What a page passes to confirm(). */
export interface ConfirmRequest {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "neutral";
  onConfirm: () => void;
}

/** One dialog per page: call confirm(request), render {dialog}. */
export function useConfirmDialog() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const confirm = useCallback((next: ConfirmRequest) => setRequest(next), []);
  const cancel = useCallback(() => setRequest(null), []);

  const dialog = request ? (
    <ConfirmDialog
      open
      title={request.title}
      description={request.description}
      confirmLabel={request.confirmLabel}
      tone={request.tone}
      onCancel={cancel}
      onConfirm={() => {
        setRequest(null);
        request.onConfirm();
      }}
    />
  ) : null;

  return { confirm, dialog };
}
