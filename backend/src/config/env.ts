import dotenv from 'dotenv';
dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const isProduction = (process.env.NODE_ENV ?? 'development') === 'production';

if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be at least 32 characters in production.');
}
if (isProduction && (!process.env.EMAIL_INGEST_SECRET || process.env.EMAIL_INGEST_SECRET.length < 16)) {
  throw new Error('EMAIL_INGEST_SECRET must be configured in production.');
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  mongoUri: required('MONGODB_URI', 'mongodb://127.0.0.1:27017/resolveai'),
  jwtSecret: required('JWT_SECRET', 'dev-only-insecure-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',

  // Gemini — backend only. Never sent to the browser.
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',

  // Cognee
  cogneeApiUrl: process.env.COGNEE_API_URL ?? '',
  cogneeApiKey: process.env.COGNEE_API_KEY ?? '',
  cogneeDataset: process.env.COGNEE_DATASET ?? 'resolveai',

  // n8n Cloud — backend only.
  n8nBaseUrl: process.env.N8N_BASE_URL ?? '',
  n8nWebhookSecret: process.env.N8N_WEBHOOK_SECRET ?? '',
  n8nPaths: {
    reconciliation: process.env.N8N_PATH_RECONCILIATION ?? 'resolveai-reconciliation',
    refund: process.env.N8N_PATH_REFUND ?? 'resolveai-refund',
    escalation: process.env.N8N_PATH_ESCALATION ?? 'resolveai-escalation',
    notification: process.env.N8N_PATH_NOTIFICATION ?? 'resolveai-notification',
  },

  autonomousRefundCeiling: Number(process.env.AUTONOMOUS_REFUND_CEILING ?? 5000),
  minAutonomousConfidence: Number(process.env.MIN_AUTONOMOUS_CONFIDENCE ?? 0.8),
  maxActionAttempts: Number(process.env.MAX_ACTION_ATTEMPTS ?? 2),
  emailIngestSecret: process.env.EMAIL_INGEST_SECRET ?? 'dev-email-secret',
};

export const isGeminiConfigured = () => env.geminiApiKey.length > 0;
export const isCogneeConfigured = () => env.cogneeApiUrl.length > 0 && env.cogneeApiKey.length > 0;
export const isN8nConfigured = () => env.n8nBaseUrl.length > 0;
