import { normalizeLegacyRole } from './permissions.js';

export const SCORE_FROM_DAY = process.env.SCORE_FROM_DAY
  ? parseInt(process.env.SCORE_FROM_DAY, 10)
  : 5;

export const ATTAINMENT_DISPLAY_CAP = 3;

export const SCORECARD_KPIS = [
  {
    key: 'opportunities_published',
    metric: 'opportunitiesPublished',
    label: 'Opportunities published',
    unit: 'listings',
    owners: ['opportunities_officer', 'desk_lead'],
    kind: 'count',
  },
  {
    key: 'programs_organised',
    metric: 'programsDelivered',
    label: 'Programs organised',
    unit: 'programs',
    owners: ['training_officer', 'desk_lead'],
    kind: 'count',
  },
  {
    key: 'active_ambassadors',
    metric: 'ambassadorsActive',
    label: 'Active ambassadors',
    unit: 'ambassadors',
    owners: ['country_lead', 'desk_lead'],
    kind: 'running_total',
  },
  {
    key: 'partners_onboarded',
    metric: 'partnersClosed',
    label: 'Partners onboarded',
    unit: 'partners',
    owners: ['partnerships_officer', 'desk_lead'],
    kind: 'count',
  },
  {
    key: 'beneficiaries_verified',
    metric: 'beneficiariesVerified',
    label: 'Beneficiaries verified',
    unit: 'records',
    owners: ['database_officer', 'desk_lead'],
    kind: 'count',
  },
  {
    key: 'social_reach',
    metric: 'socialReach',
    label: 'Social reach',
    unit: 'people reached',
    owners: ['social_media_manager', 'desk_lead'],
    kind: 'count',
  },
  {
    key: 'social_engagement',
    metric: 'socialEngagement',
    label: 'Social engagement',
    unit: 'interactions',
    owners: ['social_media_manager', 'desk_lead'],
    kind: 'count',
  },
  {
    key: 'posts_published',
    metric: 'postsPublished',
    label: 'Posts published',
    unit: 'posts',
    owners: ['social_media_manager', 'desk_lead'],
    kind: 'count',
  },
  {
    key: 'website_views',
    metric: 'websiteViews',
    label: 'Website views',
    unit: 'views',
    owners: ['communications_officer', 'desk_lead'],
    kind: 'count',
  },
  {
    key: 'monthly_reports',
    metric: 'monthlyReports',
    label: 'Monthly reports',
    unit: 'reports',
    owners: ['communications_officer', 'desk_lead'],
    kind: 'count',
  },
];

/**
 * True if month is strictly before the calendar month of today (UTC).
 */
export function isPastMonth(month, today = new Date()) {
  const nowMonth = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`;
  return month < nowMonth;
}

/**
 * True in the first days of the CURRENT month (before SCORE_FROM_DAY, UTC):
 * too early for a fair composite. A past month is complete, so it is never too early.
 */
export function isTooEarly(month, today = new Date(), scoreFromDay = SCORE_FROM_DAY) {
  if (isPastMonth(month, today)) return false;
  return today.getUTCDate() < scoreFromDay;
}

/**
 * Calculates dayOfMonth and daysInMonth progress for a given month.
 */
export function monthProgress(month, today = new Date()) {
  const year = parseInt(month.slice(0, 4), 10);
  const monthIdx = parseInt(month.slice(5, 7), 10) - 1;
  const daysInMonth = new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();

  if (isPastMonth(month, today)) {
    return { dayOfMonth: daysInMonth, daysInMonth };
  }

  const currentMonthStr = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`;
  if (month === currentMonthStr) {
    const day = Math.max(1, Math.min(today.getUTCDate(), daysInMonth));
    return { dayOfMonth: day, daysInMonth };
  }

  // Future month
  return { dayOfMonth: 0, daysInMonth };
}

/**
 * Builds one MetricResult for a scorecard row.
 */
export function buildMetricResult(kpiDef, rawValue, target, month, today = new Date(), thresholds = { greenRatio: 0.95, amberRatio: 0.7 }) {
  const { dayOfMonth, daysInMonth } = monthProgress(month, today);
  const isPast = isPastMonth(month, today);
  const isRunningTotal = kpiDef.kind === 'running_total';

  const pace = isRunningTotal || isPast ? 1 : dayOfMonth / daysInMonth;
  const proratedTarget = isRunningTotal || isPast ? target : target * pace;

  let attainment = null;
  if (target > 0) {
    attainment = proratedTarget > 0 ? rawValue / proratedTarget : 0;
  }

  let status = null;
  if (target > 0 && attainment !== null) {
    status = attainment >= thresholds.greenRatio
      ? 'green'
      : attainment >= thresholds.amberRatio
        ? 'amber'
        : 'red';
  }

  return {
    key: kpiDef.key,
    label: kpiDef.label,
    unit: kpiDef.unit,
    value: rawValue,
    target,
    pace,
    proratedTarget,
    attainment,
    status,
    isPast,
    prorated: !isRunningTotal,
  };
}

/**
 * Highlight: Pair (strongest & weakest) or Focus (if exactly 1 metric).
 * Ties preserve the earlier KPI in definition order.
 */
export function highlightOf(metrics) {
  const scored = metrics.filter((m) => m.attainment !== null);
  if (scored.length === 0) return null;
  if (scored.length === 1) return { kind: 'focus', focus: scored[0] };

  let strongest = scored[0];
  let weakest = scored[0];

  for (const row of scored) {
    if (row.attainment > strongest.attainment) strongest = row;
    if (row.attainment < weakest.attainment) weakest = row;
  }

  return {
    kind: 'pair',
    strongest,
    weakest,
    atTarget: scored.every((m) => m.attainment >= 1),
  };
}

/**
 * Composite score: average of min(attainment, 1) over owned metrics, x 100, rounded.
 * Returns null before SCORE_FROM_DAY for current month, or if no metrics have targets.
 */
export function calculateComposite(metrics, tooEarly) {
  if (tooEarly) return null;
  const capped = metrics
    .filter((m) => m.attainment !== null)
    .map((m) => Math.min(m.attainment, 1));

  if (capped.length === 0) return null;
  return Math.round((capped.reduce((sum, v) => sum + v, 0) / capped.length) * 100);
}

/**
 * Returns 'green' | 'amber' | 'red' | null based on composite and dated thresholds.
 */
export function compositeStatus(composite, thresholds = { greenRatio: 0.95, amberRatio: 0.7 }) {
  if (composite === null) return null;
  const ratio = composite / 100;
  return ratio >= thresholds.greenRatio
    ? 'green'
    : ratio >= thresholds.amberRatio
      ? 'amber'
      : 'red';
}

/**
 * Builds a single ScorecardPerson object for a staff member or user.
 */
export function buildScorecardPerson({
  staff,
  metricValues,
  targetsByMetric,
  month,
  today = new Date(),
  thresholds = { greenRatio: 0.95, amberRatio: 0.7 },
  scoreFromDay = SCORE_FROM_DAY,
}) {
  const rawRoles = Array.isArray(staff.roles) && staff.roles.length > 0
    ? staff.roles
    : (staff.role || '');
  const roles = normalizeLegacyRole(rawRoles);

  const ownedDefs = SCORECARD_KPIS.filter((kpi) =>
    kpi.owners.some((owner) => roles.includes(owner))
  );

  const metrics = ownedDefs.map((kpiDef) => {
    const rawVal = metricValues[kpiDef.metric] ?? metricValues[kpiDef.key] ?? 0;
    const targetObj = targetsByMetric.get(kpiDef.key) || targetsByMetric.get(kpiDef.metric);
    const target = targetObj?.target ?? targetObj?.value ?? 0;
    return buildMetricResult(kpiDef, rawVal, target, month, today, thresholds);
  });

  const tooEarlyFlag = metrics.length > 0 && isTooEarly(month, today, scoreFromDay);
  const score = calculateComposite(metrics, tooEarlyFlag);
  const status = compositeStatus(score, thresholds);
  const highlight = highlightOf(metrics);

  return {
    id: String(staff.id || staff._id || 'me'),
    name: String(staff.name || 'You'),
    roles,
    composite: score,
    status,
    highlight,
    metrics,
    tooEarly: tooEarlyFlag,
  };
}

/**
 * Calculates summary metrics for the team scoreboard.
 */
export function teamSummary(people) {
  const scored = people.filter((p) => p.composite !== null);
  return {
    scored: scored.length,
    average: scored.length === 0
      ? null
      : Math.round(scored.reduce((sum, p) => sum + p.composite, 0) / scored.length),
    belowAmber: scored.filter((p) => p.status === 'red').length,
  };
}

/**
 * Ranks people: highest composite first.
 * People with null composite come last, in alphabetical order.
 * Ties broken alphabetically by name.
 */
export function sortTeamScorecards(people) {
  return [...people].sort((a, b) => {
    if (a.composite === null && b.composite === null) return a.name.localeCompare(b.name);
    if (a.composite === null) return 1;
    if (b.composite === null) return -1;
    return b.composite - a.composite || a.name.localeCompare(b.name);
  });
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const monthName = (m) => `${MONTH_NAMES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

/**
 * Builds 6-month historical composite trend for a set of roles.
 */
export async function buildCompositeSeries(roles, months = 6, endMonth, today = new Date(), loadMonthData, scoreFromDay = SCORE_FROM_DAY) {
  const normalized = normalizeLegacyRole(roles);
  const owned = SCORECARD_KPIS.filter((kpi) => kpi.owners.some((owner) => normalized.includes(owner)));
  if (owned.length === 0) return null;

  const startYear = parseInt(endMonth.slice(0, 4), 10);
  const startMonthIdx = parseInt(endMonth.slice(5, 7), 10) - 1;
  const monthList = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(startYear, startMonthIdx - i, 1));
    const mStr = d.toISOString().slice(0, 7);
    monthList.push(mStr);
  }

  const series = await Promise.all(
    monthList.map(async (m) => {
      const { metricValues, targetsByMetric, thresholds } = await loadMonthData(m);
      const metrics = owned.map((kpiDef) => {
        const rawVal = metricValues[kpiDef.metric] ?? metricValues[kpiDef.key] ?? 0;
        const targetObj = targetsByMetric.get(kpiDef.key) || targetsByMetric.get(kpiDef.metric);
        const target = targetObj?.target ?? targetObj?.value ?? 0;
        return buildMetricResult(kpiDef, rawVal, target, m, today, thresholds);
      });
      const tooEarlyFlag = metrics.length > 0 && isTooEarly(m, today, scoreFromDay);
      const score = calculateComposite(metrics, tooEarlyFlag);
      const status = compositeStatus(score, thresholds);
      return {
        month: m,
        label: monthName(m).slice(0, 3),
        tooltipLabel: monthName(m),
        score,
        status,
      };
    })
  );

  return series;
}
