"use client";

/**
 * StagesTab: Settings > Pipeline stages (Desk Lead and Super Admin).
 *
 *   Pipeline stages
 *   Prospect   [ Prospect         ]
 *   Outreach   [ Outreach         ]
 *   Proposal   [ Proposal         ]
 *   MOU        [ MOU              ]
 *   Onboard    [ Onboard          ]  [lock] Counts as closed (cannot be changed)
 *   Renew      [ Renew            ]  [lock] Counts as closed (cannot be changed)
 *   [ 2 changes ]                              [ Reset ] [ Save ]       [ Reset to defaults ]
 *
 * - Only the six DISPLAY words change; the keys (prospect ... renew) are fixed, and so is what counts as closed: Onboard and Renew show a
 *   lock and say so (their name can still be changed).
 * - A name is not empty, at most 24 characters, and different from every other (case does not matter).
 * - Saving updates the store at once, so the Partners board columns, the Move menu, the filters, the gauge text and the partner's
 *   timeline all show the new words in the same render. "Reset to defaults" (with a confirmation) puts the original names back.
 */
import { useRef, useState, type FormEvent } from "react";
import { Lock, RotateCcw } from "lucide-react";
import { useSettingsDirty } from "@/components/settings/SettingsShell";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import { StickyActionBar } from "@/components/ui/form/StickyActionBar";
import { focusFirstInvalid, useTouched } from "@/components/ui/form/use-touched";
import { pluralize } from "@/lib/plural";
import { useUnsavedGuard } from "@/components/ui/form/use-unsaved-guard";
import { useToast } from "@/components/ui/Toast";
import { PARTNER_STAGES, PARTNER_STAGE_LABELS, type PartnerStage } from "@/lib/mock-entities";
import { usePartnerStageLabels } from "@/lib/mock-store";
import { CLOSED_STAGES, STAGE_LABEL_MAX, resetStageLabels, saveStageLabels, validateStageLabels } from "@/lib/services/settings";


export function StagesTab() {
  const toast = useToast();
  const saved = usePartnerStageLabels();
  const { confirm, dialog } = useConfirmDialog();
  const [labels, setLabels] = useState<Record<PartnerStage, string>>({ ...saved });
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { show, touch, touchAll, reset: resetTouched } = useTouched();

  const errors = validateStageLabels(labels);
  const changed = PARTNER_STAGES.filter((stage) => labels[stage] !== saved[stage]);
  const dirty = changed.length > 0;
  useSettingsDirty(dirty);
  const guard = useUnsavedGuard(dirty && !saving);

  const reset = () => {
    setLabels({ ...saved });
    resetTouched();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    touchAll();
    if (Object.keys(errors).length > 0) {
      focusFirstInvalid(formRef.current);
      return;
    }
    setSaving(true);
    // TODO(backend): persist this change
    await new Promise((resolve) => setTimeout(resolve, 300));
    const trimmed = Object.fromEntries(PARTNER_STAGES.map((stage) => [stage, labels[stage].trim()])) as Record<PartnerStage, string>;
    saveStageLabels(trimmed);
    setLabels(trimmed);
    resetTouched();
    setSaving(false);
    toast.success(`${pluralize(changed.length, "stage name")} saved. The Partners board now shows them.`);
  };

  const resetToDefaults = () =>
    confirm({
      title: "Reset the stage names?",
      description: "The six stages go back to their original names (Prospect, Outreach, Proposal, MOU, Onboard and Renew). The Partners board changes at once.",
      confirmLabel: "Reset to defaults",
      tone: "neutral",
      onConfirm: () => {
        // TODO(backend): persist this change
        resetStageLabels();
        setLabels({ ...PARTNER_STAGE_LABELS });
        resetTouched();
        toast.success("The stage names were reset to their defaults.");
      },
    });

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-1 flex-col">
      <div className="max-w-240">
        <Card as="section" ariaLabel="Pipeline stages">
          <CardHeader
            title="Pipeline stages"
            subtitle="The words used for the six stages of a partner deal, on the Partners board and everywhere a stage is shown."
            action={
              <Button type="button" variant="secondary" icon={RotateCcw} onClick={resetToDefaults}>
                Reset to defaults
              </Button>
            }
          />
          <ul data-testid="stages-list" className="divide-y divide-line">
            {PARTNER_STAGES.map((stage) => {
              const closed = CLOSED_STAGES.includes(stage);
              return (
                <li key={stage} data-testid={`stage-row-${stage}`} className="grid gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,0.6fr)_minmax(0,1.2fr)_minmax(0,1.2fr)] sm:items-start">
                  <p className="table-text pt-2.5 font-semibold text-ink">{PARTNER_STAGE_LABELS[stage]}</p>
                  <Field label={`Name of the ${PARTNER_STAGE_LABELS[stage]} stage`} hideLabel error={show(`s-${stage}`) || labels[stage] !== saved[stage] ? errors[stage] : undefined} helper={`Up to ${STAGE_LABEL_MAX} characters.`}>
                    <Input
                      value={labels[stage]}
                      onChange={(event) => setLabels((current) => ({ ...current, [stage]: event.target.value }))}
                      onBlur={() => touch(`s-${stage}`)}
                      maxLength={STAGE_LABEL_MAX + 10}
                      autoComplete="off"
                      data-testid={`stage-input-${stage}`}
                    />
                  </Field>
                  {closed && (
                    <p data-testid={`stage-closed-${stage}`} className="caption flex items-start gap-1.5 pt-3">
                      <Lock size={14} strokeWidth={1.75} aria-hidden="true" className="mt-px shrink-0" />
                      Counts as closed (cannot be changed)
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
      <StickyActionBar dirty={dirty} saving={saving} saveLabel="Save" cancelLabel="Reset" status={pluralize(changed.length, "change")} saveDisabled={!dirty} maxWidth="60rem" onCancel={reset} />
      {guard.dialog}
      {dialog}
    </form>
  );
}
