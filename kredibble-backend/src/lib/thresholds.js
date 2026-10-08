import { ThresholdChange, TargetChange, MonthlyTarget } from '../models/AdminPortal.js';
import { getNextSeq } from './targets.js';

export const DEFAULT_THRESHOLDS = {
  green: 95,
  amber: 70,
};

/**
 * Ensures initial baseline thresholds exist in ThresholdChange if empty.
 * Initial baseline row has previous = null, so change history does not treat it as an edit.
 */
export async function ensureInitialThresholds() {
  const count = await ThresholdChange.countDocuments();
  if (count > 0) return;

  const baselineMonth = '2026-01';
  const seq = await getNextSeq();

  await ThresholdChange.create({
    green: DEFAULT_THRESHOLDS.green,
    amber: DEFAULT_THRESHOLDS.amber,
    effectiveFrom: baselineMonth,
    previous: null,
    changedByName: 'System',
    changedAt: '2026-01-01',
    seq,
  });
}

/**
 * Resolves the status thresholds in force for a specific month.
 * Returns both whole percentages (1-200) and ratios (0.01-2.0).
 */
export async function getThresholdsInForce(month) {
  await ensureInitialThresholds();

  const row = await ThresholdChange.findOne({
    effectiveFrom: { $lte: month },
  })
    .sort({ effectiveFrom: -1, seq: -1 })
    .lean();

  const green = row ? row.green : DEFAULT_THRESHOLDS.green;
  const amber = row ? row.amber : DEFAULT_THRESHOLDS.amber;

  return {
    green,
    amber,
    greenRatio: green / 100,
    amberRatio: amber / 100,
    effectiveFrom: row?.effectiveFrom || '2026-01',
    seq: row?.seq || 0,
    changedAt: row?.changedAt,
    changedByName: row?.changedByName || 'System',
    id: row?._id?.toString(),
    month,
  };
}

/**
 * Saves a new threshold change with an effective-from month.
 * Appends a row to ThresholdChange and syncs to MonthlyTarget for the month.
 */
export async function saveThresholdChange({ green, amber, effectiveFrom, changedBy, changedByName }) {
  await ensureInitialThresholds();

  const current = await getThresholdsInForce(effectiveFrom);
  const seq = await getNextSeq();
  const today = new Date().toISOString().slice(0, 10);

  const row = new ThresholdChange({
    green,
    amber,
    effectiveFrom,
    previous: {
      green: current.green,
      amber: current.amber,
    },
    changedBy: changedBy || undefined,
    changedByName: changedByName || 'Admin',
    changedAt: today,
    seq,
  });
  await row.save();

  // Also sync thresholds to any MonthlyTarget rows in this month for backward compatibility
  await MonthlyTarget.updateMany(
    { month: effectiveFrom },
    {
      $set: {
        greenThreshold: green / 100,
        amberThreshold: amber / 100,
      },
    },
  );

  return row;
}

/**
 * Retrieves the append-only ThresholdChange history, newest first.
 * Calculates `replaced: true` when a later save for thresholds has the same effectiveFrom.
 */
export async function getThresholdHistory({ limit = 100, skip = 0 } = {}) {
  await ensureInitialThresholds();

  const [rows, total] = await Promise.all([
    ThresholdChange.find()
      .sort({ seq: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ThresholdChange.countDocuments(),
  ]);

  const allForReplaced = await ThresholdChange.find().select('effectiveFrom seq').lean();

  const history = rows.map((entry) => {
    const isReplaced = allForReplaced.some(
      (other) => other.effectiveFrom === entry.effectiveFrom &&
        (other.seq ?? 0) > (entry.seq ?? 0)
    );

    return {
      id: entry._id.toString(),
      green: entry.green,
      amber: entry.amber,
      greenRatio: entry.green / 100,
      amberRatio: entry.amber / 100,
      effectiveFrom: entry.effectiveFrom,
      previous: entry.previous,
      changedBy: entry.changedBy?.toString(),
      changedByName: entry.changedByName || 'Admin',
      changedAt: entry.changedAt,
      seq: entry.seq,
      replaced: isReplaced,
      createdAt: entry.createdAt,
    };
  });

  return { history, total };
}

/**
 * Returns a unified change history merging targets and thresholds in ONE list, newest first.
 * Sorted strictly by the shared sequence counter (`seq: -1`).
 */
export async function getCombinedChangeHistory({ limit = 100, skip = 0 } = {}) {
  await Promise.all([
    ensureInitialThresholds(),
    import('./targets.js').then((m) => m.ensureInitialTargets()),
  ]);

  const [targets, thresholds] = await Promise.all([
    TargetChange.find().lean(),
    ThresholdChange.find().lean(),
  ]);

  const targetRows = targets.map((t) => {
    const replaced = targets.some(
      (other) => other.kpi === t.kpi &&
        other.effectiveFrom === t.effectiveFrom &&
        (other.seq ?? 0) > (t.seq ?? 0)
    );

    return {
      id: t._id.toString(),
      kind: 'target',
      kpi: t.kpi,
      value: t.value,
      effectiveFrom: t.effectiveFrom,
      previous: t.previous,
      changedBy: t.changedBy?.toString(),
      changedByName: t.changedByName || 'Admin',
      changedAt: t.changedAt,
      seq: t.seq,
      replaced,
      createdAt: t.createdAt,
    };
  });

  const thresholdRows = thresholds.map((thr) => {
    const replaced = thresholds.some(
      (other) => other.effectiveFrom === thr.effectiveFrom &&
        (other.seq ?? 0) > (thr.seq ?? 0)
    );

    return {
      id: thr._id.toString(),
      kind: 'thresholds',
      green: thr.green,
      amber: thr.amber,
      greenRatio: thr.green / 100,
      amberRatio: thr.amber / 100,
      effectiveFrom: thr.effectiveFrom,
      previous: thr.previous,
      changedBy: thr.changedBy?.toString(),
      changedByName: thr.changedByName || 'Admin',
      changedAt: thr.changedAt,
      seq: thr.seq,
      replaced,
      createdAt: thr.createdAt,
    };
  });

  const allItems = [...targetRows, ...thresholdRows].sort((a, b) => (b.seq || 0) - (a.seq || 0));
  const paginated = allItems.slice(skip, skip + limit);

  return {
    history: paginated,
    total: allItems.length,
  };
}
