/**
 * UnavailableNote: compact "could not load this section" placeholder.
 * Fills its (fixed-height) parent so the card keeps its final size, and never
 * grows past 240px (max-h-60). The dash has aria-label "unavailable".
 */
export function UnavailableNote({ message = "This section could not be loaded." }: { message?: string }) {
  return (
    <div className="flex h-full max-h-60 min-h-24 flex-col items-center justify-center gap-1 text-center">
      <p className="stat-value text-muted">
        <span role="img" aria-label="unavailable">
          —
        </span>
      </p>
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}
