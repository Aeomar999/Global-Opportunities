import { Router } from 'express';
import { getAssistantReply } from '../lib/ai.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, itemResponse } from '../utils/http.js';
import { aiLimiter } from '../lib/rate-limiters.js';
import { validate } from '../middleware/validate.js';
import { assistantChatSchema } from '../schemas/assistant.js';

export const assistantRouter = Router();

assistantRouter.post(
  '/chat',
  // SEC-041: authenticate BEFORE the limiter so aiLimiter keys on req.auth.sub
  // (a real per-user budget) instead of falling back to a shared IP bucket, and
  // so unauthenticated callers can never reach the AI budget at all.
  requireAuth,
  aiLimiter,
  // SEC-041: validate the body. The schema does not declare `systemPrompt`, so
  // Zod strips it here; the handler additionally never reads it, and the AI lib
  // only ever uses the server-owned ASSISTANT_SYSTEM_PROMPT.
  validate(assistantChatSchema),
  asyncHandler(async (req, res) => {
    const { provider, messages: parsedMessages, message } = req.body;
    // Support a single-turn `message` convenience while still bounding it.
    const messages = parsedMessages || [{ role: 'user', content: message }];
    const reply = await getAssistantReply({ provider, messages });
    itemResponse(res, reply);
  }),
);