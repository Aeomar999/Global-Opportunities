import { z } from 'zod';

// SEC-077: add an existing Kredibble account to the admin staff list.
export const staffInviteSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    role: z.string().trim().min(2, 'Role is too short').max(80, 'Role is too long'),
  }),
});
