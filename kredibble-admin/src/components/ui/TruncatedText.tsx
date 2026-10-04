"use client";

/**
 * TruncatedText / TruncatedLink: single-line text that ends in an ellipsis when it does not fit,
 * and then shows its FULL text two ways:
 *
 * - a native `title` attribute (the browser's own hover hint, also useful on touch long-press);
 * - the shared Tooltip, on hover AND keyboard focus. A plain text span is not focusable, so while
 *   (and only while) it is truncated it gets tabIndex={0}; that is how a keyboard user reaches it.
 *
 * Text that fits stays a normal, non-focusable span with no title and no tooltip, so tables do not
 * fill up with pointless tab stops. Truncation is measured with a ResizeObserver, so it updates
 * when the window or a column resizes.
 *
 * Props:
 * - text: the full text (also the visible text)
 * - className: styling for the text element (the ellipsis behaviour is added for you)
 * TruncatedLink also takes href and renders a Next <Link>; use it where the text is the row's link.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Tooltip } from "./Tooltip";

/** True while the element's text is cut off. Updated by a ResizeObserver (no setState during render or effect setup). */
function useIsTruncated<T extends HTMLElement>(text: string) {
  const ref = useRef<T>(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setTruncated(element.scrollWidth > element.clientWidth));
    observer.observe(element); // fires once immediately, then on every size change
    return () => observer.disconnect();
  }, [text]);

  return { ref, truncated };
}

// The tooltip wrapper must stay a plain block that can shrink (min-w-0) so the ellipsis still works,
// and must NOT be positioned (a stretched row link positions itself against the table row).
const WRAPPER = "block min-w-0";

export function TruncatedText({ text, className }: { text: string; className?: string }) {
  const { ref, truncated } = useIsTruncated<HTMLSpanElement>(text);

  return (
    <Tooltip label={text} disabled={!truncated} wrap wrapperClassName={WRAPPER}>
      <span
        ref={ref}
        title={truncated ? text : undefined}
        tabIndex={truncated ? 0 : undefined}
        className={cn("block truncate rounded-inset", className)}
      >
        {text}
      </span>
    </Tooltip>
  );
}

export function TruncatedLink({ href, text, className }: { href: string; text: string; className?: string }) {
  const { ref, truncated } = useIsTruncated<HTMLAnchorElement>(text);

  return (
    <Tooltip label={text} disabled={!truncated} wrap wrapperClassName={WRAPPER}>
      <Link ref={ref} href={href} title={truncated ? text : undefined} className={cn("block truncate", className)}>
        {text}
      </Link>
    </Tooltip>
  );
}
