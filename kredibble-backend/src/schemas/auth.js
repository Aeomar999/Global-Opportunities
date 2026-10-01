import { z } from 'zod';

const passwordSchema = z.string()
  .min(10, 'Password must be at least 10 characters long')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name is too short').max(50),
    email: z.string().email('Invalid email format'),
    password: passwordSchema,
    role: z.enum(['seeker', 'hirer'], {
      errorMap: () => ({ message: 'Role must be seeker or hirer' }),
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
