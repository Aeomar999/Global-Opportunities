import { z } from 'zod';

// Top 25 most common passwords (abridged for brevity; extend as needed)
const COMMON_PASSWORDS = new Set([
  'password', '123456', '123456789', '12345678', '12345',
  '1234567', '1234567890', 'qwerty', 'abc123', 'password1',
  'admin', 'welcome', 'login', 'qwerty123', '1q2w3e4r',
  '1234', '123456789012', 'iloveyou', 'monkey', 'dragon',
  'sunshine', 'princess', 'football', 'baseball', 'superman',
]);

const isCommonPassword = (pwd) => COMMON_PASSWORDS.has(pwd.toLowerCase());

const passwordSchema = z.string()
  .min(10, 'Password must be at least 10 characters long')
  .max(128, 'Password must be at most 128 characters long')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one digit')
  .refine((pwd) => !isCommonPassword(pwd), {
    message: 'Password is too common; choose a stronger one',
  });

// Public registration may only mint these two roles. 'admin' is intentionally
// absent: it must never be reachable from an anonymous request body.
const PUBLIC_ROLES = ['seeker', 'hirer'];

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name is too short').max(50),
    email: z.string().email('Invalid email format'),
    password: passwordSchema,
    role: z.enum(PUBLIC_ROLES, {
      message: `Role must be one of: ${PUBLIC_ROLES.join(', ')}`,
    }),
    // Seeker optional fields
    profession: z.string().optional(),
    university: z.string().optional(),
    country: z.string().optional(),
    city: z.string().optional(),
    phone: z.string().optional(),
    technicalSkills: z.array(z.string()).optional(),
    // Hirer optional fields
    companyName: z.string().optional(),
    industry: z.string().optional(),
    location: z.string().optional(),
    website: z.string().optional().or(z.literal('')),
    companySize: z.string().optional(),
    companyEmail: z.string().email('Invalid company email').optional(),
    recruiterRole: z.string().optional(),
    recruiterPhone: z.string().optional(),
    recruiterLinkedin: z.string().optional().or(z.literal('')),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
    newPassword: passwordSchema,
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
  }),
});

// SEC-065: deleting an account needs the password and a typed confirmation.
// Strings only, so a numeric password can't reach bcrypt.compare.
const DELETE_PASSWORD_MESSAGE = 'Password confirmation required for account deletion';
const DELETE_CONFIRMATION_MESSAGE = 'Please type "DELETE MY ACCOUNT" to confirm';

export const deleteAccountSchema = z.object({
  body: z.object({
    password: z.string({ error: DELETE_PASSWORD_MESSAGE })
      .min(1, DELETE_PASSWORD_MESSAGE)
      .max(128, DELETE_PASSWORD_MESSAGE),
    confirmation: z.literal('DELETE MY ACCOUNT', { error: DELETE_CONFIRMATION_MESSAGE }),
  }),
});

export const pushTokenSchema = z.object({
  body: z.object({
    token: z.string({ required_error: 'Token is required' }).trim().min(1, 'Token is required').max(500, 'Token is too long'),
    platform: z.enum(['ios', 'android', 'web', 'other']).optional(),
  }),
});
