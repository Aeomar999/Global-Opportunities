/**
 * Dev-only demo inputs for the pipeline health card, so every state of it can be seen without changing the data.
 *
 *   /partners?health=healthy   14 open deals against 10 needed (ratio 1.4)
 *   /partners?health=thin       8 open deals against 10 needed (ratio 0.8)
 *   /partners?health=critical   4 open deals against 10 needed (ratio 0.4)
 *   /partners?health=nodata     5 open deals and no deal that reached Outreach (not enough data)
 *   /partners?health=capped    31 open deals against 10 needed (ratio 3.1): past the end of the scale, so the marker is pinned and capped
 *
 * It feeds the REAL pipelineHealth() different inputs (10 deals reached Outreach, 2 closed: a 20% close rate; target 2, so
 * 10 open deals are needed), so the card shows exactly what it would for such a pipeline. The override exists only in
 * mock mode and never in production: parseHealthOverride returns null everywhere else, so the query string is ignored.
 */
import type { PartnerStage } from "@/lib/mock-entities";
import { pipelineHealth, type PipelineHealth, type StageMove } from "@/lib/pipeline-health";

export const HEALTH_OVERRIDES = ["healthy", "thin", "critical", "nodata", "capped"] as const;
export type HealthOverride = (typeof HEALTH_OVERRIDES)[number];
/** `?health=ratio-1.05`: any ratio of open deals to deals needed (20 needed), for checking the gauge at an exact ratio. */
export type RatioOverride = `ratio-${string}`;
const RATIO_OVERRIDE = /^ratio-(\d{1,2}(?:\.\d{1,2})?)$/;
/** The deals needed that a ratio override works with (a target of 4, 10 reached Outreach and 2 closed). */
export const RATIO_NEEDED = 20;
const RATIO_TARGET = 4;

/** The override named by `?health=`, or null (also whenever it must not apply: outside mock mode, or in production). */
export function parseHealthOverride(value: string | null | undefined, mockMode: boolean, nodeEnv: string | undefined): HealthOverride | RatioOverride | null {
  if (!mockMode || nodeEnv === "production") return null;
  const named = HEALTH_OVERRIDES.find((state) => state === value);
  if (named) return named;
  return value && RATIO_OVERRIDE.test(value) ? (value as RatioOverride) : null;
}

const OPEN_DEALS: Record<HealthOverride, number> = { healthy: 14, thin: 8, critical: 4, nodata: 5, capped: 31 };
/** The target the demo uses: 2 partners next month. */
export const DEMO_TARGET = 2;

const isoDay = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;

/** The health the card shows for a demo state (a real pipelineHealth() result), and the target it was worked out for. */
export function demoHealth(state: HealthOverride | RatioOverride, today: Date = new Date()): { health: PipelineHealth; target: number } {
  const ratio = RATIO_OVERRIDE.exec(state)?.[1];
  const open = ratio !== undefined ? Math.round(Number(ratio) * RATIO_NEEDED) : OPEN_DEALS[state as HealthOverride];
  const partners: { stage: PartnerStage }[] = Array.from({ length: open }, () => ({ stage: "proposal" }));
  // Moves a month ago: well inside the six-month window.
  const at = isoDay(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, Math.min(today.getUTCDate(), 28))));
  const history: StageMove[] =
    state === "nodata"
      ? []
      : [
          ...Array.from({ length: 10 }, (_, i): StageMove => ({ partnerId: `demo-${i}`, from: "prospect", to: "outreach", at })),
          ...Array.from({ length: 2 }, (_, i): StageMove => ({ partnerId: `demo-${i}`, from: "mou", to: "onboard", at })),
        ];
  const target = ratio !== undefined ? RATIO_TARGET : DEMO_TARGET;
  return { health: pipelineHealth(partners, history, target, today), target };
}
