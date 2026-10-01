import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getAssistantReply } from '../lib/ai.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, itemResponse } from '../utils/http.js';

export const assistantRouter = Router();

const assistantLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => req.auth?.sub || req.ip,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { message: 'Assistant request limit reached. Please try again later.' } },
});

assistantRouter.post('/chat', requireAuth, assistantLimiter, asyncHandler(async (req, res) => {
  const messages = req.body.messages || (req.body.message ? [{ role: 'user', content: req.body.message }] : []);
  const reply = await getAssistantReply({
    provider: req.body.provider,
    messages,
  });
  itemResponse(res, reply);
}));
