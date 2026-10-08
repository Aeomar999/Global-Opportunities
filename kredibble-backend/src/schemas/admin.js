import { z } from 'zod';
import { ROLE_IDS } from '../lib/permissions.js';
import { KPI_KEYS } from '../lib/targets.js';

// SEC-077, BE-001: add an existing Kredibble account to the admin staff list with 1 or 2 roles.
export const staffInviteSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    role: z.string().trim().min(2, 'Role is too short').max(80, 'Role is too long').optional(),
    roles: z.array(z.enum(ROLE_IDS)).min(1, 'At least 1 role required').max(2, 'At most 2 roles allowed').optional(),
  }).refine((data) => Boolean(data.role || (data.roles && data.roles.length > 0)), {
    message: 'Either role or roles must be provided',
    path: ['roles'],
  }),
});

// BE-002, BE-003: batch targets save schema with effective-from month (supports targets, thresholds, or both)
export const targetsBatchSchema = z.object({
  body: z.object({
    effectiveFrom: z.string().regex(/^\d{4}-\d{2}$/, 'effectiveFrom must be YYYY-MM format'),
    targets: z.array(z.object({
      kpi: z.enum(KPI_KEYS, { errorMap: () => ({ message: 'Invalid KPI key' }) }),
      value: z.number().int('Target must be an integer').min(1, 'Target must be at least 1').max(10_000_000, 'Target cannot exceed 10,000,000'),
    })).min(1, 'At least one target change required').max(10, 'At most 10 target changes allowed')
    .refine((items) => {
      const keys = items.map((item) => item.kpi);
      return new Set(keys).size === keys.length;
    }, { message: 'Duplicate KPI in batch is not allowed' }).optional(),
    thresholds: z.object({
      green: z.number().int('Green must be an integer').min(1, 'Green must be at least 1').max(200, 'Green cannot exceed 200'),
      amber: z.number().int('Amber must be an integer').min(1, 'Amber must be at least 1').max(200, 'Amber cannot exceed 200'),
    }).refine((data) => data.amber < data.green, {
      message: 'amber must be below green',
      path: ['amber'],
    }).optional(),
  }).refine((data) => Boolean((data.targets && data.targets.length > 0) || data.thresholds), {
    message: 'Either targets or thresholds must be provided',
    path: ['targets'],
  }),
});

// BE-003: dedicated thresholds save schema
export const thresholdsSchema = z.object({
  body: z.object({
    effectiveFrom: z.string().regex(/^\d{4}-\d{2}$/, 'effectiveFrom must be YYYY-MM format'),
    green: z.number().int('Green must be an integer').min(1, 'Green must be at least 1').max(200, 'Green cannot exceed 200'),
    amber: z.number().int('Amber must be an integer').min(1, 'Amber must be at least 1').max(200, 'Amber cannot exceed 200'),
  }).refine((data) => data.amber < data.green, {
    message: 'amber must be below green',
    path: ['amber'],
  }),
});


