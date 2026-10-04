"use client";

/**
 * StubPage: a placeholder for a screen that is built in a later step. It already has its place in the nav, its
 * breadcrumb group and its access rule, so the roles and navigation can be used and tested now.
 *
 * Shows a PageHeader and a "This screen is built in a later step" empty state, all inside RequireAccess.
 *
 * Props:
 * - screen: the permission screen (decides who may open it)
 * - title / subtitle: the page header
 * - icon / tone: the entity icon tile (orange for Opportunities and Programs, purple for Partners and Network)
 */
import { Hammer } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Screen } from "@/config/permissions";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Tone } from "@/components/ui/IconTile";
import { PageHeader } from "@/components/ui/PageHeader";
import { RequireAccess } from "./RequireAccess";

interface StubPageProps {
  screen: Screen;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tone?: Tone;
}

export function StubPage({ screen, title, subtitle, icon, tone = "neutral" }: StubPageProps) {
  return (
    <RequireAccess screen={screen}>
      <div className="space-y-4">
        <PageHeader title={title} subtitle={subtitle} icon={icon} tone={tone} />
        <Card as="section" ariaLabel={title}>
          <EmptyState icon={Hammer} title="This screen is built in a later step" description="It is in the navigation so roles and access can be tried today." />
        </Card>
      </div>
    </RequireAccess>
  );
}
