import { env } from '../config/env.js';
import { ApiError } from '../utils/http.js';
import { fetchWithTimeout } from './fetch.js';

const isConfigured = (value) => value && !value.includes('placeholder');

const textFromOpenAi = (payload) =>
  payload.output
    ?.flatMap((item) => item.content || [])
    .filter((item) => item.type === 'output_text')
    .map((item) => item.text)
    .join('') || payload.choices?.[0]?.message?.content;

export const getAssistantReply = async ({ provider = env.aiProvider, messages }) => {
  if (!['openai', 'anthropic'].includes(provider)) {
    throw new ApiError(400, 'provider must be openai or anthropic');
  }

  if (!Array.isArray(messages) || !messages.length || messages.length > 20) {
    throw new ApiError(400, 'At least one assistant message is required');
  }

  const normalizedMessages = messages.map((message) => {
    const role = message?.role;
    const content = typeof message?.content === 'string' ? message.content.trim() : '';
    if (!['user', 'assistant'].includes(role) || !content || content.length > 4000) {
      throw new ApiError(400, 'Messages must contain a user or assistant role and up to 4,000 characters of text');
    }
    return { role, content };
  });

  if (provider === 'openai') {
    if (!isConfigured(env.openaiApiKey)) throw new ApiError(503, 'OpenAI is not configured');
    const response = await fetchWithTimeout('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.openaiApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: env.openaiModel, input: normalizedMessages, instructions: env.aiSystemPrompt }),
    }, 'OpenAI');
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new ApiError(502, payload.error?.message || 'OpenAI request failed');
    return { provider, model: env.openaiModel, message: textFromOpenAi(payload) };
  }

  if (!isConfigured(env.anthropicApiKey)) throw new ApiError(503, 'Anthropic is not configured');
  const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model: env.anthropicModel, max_tokens: 1024, messages: normalizedMessages, system: env.aiSystemPrompt }),
  }, 'Anthropic');
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(502, payload.error?.message || 'Anthropic request failed');
  return {
    provider,
    model: env.anthropicModel,
    message: payload.content?.filter((item) => item.type === 'text').map((item) => item.text).join(''),
  };
};
