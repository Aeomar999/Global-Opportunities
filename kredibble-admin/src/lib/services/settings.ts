/**
 * Settings service: what the Settings screen reads and writes. One function per need; the screen never touches the store or the seed.
 * Everything lives in the shared in-memory mock store (or, for the secrets, in the module below), so a change shows everywhere in the same
 * render. TODO(backend): every write below must be persisted by the API.
 *
 * - TARGETS. A save never rewrites the past: it ADDS {kpi, value, effectiveFrom} rows to the target history (a second save for the same
 *   KPI and month is another row, and the later one wins; no row is ever edited), and kpiTarget(key, data, month) (lib/kpi.ts) reads the one
 *   that applied in a month. So the pace gauge, the pipeline health, the Social captions and every KPI status recompute at once for the
 *   months from effectiveFrom, and earlier months keep the target they had.
 * - THRESHOLDS: green and amber as percentages of the pro-rated target. Amber must be below green; both are whole numbers from 1 to 200.
 *   They are DATED like the targets: a save appends a thresholdHistory row with the same effective-from month, and kpiThresholds(month)
 *   (lib/kpi.ts) reads the ones that applied in a month, so a past month keeps its thresholds.
 * - CHANGE HISTORY: changeHistory() lists every saved change (targets and thresholds together), newest first, with who made it.
 * - STAGE LABELS: the six display words of the partner stages (the keys are fixed). Not empty, no two the same (case does not matter),
 *   at most 24 characters. Reset puts the defaults back.
 * - INTEGRATIONS: the WordPress credential and the Google Analytics connection are WRITE-ONLY. saveCredential() reads the secret, keeps
 *   NOTHING of it except the last four characters (so the screen can say "Saved · ends in ••••3f9a") and forgets the rest. No function here
 *   returns, logs or stores the value, and testConnection() never uses it: it is a mock that succeeds after 800 ms.
 * - MY ACCOUNT: the person's name and the notification preferences (mock saves), the password check (never stored).
 */
import { KPI_KEYS, KPIS, type KpiKey } from "@/config/kpis";
import { ROLES, type Role } from "@/config/roles";
import { formatMonth } from "@/lib/format";
import { KPI_STATUS_LABELS } from "@/lib/status-map";
import { currentMonth, kpiStatus, kpiTarget, kpiThresholds, monthsBefore } from "@/lib/kpi";
import { PARTNER_STAGES, PARTNER_STAGE_LABELS, type KpiThresholds, type MonthKey, type PartnerStage, type TargetChange, type ThresholdChange } from "@/lib/mock-entities";
import { getMockCollection, getPartnerStageLabels, setMockCollection, setPartnerStageLabels } from "@/lib/mock-store";
import { currentStaffMember, todayIsoDate } from "@/lib/services/listings";
import { saveTargetsApi, saveThresholdsApi, updatePipelineStagesApi, hasAdminSession } from "@/lib/api";
import { isMockMode } from "@/lib/services/mock-mode";

// ---- targets ----------------------------------------------------------------------------------------------------------

export const TARGET_MAX = 10_000_000;

export interface TargetRow {
  key: KpiKey;
  label: string;
  unit: string;
  /** The target in force this month. */
  target: number;
  owners: { id: Role; label: string }[];
}

/** One row for each KPI, with the target in force in `month` (default: this month). */
export function targetRows(month: MonthKey = currentMonth()): TargetRow[] {
  return KPI_KEYS.map((key) => ({
    key,
    label: KPIS[key].label,
    unit: KPIS[key].unit,
    target: kpiTarget(key, undefined, month),
    owners: KPIS[key].owners.map((id) => ({ id, label: ROLES[id].label })),
  }));
}

/** A target as typed: a whole number from 1 to 10,000,000 (commas and spaces are fine). Returns the message, or undefined when it is fine. */
export function validateTarget(text: string): string | undefined {
  const cleaned = text.replace(/[,\s]/g, "");
  if (!cleaned) return "Enter a target.";
  if (!/^\d+$/.test(cleaned)) return "A target is a whole number.";
  const value = Number(cleaned);
  if (value < 1) return "A target is at least 1.";
  if (value > TARGET_MAX) return `A target is at most ${TARGET_MAX.toLocaleString("en-US")}.`;
  return undefined;
}

export const parseTarget = (text: string): number => Number(text.replace(/[,\s]/g, ""));

/** The months a new target can start from: this month and the two after it (never the past). */
export function effectiveFromOptions(today: Date = new Date()): MonthKey[] {
  const now = currentMonth(today);
  return [now, monthsBefore(now, -1), monthsBefore(now, -2)];
}

/** The next number in the order of saving, across targets and thresholds together. */
const nextSeq = (): number => Math.max(0, ...getMockCollection("targetHistory").map((row) => row.seq ?? 0), ...getMockCollection("thresholdHistory").map((row) => row.seq ?? 0)) + 1;

/** The name put on a saved change: the signed-in person (the dev user in mock mode). */
const changer = (): string => currentStaffMember()?.name ?? "Unknown";

/**
 * Saves changed targets from a month. Returns how many were saved. Rows are only ever APPENDED: none is edited, so every earlier month keeps
 * the target it had, and the Change history shows each save (with the target that was in force before it, who saved it and when).
 */
export function saveTargets(changes: { kpi: KpiKey; value: number }[], effectiveFrom: MonthKey): number {
  if (changes.length === 0) return 0;
  const history = getMockCollection("targetHistory");
  const base = nextSeq();
  const added: TargetChange[] = changes.map((change, index) => ({
    id: `tch-${history.length + index + 1}-${change.kpi}-${effectiveFrom}`,
    kpi: change.kpi,
    value: change.value,
    effectiveFrom,
    previous: kpiTarget(change.kpi, undefined, effectiveFrom),
    changedBy: changer(),
    changedAt: todayIsoDate(),
    seq: base + index,
  }));
  setMockCollection("targetHistory", [...history, ...added], { always: true });

  // BE-002: Persist to backend API when connected or in real mode
  if (typeof window !== "undefined" && (!isMockMode() || hasAdminSession())) {
    saveTargetsApi(effectiveFrom, changes.map((c) => ({ kpi: c.kpi, value: c.value }))).catch((err) => {
      console.warn("Could not persist targets to backend API", err);
    });
  }

  return changes.length;
}

// ---- thresholds -------------------------------------------------------------------------------------------------------

export const THRESHOLD_MIN = 1;
export const THRESHOLD_MAX = 200;

/** The thresholds as whole percentages: { green: 95, amber: 70 }. Default: the ones in force in `month` (this month). */
export const thresholdPercents = (thresholds: KpiThresholds = kpiThresholds(currentMonth())) => ({ green: Math.round(thresholds.green * 100), amber: Math.round(thresholds.amber * 100) });

/** The messages for the two percentages as typed (whole numbers from 1 to 200; amber below green). */
export function validateThresholds(green: string, amber: string): { green?: string; amber?: string } {
  const errors: { green?: string; amber?: string } = {};
  const check = (text: string, name: string) => {
    const cleaned = text.trim();
    if (!cleaned) return `Enter the ${name} percentage.`;
    if (!/^\d+$/.test(cleaned)) return "Use a whole number.";
    const value = Number(cleaned);
    if (value < THRESHOLD_MIN || value > THRESHOLD_MAX) return `Use a number from ${THRESHOLD_MIN} to ${THRESHOLD_MAX}.`;
    return undefined;
  };
  errors.green = check(green, "green");
  errors.amber = check(amber, "amber");
  if (!errors.green && !errors.amber && Number(amber) >= Number(green)) errors.amber = "Amber must be below green.";
  if (!errors.green) delete errors.green;
  if (!errors.amber) delete errors.amber;
  return errors;
}

/**
 * Saves new thresholds from a month (the same month as the targets of the same save). It APPENDS a row to the threshold history and never edits
 * an earlier one, so a past month is judged with the thresholds it had.
 */
export function saveThresholds(green: number, amber: number, effectiveFrom: MonthKey): void {
  const history = getMockCollection("thresholdHistory");
  const row: ThresholdChange = {
    id: `thr-${history.length + 1}-${effectiveFrom}`,
    green: green / 100,
    amber: amber / 100,
    effectiveFrom,
    previous: kpiThresholds(effectiveFrom),
    changedBy: changer(),
    changedAt: todayIsoDate(),
    seq: nextSeq(),
  };
  setMockCollection("thresholdHistory", [...history, row], { always: true });

  // BE-003: Persist to backend API when connected or in real mode
  if (typeof window !== "undefined" && (!isMockMode() || hasAdminSession())) {
    saveThresholdsApi(green, amber, effectiveFrom).catch((err) => {
      console.warn("Could not persist thresholds to backend API", err);
    });
  }
}

/** The thresholds already saved to start in a LATER month (the newest of them), or undefined. */
export function scheduledThresholds(month: MonthKey = currentMonth()): { green: number; amber: number; from: MonthKey } | undefined {
  const later = getMockCollection("thresholdHistory").filter((row) => row.effectiveFrom > month);
  const row = later.reduce<ThresholdChange | undefined>((best, entry) => (!best || entry.effectiveFrom >= best.effectiveFrom ? entry : best), undefined);
  return row ? { green: Math.round(row.green * 100), amber: Math.round(row.amber * 100), from: row.effectiveFrom } : undefined;
}

// ---- change history ---------------------------------------------------------------------------------------------------

export interface HistoryRow {
  id: string;
  kind: "target" | "thresholds";
  /** The day it was saved ("YYYY-MM-DD"). */
  changedAt: string;
  /** What changed: "Social reach target" or "Status thresholds". */
  what: string;
  oldValue: string;
  newValue: string;
  effectiveFrom: MonthKey;
  changedBy: string;
  /** The change in one sentence: "Thresholds changed from November 2026" or "Social reach target changed to 12,000 from November 2026". */
  summary: string;
  /** True when a LATER save for the same KPI (or for the thresholds) has the same effective-from month: this row was replaced, but it stays and keeps its values. */
  replaced: boolean;
}

/** What one save touched, in words: the toast after saving. One target: "Social reach target changed to 12,000 from November 2026"; only thresholds: "Thresholds changed from November 2026"; several: "2 targets and the thresholds changed". */
export function saveSummary(changes: { kpi: KpiKey; value: number }[], thresholdsChanged: boolean, month: MonthKey): string {
  const from = formatMonth(month);
  if (changes.length === 0) return `Thresholds changed from ${from}`;
  if (changes.length === 1 && !thresholdsChanged) return `${KPIS[changes[0].kpi].label} target changed to ${changes[0].value.toLocaleString("en-US")} from ${from}`;
  const targets = changes.length === 1 ? `${KPIS[changes[0].kpi].label} target` : `${changes.length} targets`;
  return thresholdsChanged ? `${targets} and the thresholds changed` : `${targets} changed from ${from}`;
}

const percentPair = (t: KpiThresholds) => `Green ${Math.round(t.green * 100)}%, amber ${Math.round(t.amber * 100)}%`;

/**
 * Every saved change, targets and thresholds in ONE list, newest first (the one saved last first). The starting thresholds of the seed are not a
 * change (they have no "previous"), so a desk that has changed nothing has an empty list.
 */
export function changeHistory(): HistoryRow[] {
  const targetRows = getMockCollection("targetHistory");
  const thresholdRows = getMockCollection("thresholdHistory");
  const replacedTarget = (entry: TargetChange) => targetRows.some((other) => other.kpi === entry.kpi && other.effectiveFrom === entry.effectiveFrom && (other.seq ?? 0) > (entry.seq ?? 0));
  const replacedThresholds = (entry: ThresholdChange) => thresholdRows.some((other) => other.effectiveFrom === entry.effectiveFrom && (other.seq ?? 0) > (entry.seq ?? 0));
  const targets = getMockCollection("targetHistory").map((entry): { at: number; row: HistoryRow } | null =>
    entry.previous === undefined
      ? null
      : {
          at: entry.seq ?? 0,
          row: {
            id: entry.id,
            kind: "target",
            changedAt: entry.changedAt ?? "",
            what: `${KPIS[entry.kpi].label} target`,
            oldValue: entry.previous.toLocaleString("en-US"),
            newValue: entry.value.toLocaleString("en-US"),
            effectiveFrom: entry.effectiveFrom,
            changedBy: entry.changedBy ?? "Unknown",
            summary: saveSummary([{ kpi: entry.kpi, value: entry.value }], false, entry.effectiveFrom),
            replaced: replacedTarget(entry),
          },
        },
  );
  const thresholds = getMockCollection("thresholdHistory").map((entry): { at: number; row: HistoryRow } | null =>
    entry.previous === undefined
      ? null
      : {
          at: entry.seq ?? 0,
          row: {
            id: entry.id,
            kind: "thresholds",
            changedAt: entry.changedAt ?? "",
            what: "Status thresholds",
            oldValue: percentPair(entry.previous),
            newValue: percentPair(entry),
            effectiveFrom: entry.effectiveFrom,
            changedBy: entry.changedBy ?? "Unknown",
            summary: saveSummary([], true, entry.effectiveFrom),
            replaced: replacedThresholds(entry),
          },
        },
  );
  // Newest first: the one saved last first (the order of saving is the `seq` number shared by targets and thresholds).
  return [...targets, ...thresholds]
    .filter((item): item is { at: number; row: HistoryRow } => item !== null)
    .sort((a, b) => b.at - a.at)
    .map((item) => item.row);
}

/** The words for a KPI status, in sentences. */
export const KPI_STATUS_WORDS = KPI_STATUS_LABELS;

/**
 * The live example under the threshold fields: "With a target of 12,000, an output of 9,000 is On track on the 20th of a 30-day month". The
 * status is worked out with kpiStatus() and the thresholds being typed, so it follows them as they change.
 */
export function thresholdExample(green: number, amber: number, target = 12000, output = 9000, day = 20, daysInMonth = 30): string {
  const status = kpiStatus(output, target, day, daysInMonth, { green: green / 100, amber: amber / 100 });
  return `With a target of ${target.toLocaleString("en-US")}, an output of ${output.toLocaleString("en-US")} is ${KPI_STATUS_WORDS[status]} on the ${day}th of a ${daysInMonth}-day month`;
}

// ---- pipeline stage labels --------------------------------------------------------------------------------------------

export const STAGE_LABEL_MAX = 24;
/** The two stages that count as closed. Their keys (and so what "closed" means) cannot be changed. */
export const CLOSED_STAGES: readonly PartnerStage[] = ["onboard", "renew"];

export const currentStageLabels = (): Record<PartnerStage, string> => ({ ...getPartnerStageLabels() });

/** The message for each label that is not allowed: empty, longer than 24 characters, or the same as another (case does not matter). */
export function validateStageLabels(labels: Record<PartnerStage, string>): Partial<Record<PartnerStage, string>> {
  const errors: Partial<Record<PartnerStage, string>> = {};
  for (const stage of PARTNER_STAGES) {
    const label = labels[stage].trim();
    if (!label) errors[stage] = "Enter a name for this stage.";
    else if (label.length > STAGE_LABEL_MAX) errors[stage] = `Use ${STAGE_LABEL_MAX} characters or fewer.`;
    else if (PARTNER_STAGES.some((other) => other !== stage && labels[other].trim().toLowerCase() === label.toLowerCase())) errors[stage] = "Another stage already has this name.";
  }
  return errors;
}

export function saveStageLabels(labels: Record<PartnerStage, string>): void {
  setPartnerStageLabels(labels);

  if (typeof window !== "undefined" && (!isMockMode() || hasAdminSession())) {
    updatePipelineStagesApi(labels).catch((err) => {
      console.warn("Could not persist stage labels to backend API", err);
    });
  }
}

export function resetStageLabels(): void {
  setPartnerStageLabels({ ...PARTNER_STAGE_LABELS });

  if (typeof window !== "undefined" && (!isMockMode() || hasAdminSession())) {
    updatePipelineStagesApi(undefined, true).catch((err) => {
      console.warn("Could not reset stage labels on backend API", err);
    });
  }
}

// ---- integrations (write-only credentials) ---------------------------------------------------------------------------

export type IntegrationKind = "wordpress" | "analytics";

export interface IntegrationStatus {
  /** Has a credential been saved? */
  saved: boolean;
  /** The last four characters, shown masked ("••••3f9a"). Never the value. */
  tail: string;
  /** A non-secret setting: the site address, or the property ID. */
  identifier: string;
}

// Module scope only: a reload resets it. The secret itself is never kept: only its last four characters.
const integrations: Record<IntegrationKind, IntegrationStatus> = {
  wordpress: { saved: false, tail: "", identifier: "" },
  analytics: { saved: false, tail: "", identifier: "" },
};
const listeners = new Set<() => void>();
let integrationVersion = 0;
const emitIntegrations = () => {
  integrationVersion += 1;
  listeners.forEach((listener) => listener());
};

export const subscribeIntegrations = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
export const getIntegrationsVersion = () => integrationVersion;
export const getIntegration = (kind: IntegrationKind): IntegrationStatus => integrations[kind];

/** The masked tail as the screen shows it: "••••3f9a". */
export const maskedTail = (tail: string): string => `••••${tail}`;

/**
 * Saves a credential. Returns nothing: the value is read here, only its last four characters are kept, and everything else is forgotten when
 * this function returns. (A credential of fewer than four characters keeps what it has.) TODO(backend): send it to the server, which stores it.
 */
export function saveCredential(kind: IntegrationKind, secret: string): void {
  const tail = secret.slice(-4);
  integrations[kind] = { ...integrations[kind], saved: secret.length > 0, tail };
  emitIntegrations();
}

/** Saves the non-secret setting (the site address or the property ID). */
export function saveIdentifier(kind: IntegrationKind, identifier: string): void {
  integrations[kind] = { ...integrations[kind], identifier: identifier.trim() };
  emitIntegrations();
}

/** A mock "Test connection": succeeds after 800 ms. It takes no value and sends nothing anywhere. TODO(backend): ask the server to test it. */
export function testConnection(kind: IntegrationKind): Promise<{ ok: true; kind: IntegrationKind }> {
  return new Promise((resolve) => setTimeout(() => resolve({ ok: true, kind }), 800));
}

// ---- my account ------------------------------------------------------------------------------------------------------

export const PASSWORD_MIN = 8;

export type PasswordStrength = "empty" | "weak" | "fair" | "strong";

/** A strength hint for a new password: length and mix of letters, numbers and symbols. Only a hint: the rule is the minimum length. */
export function passwordStrength(password: string): PasswordStrength {
  if (!password) return "empty";
  let points = 0;
  if (password.length >= PASSWORD_MIN) points += 1;
  if (password.length >= 12) points += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points += 1;
  if (/\d/.test(password)) points += 1;
  if (/[^A-Za-z0-9]/.test(password)) points += 1;
  if (password.length < PASSWORD_MIN) return "weak";
  return points >= 4 ? "strong" : points >= 3 ? "fair" : "weak";
}

export const STRENGTH_HINTS: Record<PasswordStrength, string> = {
  empty: `Use at least ${PASSWORD_MIN} characters. A longer one with capitals, numbers and a symbol is stronger.`,
  weak: "Weak: add length, capitals, numbers or a symbol.",
  fair: "Fair: a few more characters or a symbol would make it stronger.",
  strong: "Strong.",
};

export interface PasswordForm {
  current: string;
  next: string;
  confirm: string;
}

/** The messages for the change-password form. Nothing here stores or logs a value. */
export function validatePasswordChange(form: PasswordForm): Partial<Record<keyof PasswordForm, string>> {
  const errors: Partial<Record<keyof PasswordForm, string>> = {};
  if (!form.current) errors.current = "Enter your current password.";
  if (!form.next) errors.next = "Enter a new password.";
  else if (form.next.length < PASSWORD_MIN) errors.next = `Use at least ${PASSWORD_MIN} characters.`;
  else if (form.current && form.next === form.current) errors.next = "The new password must be different from the current one.";
  if (!form.confirm) errors.confirm = "Confirm the new password.";
  else if (form.next && form.confirm !== form.next) errors.confirm = "The passwords do not match.";
  return errors;
}

/** The signed-in person (the dev user in mock mode), for the profile. */
export const currentProfile = (): { id: string; name: string; email: string } | undefined => {
  const person = currentStaffMember();
  return person ? { id: person.id, name: person.name, email: person.email } : undefined;
};

/** Saves the person's name. A mock: it updates the team record. TODO(backend): persist this change. */
export function saveProfileName(id: string, name: string): void {
  setMockCollection(
    "staff",
    getMockCollection("staff").map((person) => (person.id === id ? { ...person, name: name.trim() } : person)),
    { always: true },
  );
}

export const NOTIFICATION_PREFERENCES = [
  { key: "digest", label: "Daily summary", description: "One email each morning with what needs your attention." },
  { key: "verifications", label: "New verification requests", description: "When a company asks to be verified." },
  { key: "reports", label: "New reports", description: "When someone reports a listing or an account." },
  { key: "testimonials", label: "Testimonials waiting", description: "When a story is waiting for a decision." },
] as const;
export type NotificationKey = (typeof NOTIFICATION_PREFERENCES)[number]["key"];

let preferences: Record<NotificationKey, boolean> = { digest: true, verifications: true, reports: true, testimonials: false };
export const getNotificationPreferences = (): Record<NotificationKey, boolean> => ({ ...preferences });
/** Saves the preferences (a mock). TODO(backend): persist this change. */
export function saveNotificationPreferences(next: Record<NotificationKey, boolean>): void {
  preferences = { ...next };
}
