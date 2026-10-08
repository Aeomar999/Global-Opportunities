"use client";

/**
 * ZoneGauge: a thin three-zone bar that says where a number stands (the pipeline health on Partners, the verification pace on
 * Database). One component, so both look and behave the same:
 *
 *     3 needed         <- tick label (optional), right above its tick
 *   13 open  >  4.3x needed   <- marker label; when the value is past the end of the scale the marker is pinned to the right
 *   [ critical ][ thin ][     healthy      ]    end with a chevron and the multiple, so it is clear the bar is capped
 *    Critical     Thin      Healthy             <- the zone words, so colour is never the only signal
 *
 * - The bar is a role="meter" (aria-valuemin / max / now / text), so a screen reader hears the real numbers and the status.
 * - Each zone is the status BACKGROUND colour (the same tint as the status chips) with a full-colour 1px edge (the edge keeps 3:1
 *   against white). Each zone word is centred under its own zone.
 * - The marker is a 12px-wide pill; its label sits above it. When the marker and the tick are closer than 72px (measured, so
 *   it follows the width of the bar) the labels are STAGGERED: the tick label stays above the bar and the marker label moves
 *   BELOW the zone words, so they can never overlap.
 *
 * Props:
 * - zones: three { key, label, tone, percent } (the percents add up to 100) left to right
 * - meter: { label, min, max, now, text } (the aria values)
 * - markerAt: 0 to 100 along the bar, or null for no marker; markerLabel: the words above it
 * - capped: { text } when the value is beyond the end of the scale: the marker is pinned to the right end, a small right arrow
 *   sits beside it, and the label reads "13 open · 4.3× the target"
 * - hint: what the zones mean in numbers (the thresholds, from config). It is the tooltip of the zone words (hover and keyboard focus).
 * - tickAt / tickLabel: a tick (for example where "needed" is), with its label
 * - testIds: { gauge, marker, markerLabel, tick, tickLabel, labels, capped } (each optional)
 */
import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";

export interface GaugeZone {
  key: string;
  label: string;
  tone: "danger" | "warning" | "success";
  percent: number;
  testId?: string;
}

interface ZoneGaugeProps {
  zones: readonly GaugeZone[];
  meter: { label: string; min: number; max: number; now: number; text: string };
  markerAt: number | null;
  markerLabel?: string;
  capped?: { text: string };
  hint?: string;
  tickAt?: number | null;
  tickLabel?: string;
  testIds?: { gauge?: string; marker?: string; markerLabel?: string; tick?: string; tickLabel?: string; labels?: string; capped?: string; arrow?: string };
}

const ZONE_CLASS: Record<GaugeZone["tone"], string> = {
  danger: "bg-danger-soft ring-danger",
  warning: "bg-warning-soft ring-warning",
  success: "bg-success-soft ring-success",
};

type Align = "left" | "center" | "right";
/** Closer than this many pixels, the marker label and the tick label are staggered (the tick label above, the marker label below). */
export const STAGGER_PX = 72;

/** Where a label sits against its anchor: centred, unless it would run off an end of the bar. */
function alignFor(at: number): Align {
  if (at > 88) return "right";
  if (at < 12) return "left";
  return "center";
}

/** The label's transform for an alignment: its edge sits at the anchor (with the marker's half width) or it is centred. */
const SHIFT: Record<Align, string> = { left: "translateX(-6px)", center: "translateX(-50%)", right: "translateX(calc(-100% + 6px))" };
const TICK_SHIFT: Record<Align, string> = { left: "translateX(4px)", center: "translateX(-50%)", right: "translateX(calc(-100% - 4px))" };

export function ZoneGauge({ zones, meter, markerAt, markerLabel, capped, hint, tickAt = null, tickLabel, testIds = {} }: ZoneGaugeProps) {
  const [width, setWidth] = useState(0);
  const gaugeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = gaugeRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(el.getBoundingClientRect().width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const markerAlign = markerAt === null ? "center" : alignFor(markerAt);
  const tickAlign: Align = "center";
  // Staggered: the labels' anchors are closer than 72px along the bar, or the two labels (their width estimated from the text,
  // about 6.8px a character at 12px) would run into each other, whatever their anchors.
  let staggered = false;
  if (markerAt !== null && tickAt !== null && markerLabel && tickLabel && width > 0) {
    const markerX = (markerAt / 100) * width;
    const tickX = (tickAt / 100) * width;
    const markerW = (markerLabel.length + (capped ? capped.text.length + 3 : 0)) * 6.8;
    const tickW = tickLabel.length * 6.8;
    const markerLeft = markerAlign === "center" ? markerX - markerW / 2 : markerAlign === "right" ? markerX + 6 - markerW : markerX - 6;
    const tickLeft = tickX - tickW / 2;
    const clear = markerLeft + markerW + 8 <= tickLeft || tickLeft + tickW + 8 <= markerLeft;
    staggered = Math.abs(markerX - tickX) < STAGGER_PX || !clear;
  }

  return (
    <div>
      <div ref={gaugeRef} data-testid={testIds.gauge} data-staggered={staggered ? "true" : "false"} className="relative pt-4">
        {tickAt !== null && (
          <>
            {tickLabel && (
              <span
                aria-hidden="true"
                data-testid={testIds.tickLabel}
                className="caption absolute top-0 whitespace-nowrap leading-3"
                // Data-driven position: the one legitimate inline style.
                style={{ left: `${tickAt}%`, transform: TICK_SHIFT[tickAlign] }}
              >
                {tickLabel}
              </span>
            )}
            <span
              aria-hidden="true"
              data-testid={testIds.tick}
              className="absolute top-3.5 h-4.5 w-px -translate-x-1/2 bg-ink/60"
              style={{ left: `${tickAt}%` }}
            />
          </>
        )}
        {markerAt !== null && markerLabel && !staggered && (
          <span
            aria-hidden="true"
            data-testid={testIds.markerLabel}
            className="caption absolute top-0 inline-flex items-center whitespace-nowrap font-semibold leading-3 text-ink"
            style={{ left: `${markerAt}%`, transform: SHIFT[markerAlign] }}
          >
            {markerLabel}
            {capped && (
              <>
                <span aria-hidden="true" className="whitespace-pre font-normal text-muted"> · </span>
                <span data-testid={testIds.capped} className="font-normal text-muted">
                  {capped.text}
                </span>
              </>
            )}
          </span>
        )}
        <div
          role="meter"
          aria-label={meter.label}
          aria-valuemin={meter.min}
          aria-valuemax={meter.max}
          aria-valuenow={meter.now}
          aria-valuetext={meter.text}
          className="flex h-3 overflow-hidden rounded-pill"
        >
          {zones.map((zone) => (
            <span
              key={zone.key}
              aria-hidden="true"
              data-testid={zone.testId}
              className={cn("ring-1 ring-inset", ZONE_CLASS[zone.tone])}
              style={{ flexBasis: `${zone.percent}%` }}
            />
          ))}
        </div>
        {capped && markerAt !== null && (
          // The bar is cut off here: a small arrow beside the marker says there is more beyond the end.
          <ArrowRight
            data-testid={testIds.arrow}
            size={14}
            strokeWidth={2.25}
            aria-hidden="true"
            className="absolute top-4 -translate-x-full -ml-3 text-ink"
            style={{ left: `${markerAt}%` }}
          />
        )}
        {markerAt !== null && (
          <span
            aria-hidden="true"
            data-testid={testIds.marker}
            className="absolute top-3.5 h-4 w-3 -translate-x-1/2 rounded-pill bg-ink ring-2 ring-surface"
            style={{ left: `${markerAt}%` }}
          />
        )}
      </div>
      {/* The zone names sit under their zones, so the colours always come with words. */}
      <Tooltip label={hint ?? ""} disabled={!hint} placement="bottom" wrap wrapperClassName="flex w-full">
        <div role="group" aria-label={hint ? `Zones. ${hint}` : undefined} tabIndex={hint ? 0 : undefined} data-testid={testIds.labels} className="caption flex w-full rounded-inset">
          {zones.map((zone) => (
            <span key={zone.key} className="min-w-0 text-center" style={{ flexBasis: `${zone.percent}%` }}>
              {zone.label}
            </span>
          ))}
        </div>
      </Tooltip>
      {markerAt !== null && markerLabel && staggered && (
        // Staggered: below the zone words, centred (or against the end) at the marker.
        <div className="relative h-4">
          <span
            aria-hidden="true"
            data-testid={testIds.markerLabel}
            className="caption absolute top-0 inline-flex items-center whitespace-nowrap font-semibold leading-4 text-ink"
            style={{ left: `${markerAt}%`, transform: SHIFT[markerAlign] }}
          >
            {markerLabel}
            {capped && (
              <>
                <span aria-hidden="true" className="whitespace-pre font-normal text-muted"> · </span>
                <span data-testid={testIds.capped} className="font-normal text-muted">
                  {capped.text}
                </span>
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
