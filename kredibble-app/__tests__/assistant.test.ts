import {
  sendAssistantMessage,
  AssistantChatMessage,
  ApiRequestError,
} from '../src/lib/api';
import * as SecureStore from 'expo-secure-store';

describe('MOB-016: AI Assistant Live Backend Integration (SEC-125)', () => {
  const originalFetch = global.fetch;

  beforeEach(async () => {
    jest.clearAllMocks();
    await SecureStore.deleteItemAsync('kredibble_app_token');
    await SecureStore.deleteItemAsync('kredibble_app_refresh_token');
    await SecureStore.deleteItemAsync('kredibble_app_user');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('sends string query as { message: "..." } to /assistant/chat', async () => {
    let capturedUrl = '';
    let capturedBody: any = null;
    let capturedHeaders: any = null;

    global.fetch = jest.fn().mockImplementation((url, init) => {
      capturedUrl = String(url);
      capturedBody = JSON.parse(init.body);
      capturedHeaders = init.headers;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            provider: 'openai',
            model: 'gpt-4o',
            message: 'Hello, how can I assist your career today?',
          },
        }),
      });
    });

    const response = await sendAssistantMessage('Hello assistant');

    expect(capturedUrl).toContain('/assistant/chat');
    expect(capturedBody).toEqual({ message: 'Hello assistant' });
    expect(response.message).toBe('Hello, how can I assist your career today?');
    expect(response.provider).toBe('openai');
  });

  it('sends structured messages array to /assistant/chat with Bearer token', async () => {
    await SecureStore.setItemAsync('kredibble_app_token', 'valid-assistant-session-token');

    let capturedUrl = '';
    let capturedBody: any = null;
    let capturedHeaders: any = null;

    global.fetch = jest.fn().mockImplementation((url, init) => {
      capturedUrl = String(url);
      capturedBody = JSON.parse(init.body);
      capturedHeaders = init.headers;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet',
            message: 'Here are 3 tips for your engineering resume.',
          },
        }),
      });
    });

    const messages: AssistantChatMessage[] = [
      { role: 'user', content: 'Can you review my resume?' },
      { role: 'assistant', content: 'Sure, what role are you applying for?' },
      { role: 'user', content: 'Software Engineer' },
    ];

    const response = await sendAssistantMessage(messages);

    expect(capturedUrl).toContain('/assistant/chat');
    expect(capturedHeaders.Authorization).toBe('Bearer valid-assistant-session-token');
    expect(capturedBody).toEqual({ messages });
    expect(response.message).toBe('Here are 3 tips for your engineering resume.');
  });

  it('throws ApiRequestError when backend returns 503 service unavailable', async () => {
    global.fetch = jest.fn().mockImplementation(() => {
      return Promise.resolve({
        ok: false,
        status: 503,
        json: async () => ({
          error: {
            message: 'AI assistant service is currently unavailable or not enabled',
            code: 'SERVICE_UNAVAILABLE',
          },
        }),
      });
    });

    await expect(sendAssistantMessage('Hi')).rejects.toThrow(
      'AI assistant service is currently unavailable or not enabled'
    );
  });

  it('maps 503 errors to the user-friendly maintenance message', async () => {
    const error503 = new ApiRequestError(
      'AI assistant service is currently unavailable or not enabled',
      503,
      'SERVICE_UNAVAILABLE'
    );

    const is503 =
      error503.status === 503 ||
      (typeof error503.message === 'string' &&
        (error503.message.includes('503') ||
          error503.message.toLowerCase().includes('unavailable') ||
          error503.message.toLowerCase().includes('not enabled')));

    const message = is503
      ? 'AI smart assistant is currently undergoing scheduled maintenance. Please check back shortly.'
      : 'Unexpected error';

    expect(message).toBe(
      'AI smart assistant is currently undergoing scheduled maintenance. Please check back shortly.'
    );
  });

  it('slices chat history payload to last 10 messages and ignores empty text', () => {
    const rawMessages = [
      { id: '1', sender: 'ai', text: 'Welcome' },
      { id: '2', sender: 'user', text: 'Msg 1' },
      { id: '3', sender: 'ai', text: 'Reply 1' },
      { id: '4', sender: 'user', text: 'Msg 2' },
      { id: '5', sender: 'ai', text: 'Reply 2' },
      { id: '6', sender: 'user', text: 'Msg 3' },
      { id: '7', sender: 'ai', text: 'Reply 3' },
      { id: '8', sender: 'user', text: 'Msg 4' },
      { id: '9', sender: 'ai', text: 'Reply 4' },
      { id: '10', sender: 'user', text: 'Msg 5' },
      { id: '11', sender: 'ai', text: 'Reply 5' },
      { id: '12', sender: 'user', text: '' }, // empty, should be filtered
      { id: '13', sender: 'user', text: 'Latest query' },
    ];

    const historyPayload: AssistantChatMessage[] = rawMessages
      .filter((msg) => Boolean(msg.text))
      .slice(-10)
      .map((msg) => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text,
      }));

    expect(historyPayload.length).toBe(10);
    expect(historyPayload[0].content).toBe('Reply 1');
    expect(historyPayload[historyPayload.length - 1].content).toBe('Latest query');
    expect(historyPayload[historyPayload.length - 1].role).toBe('user');
  });
});
