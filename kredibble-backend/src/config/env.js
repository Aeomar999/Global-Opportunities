import dotenv from 'dotenv';

dotenv.config();

const parseOrigins = (value) =>
  value
    ? value.split(',').map((origin) => origin.trim()).filter(Boolean)
    : ['http://localhost:3000', 'http://localhost:8081', 'http://localhost:19006'];

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isDevelopment: (process.env.NODE_ENV || 'development') !== 'production',
  port: Number(process.env.PORT || 4000),
  corsOrigins: parseOrigins(process.env.CORS_ORIGIN),
  databaseUrl: process.env.DATABASE_URL || process.env.MONGODB_URI || process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET || '4f7b8d9c2e1a3b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c',
  adminJwtSecret: process.env.ADMIN_JWT_SECRET || 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
  aiProvider: process.env.AI_PROVIDER || 'openai',
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
  insightGhanaWordpressUrl: process.env.INSIGHT_GHANA_WORDPRESS_URL,
  africanJournalWordpressUrl: process.env.AFRICAN_JOURNAL_WORDPRESS_URL,
  resendApiKey: process.env.RESEND_API_KEY,
  resendFromEmail: process.env.RESEND_FROM_EMAIL,
  emailVerificationCodeTtlMinutes: Number(process.env.EMAIL_VERIFICATION_CODE_TTL_MINUTES || 10),
  outboundRequestTimeoutMs: Number(process.env.OUTBOUND_REQUEST_TIMEOUT_MS || 10000),
  aiSystemPrompt: process.env.AI_SYSTEM_PROMPT || 'You are the Global Opportunities assistant. Give accurate, helpful opportunity guidance.',
  wordpressSyncBaseUrl: process.env.WORDPRESS_SYNC_BASE_URL,
  wordpressApiKey: process.env.WORDPRESS_API_KEY,
};

if (!env.isDevelopment) {
  const secrets = ['jwtSecret', 'adminJwtSecret'];
  for (const key of secrets) {
    if (env[key].includes('replace-with') || env[key].includes('placeholder') || env[key] === '4f7b8d9c2e1a3b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c' || env[key] === 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2') {
      throw new Error(`CRITICAL SECURITY ERROR: ${key} is using a fallback or placeholder value in production! You must set proper environment variables.`);
    }
  }
  if (!env.databaseUrl) {
    throw new Error(`CRITICAL ERROR: databaseUrl is missing in production!`);
  }
  if (!env.corsOrigins.length || env.corsOrigins.some((origin) => origin.includes('localhost'))) {
    throw new Error('CRITICAL ERROR: CORS_ORIGIN must contain only deployed application origins in production.');
  }
  if (!Number.isFinite(env.outboundRequestTimeoutMs) || env.outboundRequestTimeoutMs < 1000) {
    throw new Error('CRITICAL ERROR: OUTBOUND_REQUEST_TIMEOUT_MS must be at least 1000.');
  }
  const providerKey = env.aiProvider === 'anthropic' ? env.anthropicApiKey : env.openaiApiKey;
  if (!providerKey || providerKey.includes('placeholder')) {
    throw new Error(`CRITICAL ERROR: the configured ${env.aiProvider} API key is missing.`);
  }
  if (!env.resendApiKey || env.resendApiKey.includes('placeholder') || !env.resendFromEmail) {
    throw new Error('CRITICAL ERROR: Resend must be configured in production.');
  }
  if (Boolean(env.wordpressSyncBaseUrl) !== Boolean(env.wordpressApiKey)) {
    throw new Error('CRITICAL ERROR: WORDPRESS_SYNC_BASE_URL and WORDPRESS_API_KEY must be configured together.');
  }
}
