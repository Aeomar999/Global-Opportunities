import { z } from 'zod';

// SEC-041: bounds for the AI assistant conversation.
// - MAX_MESSAGES caps conversation depth (LLM10 unbounded consumption).
// - MAX_CONTENT_CHARS caps a single turn; TOTAL_CONTENT_CHARS caps the whole
//   request so one 1MB body cannot translate into a very large provider bill.
const MAX_MESSAGES = 50;
const MAX_CONTENT_CHARS = 4000;
const TOTAL_CONTENT_CHARS = 20000;

const chatMessageSchema = z.object({
  // Only 'user' and 'assistant' are accepted. A client cannot inject a
  // 'system' turn to escalate privilege inside the conversation.
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1, 'Message content is required').max(MAX_CONTENT_CHARS, `Message content must be at most ${MAX_CONTENT_CHARS} characters`),
});

const bodySchema = z
  .object({
    provider: z.enum(['openai', 'anthropic']).optional(),
    messages: z.array(chatMessageSchema).min(1, 'At least one message is required').max(MAX_MESSAGES, `At most ${MAX_MESSAGES} messages are allowed`).optional(),
    // Single-turn convenience; the route converts it to a one-element user list.
    message: z.string().min(1, 'Message is required').max(MAX_CONTENT_CHARS, `Message must be at most ${MAX_CONTENT_CHARS} characters`).optional(),
  })
  // At least one of `messages` / `message` must be present.
  .refine((d) => Boolean(d.messages?.length || d.message), { message: 'Provide either messages[] or message' })
  // A conversation must open with a user turn (correct for both providers).
  .refine((d) => !d.messages || d.messages[0].role === 'user', { message: 'The first message must have role "user"', path: ['messages'] })
  // Request-level size budget across all turns.
  .refine(
    (d) => {
      const total = d.messages
        ? d.messages.reduce((sum, m) => sum + m.content.length, 0)
        : (d.message ? d.message.length : 0);
      return total <= TOTAL_CONTENT_CHARS;
    },
    { message: `Total conversation content must be at most ${TOTAL_CONTENT_CHARS} characters` },
  );

export const assistantChatSchema = z.object({ body: bodySchema });
