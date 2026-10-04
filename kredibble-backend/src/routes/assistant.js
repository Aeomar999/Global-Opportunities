import { Router } from 'express';
import { env } from '../config/env.js';
import { getAssistantReply } from '../lib/ai.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiError, asyncHandler, itemResponse } from '../utils/http.js';
import { aiLimiter } from '../lib/rate-limiters.js';

export const assistantRouter = Router();

assistantRouter.post('/chat', aiLimiter, requireAuth, asyncHandler(async (req, res) => {
  if (!env.aiEnabled) {
    throw new ApiError(503, 'AI assistant service is currently unavailable or not enabled');
  }
  const messages = req.body.messages || (req.body.message ? [{ role: 'user', content: req.body.message }] : []);
  const reply = await getAssistantReply({
    provider: env.aiProvider,
    messages,
  });
  itemResponse(res, reply);
}));
