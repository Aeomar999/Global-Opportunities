/**
 * NotAvailableYet: what an Overview section shows in real-API mode while its figures have no live source. It is calm and muted
 * because it is NOT an error (a real failure keeps the banner with "Try again"). One icon, one line.
 *
 * Props:
 * - icon: the section's icon
 */
import type { LucideIcon } from "lucide-react";

export function NotAvailableYet({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div data-testid="not-available-yet" className="flex min-h-40 flex-col items-center justify-center gap-2 text-center text-muted">
      <Icon size={24} strokeWidth={1.5} aria-hidden="true" />
      <p className="body-sm">Not available yet</p>
    </div>
  );
}
