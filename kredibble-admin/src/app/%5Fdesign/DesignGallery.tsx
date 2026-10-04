"use client";

/**
 * DesignGallery: every shared UI component in every state, rendered twice:
 * on the page background and on the dark sidebar background.
 * Dev-only; see page.tsx. Not part of the product UI.
 */
import { useState, type ReactNode } from "react";
import {
  AlertTriangle, Bell, Briefcase, Flag, Inbox, LayoutDashboard, Search, ShieldCheck, Users,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/Avatar";
import { BarSparkline } from "@/components/ui/BarSparkline";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { CountPill } from "@/components/ui/CountPill";
import { DeltaChip } from "@/components/ui/DeltaChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { HighlightBarChart } from "@/components/ui/HighlightBarChart";
import { IconTile, type Tone } from "@/components/ui/IconTile";
import { Kbd } from "@/components/ui/Kbd";
import { Kebab } from "@/components/ui/Kebab";
import { KpiCard, KpiCardSkeleton } from "@/components/ui/KpiCard";
import { Menu, type MenuItem } from "@/components/ui/Menu";
import { ProgressRow } from "@/components/ui/ProgressRow";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tooltip } from "@/components/ui/Tooltip";

const TONES: Tone[] = ["accent", "brand", "success", "warning", "danger", "neutral"];
const STATUSES = ["approved", "pending", "rejected", "active", "suspended", "draft", "unknown-value"];

const SAMPLE_MENU: MenuItem[] = [
  { label: "Open queue", href: "/verification", icon: ShieldCheck },
  { label: "Export CSV", onSelect: () => {}, icon: Inbox },
  { label: "Unavailable action", disabled: true },
  { label: "Remove", onSelect: () => {}, danger: true, icon: AlertTriangle },
];

const BAR_DATA = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    label: `Sep ${30 - (n - 1 - i) > 0 ? 30 - (n - 1 - i) : 30 - (n - 1 - i) + 30}`,
    tooltipLabel: `${30 - (n - 1 - i) > 0 ? 30 - (n - 1 - i) : 30 - (n - 1 - i) + 30} Sep 2026`,
    value: Math.max(0, Math.round(4 + 3 * Math.sin(i / 2) + (i % 5 === 0 ? 2 : 0))),
  }));

export function DesignGallery() {
  return (
    <main className="min-h-screen">
      <div className="bg-canvas p-7">
        <h1 className="page-title">Design review</h1>
        <p className="page-subtitle mt-1">
          Every shared component in every state. Dev only: this route returns 404 in production.
        </p>
      </div>

      <Surface title="On the page background" className="bg-canvas">
        <ComponentSet dark={false} />
      </Surface>

      {/* The dark-surface class switches the focus ring to the light purple. */}
      <Surface title="On the dark sidebar background" className="dark-surface bg-sb-bg text-sb-text" dark>
        <ComponentSet dark />
      </Surface>
    </main>
  );
}

function Surface({
  title,
  className,
  dark = false,
  children,
}: {
  title: string;
  className: string;
  dark?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={cn("p-7", className)}>
      <h2 className={cn("mb-6 border-b pb-3 font-display text-lg font-bold", dark ? "border-sb-line text-sb-text" : "border-line text-ink")}>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** A labelled group of examples. */
function Group({ name, dark, children }: { name: string; dark: boolean; children: ReactNode }) {
  return (
    <div className="mb-8">
      <h3 className={cn("eyebrow mb-3", dark && "text-sb-muted")}>{name}</h3>
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </div>
  );
}

function ComponentSet({ dark }: { dark: boolean }) {
  const [range, setRange] = useState<"7" | "14" | "30">("14");

  return (
    <>
      <Group name="Button: primary / secondary / ghost / danger, then loading and disabled" dark={dark}>
        {(["primary", "secondary", "ghost", "danger"] as const).map((variant) => (
          <Button key={variant} variant={variant} onDark={dark}>
            {variant}
          </Button>
        ))}
        <Button icon={Search} variant="secondary" onDark={dark}>
          With icon
        </Button>
        <Button loading onDark={dark}>Loading</Button>
        {(["primary", "secondary", "ghost", "danger"] as const).map((variant) => (
          <Button key={`d-${variant}`} variant={variant} onDark={dark} disabled>
            {variant} disabled
          </Button>
        ))}
      </Group>

      <Group name="StatusBadge: every tone, plus an unknown value" dark={dark}>
        {STATUSES.map((status) => (
          <StatusBadge key={status} status={status} />
        ))}
      </Group>

      <Group name="DeltaChip: good vs bad, up vs down" dark={dark}>
        <DeltaChip label="-8%" direction="down" goodDirection="down" />
        <DeltaChip label="+12%" direction="up" goodDirection="up" />
        <DeltaChip label="+2" direction="up" goodDirection="down" />
        <DeltaChip label="-5%" direction="down" goodDirection="up" />
      </Group>

      <Group name="IconTile: tones x sizes, then circle and dark" dark={dark}>
        {TONES.map((tone) => (
          <IconTile key={tone} icon={Briefcase} tone={tone} />
        ))}
        {TONES.map((tone) => (
          <IconTile key={`s-${tone}`} icon={Users} tone={tone} size="sm" />
        ))}
        <IconTile icon={Flag} tone="accent" size="sm" shape="circle" />
        <IconTile icon={Flag} tone="dark" size="sm" />
      </Group>

      <Group name="Avatar and Skeleton" dark={dark}>
        <Avatar name="Nicholas Gyamfi" />
        <Avatar name="Ama Boateng" />
        <Avatar name="Kofi Mensah" size="sm" />
        <Avatar name="Local Admin" size="sm" />
        <Skeleton onDark={dark} className="h-4 w-40" />
        <Skeleton onDark={dark} className="h-9 w-24" />
        <Skeleton onDark={dark} className="size-10 rounded-full" />
      </Group>

      <Group name="Kbd, CountPill, BarSparkline" dark={dark}>
        <Kbd onDark={dark}>⌘ K</Kbd>
        <Kbd onDark={dark}>Ctrl B</Kbd>
        <CountPill count={242} onDark={dark} />
        <CountPill count={7} onDark={dark} label="pending" />
        <div className={cn("rounded-inset p-3", dark ? "bg-white/5" : "bg-surface-2")}>
          <BarSparkline values={[9, 11, 10, 14, 13, 15, 12, 14, 13, 11, 12, 18]} />
        </div>
      </Group>

      <Group name="Tooltip: forced open on each side, and a live one (hover or Tab to it)" dark={dark}>
        {(["top", "bottom", "left", "right"] as const).map((placement) => (
          <div key={placement} className="flex h-24 w-44 items-center justify-center pt-6">
            <Tooltip label={`Tooltip ${placement}`} placement={placement} forceOpen>
              <Button variant="secondary" onDark={dark}>
                {placement}
              </Button>
            </Tooltip>
          </div>
        ))}
        <Tooltip label="Notifications">
          <button
            type="button"
            aria-label="Notifications"
            className={cn("inline-flex size-10 items-center justify-center rounded-control", dark ? "text-sb-text hover:bg-white/10" : "text-ink hover:bg-neutral-soft")}
          >
            <Bell size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </Tooltip>
      </Group>

      <Group name="HighlightBarChart: 7 and 14 days (pale bars + value labels), 30 days (darker bars, label on the highlight only). Hover or focus a chart, then use the arrow keys." dark={dark}>
        {[7, 14, 30].map((n) => (
          <Card key={n} className="w-full max-w-xl">
            <HighlightBarChart data={BAR_DATA(n)} ariaLabel={`Submissions per day, ${n} days`} unit="submissions" />
          </Card>
        ))}
      </Group>

      <Group name="SegmentedControl (live)" dark={dark}>
        <SegmentedControl
          ariaLabel={`Range ${dark ? "dark" : "light"}`}
          value={range}
          onChange={setRange}
          options={[
            { value: "7", label: "7 days" },
            { value: "14", label: "14 days" },
            { value: "30", label: "30 days" },
          ]}
        />
      </Group>

      <Group name="Breadcrumbs: full trail with menu and count (narrow the window below 640px to see it collapse)" dark={dark}>
        <div className="rounded-card bg-surface px-5 py-3">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Users & Companies", menu: [{ label: "Seekers", href: "/seekers" }, { label: "Hirers", href: "/hirers" }] },
              { label: "Seekers", count: 242 },
            ]}
          />
        </div>
      </Group>

      <Group name="Menu and Kebab: closed, then open (live: click, then use the arrow keys, Esc)" dark={dark}>
        <Menu label="Sample menu" items={SAMPLE_MENU} triggerClassName="button-text inline-flex h-10 items-center rounded-control border border-line-strong bg-surface px-4 text-ink hover:bg-surface-2">
          Open menu
        </Menu>
        <Kebab label="More actions" items={SAMPLE_MENU} onDark={dark} />
        <div className="h-64 w-56">
          <Menu label="Open by default" items={SAMPLE_MENU} defaultOpen triggerClassName="button-text inline-flex h-10 items-center rounded-control border border-line-strong bg-surface px-4 text-ink">
            Open state
          </Menu>
        </div>
      </Group>

      <Group name="ProgressRow: tones and unknown" dark={dark}>
        <Card className="w-80">
          <div className="space-y-5">
            <ProgressRow label="Verification reviewed" percent={78} caption="94 of 120 requests decided" />
            <ProgressRow label="Opportunities moderated" percent={64} caption="48 of 75 postings decided" tone="brand" />
            <ProgressRow label="Reports resolved" percent={91} caption="61 of 67 reports closed" tone="accent-light" />
            <ProgressRow label="Unknown queue" percent={null} caption="Could not load" />
          </div>
        </Card>
      </Group>

      <Group name="Card and CardHeader" dark={dark}>
        <Card className="w-80">
          <CardHeader title="Review queues" subtitle="How much of each queue has been decided" action={<a href="#" className="hover:underline">See more</a>} />
          <p className="body-sm text-muted">Card body text, Inter 13/18.</p>
        </Card>
        <Card className="w-80" flush>
          <div className="table-head bg-surface-2 px-5 py-2">Flush card (tables)</div>
          <div className="table-text px-5 py-4">Row content runs edge to edge.</div>
        </Card>
      </Group>

      <Group name="KpiCard: with trend and delta + kebab / bad delta / no data (—) / no delta / skeleton" dark={dark}>
        <div className="w-72">
          <KpiCard
            href="/verification"
            label="Pending verification"
            icon={ShieldCheck}
            value={12}
            trend={[9, 11, 10, 14, 13, 15, 12, 14, 13, 11, 12, 12]}
            delta={{ label: "-8%", direction: "down", goodDirection: "down", caption: "vs. last month" }}
            actions={SAMPLE_MENU}
          />
        </div>
        <div className="w-72">
          <KpiCard
            href="/reports"
            label="Open reports"
            icon={Flag}
            tone="brand"
            value={7}
            trend={[4, 5, 5, 6, 8, 7, 9, 8, 7, 8, 6, 7]}
            delta={{ label: "+2", direction: "up", goodDirection: "down", caption: "this month" }}
          />
        </div>
        <div className="w-72">
          <KpiCard href="/seekers" label="Active seekers" icon={Users} value={null} />
        </div>
        <div className="w-72">
          <KpiCard href="/hirers" label="Active hirers" value={1284} />
        </div>
        <div className="w-72">
          <KpiCardSkeleton />
        </div>
      </Group>

      <Group name="EmptyState: neutral and error" dark={dark}>
        <Card className="w-96" flush>
          <EmptyState icon={LayoutDashboard} title="No submissions in this period" description="New verification requests and postings will appear here." />
        </Card>
        <Card className="w-96" flush>
          <EmptyState
            icon={AlertTriangle}
            tone="danger"
            title="Could not load this section"
            description="Authentication token is required"
            action={<Button variant="secondary">Try again</Button>}
          />
        </Card>
      </Group>
    </>
  );
}
