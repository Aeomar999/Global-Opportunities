/**
 * InfoCard: a titled content card for detail pages (card title is Jakarta 16/22,
 * never a small uppercase label). The card is a labelled region, so screen-reader
 * users can jump between sections.
 *
 * Props:
 * - title: the card title (also its accessible name)
 * - subtitle: optional muted line under the title
 * - action: optional node on the right of the header
 * - children: the content (usually a KeyValueList, MiniStats or a list)
 */
import type { ReactNode } from "react";
import { Card, CardHeader } from "@/components/ui/Card";

interface InfoCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function InfoCard({ title, subtitle, action, children, className }: InfoCardProps) {
  return (
    <Card as="section" ariaLabel={title} className={className}>
      <CardHeader title={title} subtitle={subtitle} action={action} />
      {children}
    </Card>
  );
}
