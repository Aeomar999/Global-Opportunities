import mongoose from 'mongoose';
import { TargetChange, MonthlyTarget } from '../models/AdminPortal.js';

export const KPI_KEYS = [
  'opportunities_published',
  'programs_organised',
  'active_ambassadors',
  'partners_onboarded',
  'beneficiaries_verified',
  'social_reach',
  'social_engagement',
  'posts_published',
  'website_views',
  'monthly_reports',
];

export const DEFAULT_TARGETS = {
  opportunities_published: 2,
  programs_organised: 1,
  active_ambassadors: 21,
  partners_onboarded: 4,
  beneficiaries_verified: 15,
  social_reach: 10500,
  social_engagement: 800,
  posts_published: 8,
  website_views: 12000,
  monthly_reports: 1,
};

/**
 * Gets the next sequence number across TargetChange and ThresholdChange.
 */
export async function getNextSeq() {
  const [lastTarget, lastThreshold] = await Promise.all([
    TargetChange.findOne().sort({ seq: -1 }).select('seq').lean(),
    mongoose.models.ThresholdChange
      ? mongoose.models.ThresholdChange.findOne().sort({ seq: -1 }).select('seq').lean()
      : null,
  ]);
  const maxSeq = Math.max(0, lastTarget?.seq || 0, lastThreshold?.seq || 0);
  return maxSeq + 1;
}

/**
 * Ensures initial baseline targets exist in TargetChange if collection is empty.
 * Initial baseline rows have previous = null, so change history does not treat them as edits.
 */
export async function ensureInitialTargets() {
  const count = await TargetChange.countDocuments();
  if (count > 0) return;

  const baselineMonth = '2026-01';
  let seq = 1;
  const docs = [];

  for (const kpi of KPI_KEYS) {
    docs.push({
      kpi,
      value: DEFAULT_TARGETS[kpi],
      effectiveFrom: baselineMonth,
      previous: null,
      changedByName: 'System',
      changedAt: '2026-01-01',
      seq: seq++,
    });
  }

  await TargetChange.insertMany(docs);
}

/**
 * Resolves the target in force for a specific KPI and month.
 * The target is the latest row whose effectiveFrom <= month (ordered by effectiveFrom desc, seq desc).
 */
export async function getTargetInForce(kpi, month) {
  await ensureInitialTargets();
  const row = await TargetChange.findOne({
    kpi,
    effectiveFrom: { $lte: month },
  })
    .sort({ effectiveFrom: -1, seq: -1 })
    .lean();

  return row ? row.value : (DEFAULT_TARGETS[kpi] || 0);
}

/**
 * Resolves all 10 KPI targets in force for a specific month.
 * Returns an array of target objects formatted for admin consumers and backward-compatibility.
 */
export async function getTargetsForMonth(month) {
  await ensureInitialTargets();

  const rows = await TargetChange.find({
    effectiveFrom: { $lte: month },
  })
    .sort({ effectiveFrom: 1, seq: 1 })
    .lean();

  const currentValues = { ...DEFAULT_TARGETS };
  const currentMeta = {};

  for (const row of rows) {
    currentValues[row.kpi] = row.value;
    currentMeta[row.kpi] = {
      effectiveFrom: row.effectiveFrom,
      seq: row.seq,
      changedAt: row.changedAt,
      changedByName: row.changedByName,
      id: row._id.toString(),
    };
  }

  return KPI_KEYS.map((kpi) => {
    const meta = currentMeta[kpi] || {};
    const value = currentValues[kpi];
    return {
      kpi,
      value,
      effectiveFrom: meta.effectiveFrom || '2026-01',
      seq: meta.seq || 0,
      id: meta.id,
      // Backward-compatibility properties with legacy MonthlyTarget
      metric: kpi,
      target: value,
      unit: 'count',
      month,
    };
  });
}

/**
 * Saves a batch of changed targets with a single effectiveFrom month.
 * Appends rows to TargetChange, calculating the previous target in force for each KPI.
 */
export async function saveTargetBatch({ targets, effectiveFrom, changedBy, changedByName }) {
  await ensureInitialTargets();

  let currentSeq = await getNextSeq();
  const today = new Date().toISOString().slice(0, 10);
  const created = [];

  for (const { kpi, value } of targets) {
    const previous = await getTargetInForce(kpi, effectiveFrom);
    const row = new TargetChange({
      kpi,
      value,
      effectiveFrom,
      previous,
      changedBy: changedBy || undefined,
      changedByName: changedByName || 'Admin',
      changedAt: today,
      seq: currentSeq++,
    });
    await row.save();
    created.push(row);

    // Also sync to legacy MonthlyTarget so legacy dashboard endpoints stay consistent
    await MonthlyTarget.findOneAndUpdate(
      { month: effectiveFrom, metric: kpi },
      {
        $set: {
          target: value,
          unit: 'count',
          updatedBy: changedBy || undefined,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
  }

  return created;
}

/**
 * Retrieves the append-only TargetChange history, newest first.
 * Calculates `replaced: true` when a later save for the same KPI has the same effectiveFrom.
 */
export async function getTargetHistory({ limit = 100, skip = 0 } = {}) {
  await ensureInitialTargets();

  const [rows, total] = await Promise.all([
    TargetChange.find()
      .sort({ seq: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    TargetChange.countDocuments(),
  ]);

  // Compute `replaced` for each row
  // A row is replaced if there is another row with same kpi, same effectiveFrom, but higher seq
  const allForReplaced = await TargetChange.find().select('kpi effectiveFrom seq').lean();
  const history = rows.map((entry) => {
    const isReplaced = allForReplaced.some(
      (other) => other.kpi === entry.kpi &&
        other.effectiveFrom === entry.effectiveFrom &&
        (other.seq ?? 0) > (entry.seq ?? 0)
    );

    return {
      id: entry._id.toString(),
      kpi: entry.kpi,
      value: entry.value,
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
