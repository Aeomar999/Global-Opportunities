import { Router } from 'express';
import { getAssistantReply } from '../lib/ai.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, itemResponse } from '../utils/http.js';

export const assistantRouter = Router();

assistantRouter.post('/chat', requireAuth, asyncHandler(async (req, res) => {
  const messages = req.body.messages || (req.body.message ? [{ role: 'user', content: req.body.message }] : []);
  const reply = await getAssistantReply({
    provider: req.body.provider,
    messages,
    systemPrompt: req.body.systemPrompt,
  });
  itemResponse(res, reply);
}));
