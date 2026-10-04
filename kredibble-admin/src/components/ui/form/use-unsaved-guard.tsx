"use client";

/**
 * useUnsavedGuard: warns before unsaved changes are lost.
 *
 *   const guard = useUnsavedGuard(dirty);
 *   ...
 *   <Button onClick={() => guard.leave("/team")}>Cancel</Button>   // asks first when dirty
 *   guard.leaveNow("/team")                                          // after a successful save
 *   {guard.dialog}                                                   // render once
 *
 * While `dirty` is true:
 * - Closing or reloading the tab triggers the browser's own "Leave site?" prompt (beforeunload).
 * - Clicking any in-app link (sidebar, breadcrumbs, logo) is intercepted and opens a dialog:
 *   "Discard unsaved changes?" with "Keep editing" (the safe default, focused) and "Discard changes".
 * - leave(href) (the Cancel button) uses the same dialog.
 *
 * Not covered: the browser Back button and router.push calls made outside a link (the command
 * palette). Next.js has no hook for those, so they leave without a prompt.
 *
 * leaveNow(href) turns the guard off and navigates, so a successful save never warns.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function useUnsavedGuard(dirty: boolean) {
  const router = useRouter();
  const allowLeave = useRef(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowLeave.current) return;
      event.preventDefault();
      event.returnValue = ""; // required by some browsers to show the prompt
    };

    const onClick = (event: MouseEvent) => {
      if (allowLeave.current || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; // opens a new tab/window
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname + url.search === window.location.pathname + window.location.search) return;
      event.preventDefault();
      event.stopPropagation(); // Next's Link never sees this click
      setPendingHref(url.pathname + url.search + url.hash);
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true); // capture: runs before Link's own handler
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  const leaveNow = useCallback(
    (href: string) => {
      allowLeave.current = true;
      router.push(href);
    },
    [router],
  );

  const leave = useCallback(
    (href: string) => {
      if (dirty) setPendingHref(href);
      else leaveNow(href);
    },
    [dirty, leaveNow],
  );

  const dialog = (
    <ConfirmDialog
      open={pendingHref !== null}
      title="Discard unsaved changes?"
      description="You have changes that have not been saved. If you leave now they will be lost."
      confirmLabel="Discard changes"
      cancelLabel="Keep editing"
      onConfirm={() => {
        const href = pendingHref;
        setPendingHref(null);
        if (href) leaveNow(href);
      }}
      onCancel={() => setPendingHref(null)}
    />
  );

  return { leave, leaveNow, dialog };
}
