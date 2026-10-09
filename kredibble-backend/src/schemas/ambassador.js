import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const createAmbassadorRequestSchema = z.object({
  body: z.object({
    motivation: z.string().trim().min(20, 'Please tell us a little more (at least 20 characters)').max(1000),
  }).strict(),
  query: z.any(),
  params: z.any(),
});

export const approveAmbassadorRequestSchema = z.object({
  body: z.object({
    channelId: objectId.optional(),
    note: z.string().trim().max(1000).optional(),
  }).strict(),
  query: z.any(),
  params: z.object({ id: objectId }),
});

export const rejectAmbassadorRequestSchema = z.object({
  body: z.object({
    note: z.string().trim().max(1000).optional(),
  }).strict(),
  query: z.any(),
  params: z.object({ id: objectId }),
});

export const chatMessageSchema = z.object({
  body: z.object({
    body: z.string().trim().min(1, 'Message cannot be empty').max(2000),
    parentId: objectId.optional(),
    allowReplies: z.boolean().optional(),
  }).strict(),
  query: z.any(),
  params: z.object({ channelId: objectId }),
});

export const createAdminChannelSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(80),
    category: z.string().trim().min(2).max(60).default('General'),
    bio: z.string().trim().max(500).optional(),
    visibility: z.enum(['public', 'private']).default('private'),
  }).strict(),
  query: z.any(),
  params: z.any(),
});

export const addChannelMemberSchema = z.object({
  body: z.object({ userId: objectId }).strict(),
  query: z.any(),
  params: z.object({ id: objectId }),
});

export const allowRepliesSchema = z.object({
  body: z.object({ allowReplies: z.boolean() }).strict(),
  query: z.any(),
  params: z.object({ id: objectId, messageId: objectId }),
});
