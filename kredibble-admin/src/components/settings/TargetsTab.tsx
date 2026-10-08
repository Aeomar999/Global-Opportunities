"use client";

/**
 * TargetsTab: Settings > Targets (Desk Lead and Super Admin).
 *
 *   Monthly targets                                  New targets apply from [ October 2026 v ]
 *   KPI                       Owners                       Monthly target
 *   Opportunities published   Opportunities Officer        [ 2 ]  ● changed
 *   ...ten rows, one for each KPI in config/kpis.ts...
 *   Status thresholds         Green from [ 95 ] %   Amber from [ 70 ] %
 *   With a target of 12,000, an output of 9,000 is On track on the 20th of a 30-day month      <- worked out live with kpiStatus
 *   [ 3 changes ]                                                          [ Reset ] [ Save ]
 *
 * - Targets are whole numbers from 1 to 10,000,000. A row that differs from the saved target has a "changed" dot.
 * - THE PAST IS NEVER REWRITTEN: saving adds {kpi, value, effectiveFrom} rows to the target history (services/settings.ts). The month in
 *   "New targets apply from" (this month by default; or one of the next two) decides where the new targets start; every earlier month keeps
 *   the target that applied then. Everything that reads a target goes through kpiTarget(key, data, month).
 * - Thresholds: green and amber percentages of the pro-rated target, whole numbers from 1 to 200, amber below green. They are DATED like the
 *   targets: the same "New targets apply from" month covers both, a save appends a row to the threshold history, and a month before it keeps the
 *   thresholds it had. The live example uses the thresholds being typed.
 * - Under the table, "Change history" lists every saved change to a target or the thresholds, newest first, with who made it.
 * - The bar shows "N changes", Reset (puts every field back to what is saved) and Save. Errors show after a field is left and on save; the
 *   first invalid field takes focus. Leaving with unsaved changes asks first.
 */
import { useMemo, useRef, useState, type FormEvent } from "react";
import { useSettingsDirty } from "@/components/settings/SettingsShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import { ChangeHistory } from "@/components/settings/ChangeHistory";
import { Select, type SelectOption } from "@/components/ui/form/Select";
import { StickyActionBar } from "@/components/ui/form/StickyActionBar";
import { focusFirstInvalid, useTouched } from "@/components/ui/form/use-touched";
import { pluralize } from "@/lib/plural";
import { useUnsavedGuard } from "@/components/ui/form/use-unsaved-guard";
import { TagPill } from "@/components/ui/TagPill";
import { useToast } from "@/components/ui/Toast";
import { type KpiKey } from "@/config/kpis";
import { currentMonth } from "@/lib/kpi";
import { formatMonth } from "@/lib/format";
import { useMockCollection, useMockStoreVersion } from "@/lib/mock-store";
import {
  changeHistory,
  effectiveFromOptions,
  scheduledThresholds,
  parseTarget,
  saveSummary,
  saveTargets,
  saveThresholds,
  targetRows,
  thresholdExample,
  thresholdPercents,
  validateTarget,
  validateThresholds,
} from "@/lib/services/settings";


export function TargetsTab() {
  const toast = useToast();
  const history = useMockCollection("targetHistory"); // re-render when a target is saved
  const storeVersion = useMockStoreVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const saved = useMemo(() => targetRows(), [storeVersion]);
  useMockCollection("thresholdHistory"); // re-render when thresholds are saved
  const [savedThresholds, setSavedThresholds] = useState(() => thresholdPercents()); // what the fields were last saved (or loaded) with

  // What the fields were last saved (or loaded) with. A target saved to start in a later month is still "saved": the form is clean again.
  const [baseline, setBaseline] = useState<Record<string, number>>(() => Object.fromEntries(saved.map((row) => [row.key, row.target])));
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(saved.map((row) => [row.key, String(row.target)])));
  const [green, setGreen] = useState(String(savedThresholds.green));
  const [amber, setAmber] = useState(String(savedThresholds.amber));
  const [effectiveFrom, setEffectiveFrom] = useState(currentMonth());
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { show, touch, touchAll, reset: resetTouched } = useTouched();

  const targetError = (key: KpiKey) => validateTarget(values[key] ?? "");
  const changedKeys = saved.filter((row) => values[row.key] !== String(baseline[row.key]) && !targetError(row.key) && parseTarget(values[row.key]) !== baseline[row.key]).map((row) => row.key);
  const untidy = saved.filter((row) => values[row.key] !== String(baseline[row.key]) && targetError(row.key)).map((row) => row.key); // typed but not valid
  // targets already saved to start in a later month
  const scheduled = history
    .filter((entry) => entry.effectiveFrom > currentMonth())
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
    .reduce<Record<string, { value: number; from: string }>>((all, entry) => (all[entry.kpi] ? all : { ...all, [entry.kpi]: { value: entry.value, from: entry.effectiveFrom } }), {});
  const thresholdErrors = validateThresholds(green, amber);
  const thresholdsChanged = !thresholdErrors.green && !thresholdErrors.amber && (Number(green) !== savedThresholds.green || Number(amber) !== savedThresholds.amber);
  const thresholdsTouched = green !== String(savedThresholds.green) || amber !== String(savedThresholds.amber);
  const changeCount = changedKeys.length + untidy.length + (thresholdsChanged ? 1 : thresholdsTouched ? 1 : 0);
  const dirty = changeCount > 0;
  useSettingsDirty(dirty);
  const guard = useUnsavedGuard(dirty && !saving);

  const options: SelectOption<string>[] = effectiveFromOptions().map((month) => ({ value: month, label: formatMonth(month), badge: month === currentMonth() ? "This month" : undefined }));
  const hasErrors = saved.some((row) => targetError(row.key)) || !!thresholdErrors.green || !!thresholdErrors.amber;

  const example = !thresholdErrors.green && !thresholdErrors.amber ? thresholdExample(Number(green), Number(amber)) : thresholdExample(savedThresholds.green, savedThresholds.amber);

  const reset = () => {
    setValues(Object.fromEntries(saved.map((row) => [row.key, String(baseline[row.key])])));
    setGreen(String(savedThresholds.green));
    setAmber(String(savedThresholds.amber));
    setEffectiveFrom(currentMonth());
    resetTouched();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    touchAll();
    if (hasErrors) {
      focusFirstInvalid(formRef.current);
      return;
    }
    setSaving(true);
    // TODO(backend): persist this change (the new targets with their effective-from month, and the thresholds)
    await new Promise((resolve) => setTimeout(resolve, 400));
    const changes = changedKeys.map((key) => ({ kpi: key, value: parseTarget(values[key]) }));
    saveTargets(changes, effectiveFrom);
    setBaseline((current) => ({ ...current, ...Object.fromEntries(changes.map((change) => [change.kpi, change.value])) }));
    if (thresholdsChanged) {
      saveThresholds(Number(green), Number(amber), effectiveFrom);
      setSavedThresholds({ green: Number(green), amber: Number(amber) });
    }
    // the fields show what was saved (numbers without stray spaces or commas)
    setValues((current) => Object.fromEntries(saved.map((row) => [row.key, changes.some((c) => c.kpi === row.key) ? String(parseTarget(current[row.key])) : current[row.key]])));
    resetTouched();
    setSaving(false);
    toast.success(`${saveSummary(changes, thresholdsChanged, effectiveFrom)}.`);
  };

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-1 flex-col">
      <div className="max-w-240 space-y-4">
        <Card as="section" ariaLabel="Monthly targets">
          <CardHeader
            title="Monthly targets"
            subtitle="What the desk aims for each month. A new target starts in the month you choose; earlier months keep the target they had."
            action={undefined}
          />
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span id="effective-from-label" className="field-label text-ink">
              New targets apply from
            </span>
            <Select options={options} value={effectiveFrom} onChange={setEffectiveFrom} ariaLabel="New targets apply from" sheetTitle="New targets apply from" className="w-fit" />
          </div>
          <ul data-testid="targets-list" className="divide-y divide-line">
            {saved.map((row) => {
              const changed = values[row.key] !== String(baseline[row.key]);
              return (
                <li key={row.key} data-testid={`target-row-${row.key}`} className="grid gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1fr)] sm:items-start">
                  <div className="min-w-0">
                    <p className="table-text font-semibold text-ink">{row.label}</p>
                    <p className="caption">Counted in {row.unit}</p>
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5" aria-label={`Owners of ${row.label}`}>
                    {row.owners.length === 0 ? <span className="caption">The Desk Lead</span> : row.owners.map((owner) => <TagPill key={owner.id}>{owner.label}</TagPill>)}
                  </div>
                  <div className="min-w-0">
                    <Field label={`${row.label}, monthly target`} hideLabel error={show(`t-${row.key}`) || changed ? targetError(row.key) : undefined}>
                      <div className="flex items-center gap-2">
                        <Input
                          inputMode="numeric"
                          value={values[row.key] ?? ""}
                          onChange={(event) => setValues((current) => ({ ...current, [row.key]: event.target.value }))}
                          onBlur={() => touch(`t-${row.key}`)}
                          autoComplete="off"
                          data-testid={`target-input-${row.key}`}
                        />
                        <span className="flex size-4 shrink-0 items-center justify-center">
                          {changed && (
                            <span data-testid={`changed-dot-${row.key}`} role="img" aria-label="Changed" className="size-2 rounded-pill bg-warning-dot" />
                          )}
                        </span>
                      </div>
                    </Field>
                    {scheduled[row.key] && (
                      <p data-testid={`scheduled-${row.key}`} className="caption mt-1">
                        Changes to {scheduled[row.key].value.toLocaleString("en-US")} from {formatMonth(scheduled[row.key].from)}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card as="section" ariaLabel="Status thresholds">
          <CardHeader title="Status thresholds" subtitle="How far a result is from its pro-rated target before it turns amber or red." />
          <div className="grid max-w-md gap-4 sm:grid-cols-2">
            <Field label="Green from (%)" error={show("green") || green !== String(savedThresholds.green) ? thresholdErrors.green : undefined} helper="At or above this share of the target so far.">
              <Input inputMode="numeric" value={green} onChange={(event) => setGreen(event.target.value)} onBlur={() => touch("green")} autoComplete="off" />
            </Field>
            <Field label="Amber from (%)" error={show("amber") || amber !== String(savedThresholds.amber) ? thresholdErrors.amber : undefined} helper="Below green, at or above this. Lower is red.">
              <Input inputMode="numeric" value={amber} onChange={(event) => setAmber(event.target.value)} onBlur={() => touch("amber")} autoComplete="off" />
            </Field>
          </div>
          {scheduledThresholds() && (
            <p data-testid="scheduled-thresholds" className="caption mt-3">
              Changes to green {scheduledThresholds()!.green}%, amber {scheduledThresholds()!.amber}% from {formatMonth(scheduledThresholds()!.from)}
            </p>
          )}
          <p data-testid="threshold-example" aria-live="polite" className="body-sm mt-4 rounded-inset bg-surface-2 px-3 py-2 text-ink">
            {example}
          </p>
        </Card>
        <ChangeHistory rows={changeHistory()} />
      </div>

      <StickyActionBar
        dirty={dirty}
        saving={saving}
        saveLabel="Save"
        cancelLabel="Reset"
        status={pluralize(changeCount, "change")}
        saveDisabled={!dirty}
        maxWidth="60rem"
        onCancel={reset}
      />
      {guard.dialog}
    </form>
  );
}
