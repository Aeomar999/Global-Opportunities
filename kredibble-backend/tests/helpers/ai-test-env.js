// Must be imported BEFORE anything that loads src/config/env.js so the AI
// provider keys are present when env.js reads process.env. Importing this
// side-effect-only module first guarantees that (ESM evaluates imports in
// declaration order). The real outbound call is mocked in the test.
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-openai-key';
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-anthropic-key';
process.env.AI_PROVIDER = process.env.AI_PROVIDER || 'openai';
