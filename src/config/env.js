/**
 * Environment Configuration
 *
 * Validates all environment variables on startup using Zod.
 * Fails fast if any required variable is missing or malformed —
 * this prevents the app from starting in a broken state.
 *
 * The validated config is frozen to prevent accidental mutation.
 * Import this module wherever you need access to env vars instead
 * of reading process.env directly.
 */

import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM replacement for __dirname — needed to locate the .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Only load .env file in non-production environments
// In production, env vars come from the deployment platform (Docker, Render, etc.)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

// Zod schema — validates and coerces every env var with sensible defaults
const envSchema = z.object({
  // ─── App ──────────────────────────────────────────────────
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3500),
  API_VERSION: z.string().default('v1'),

  // ─── MongoDB ──────────────────────────────────────────────
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),

  // ─── Redis ────────────────────────────────────────────────
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),

  // ─── RabbitMQ ─────────────────────────────────────────────
  RABBITMQ_URL: z.string().default('amqp://guest:guest@localhost:5672'),
  ANALYSIS_QUEUE: z.string().default('lexai.analysis.queue'),
  ALERT_QUEUE: z.string().default('lexai.alert.queue'),
  DLX_EXCHANGE: z.string().default('lexai.dlx'),
  NOTIFICATION_QUEUE: z.string().default('lexai.notification.queue'),
  ANALYTICS_EVENTS_QUEUE: z.string().default('lexai.analytics.queue'),
  ORDER_QUEUE: z.string().default('lexai.order.queue'),
  REVIEW_QUEUE: z.string().default('lexai.review.queue'),

  // ─── PASETO ───────────────────────────────────────────────
  PASETO_LOCAL_SECRET: z.string().min(32, 'PASETO_LOCAL_SECRET must be at least 32 characters'),
  PASETO_ACCESS_EXPIRY: z.string().regex(/^\d+[smhd]$/, 'Must be like 15m, 7d, 1h, 30s').default('15m'),
  PASETO_REFRESH_EXPIRY: z.string().regex(/^\d+[smhd]$/, 'Must be like 15m, 7d, 1h, 30s').default('7d'),
  PASETO_REFRESH_COOKIE_MAX_AGE_MS: z.coerce.number().default(604800000), // 7 days in ms

  // ─── AI Provider Configuration ────────────────────────────
  // Which provider to use as primary: 'groq' or 'openrouter'
  AI_PROVIDER: z.enum(['groq', 'openrouter']).default('groq'),
  AI_PRIMARY_MODEL: z.string().default('llama-3.3-70b-versatile'),
  AI_FALLBACK_MODEL: z.string().default('llama-3.1-8b-instant'),
  AI_DIFF_MODEL: z.string().default('llama-3.1-8b-instant'),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().default(60000),

  // ─── Groq ──────────────────────────────────────────────────
  GROQ_API_KEY: z.string().default(''),
  GROQ_BASE_URL: z.string().url().default('https://api.groq.com/openai/v1'),

  // ─── OpenRouter (optional fallback) ────────────────────────
  OPENROUTER_API_KEY: z.string().default(''),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),

  // ─── Rate Limiting ────────────────────────────────────────
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),  // 1 minute
  RATE_LIMIT_MAX: z.coerce.number().default(100),

  // ─── File Upload ──────────────────────────────────────────
  MAX_FILE_SIZE_MB: z.coerce.number().default(5),
  ALLOWED_MIME_TYPES: z.string().default(
    'application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain'
  ),

  // ─── CORS ─────────────────────────────────────────────────
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:5173'),

  // ─── Email (Gmail SMTP) ──────────────────────────────────
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.string().transform((v) => v === 'true').default('false'),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  EMAIL_FROM: z.string().default('noreply@lexai.io'),
  // Gmail credentials — used directly by the nodemailer transporter
  MAIL_USER: z.string().min(1, 'MAIL_USER (Gmail address) is required'),
  MAIL_PASS: z.string().min(1, 'MAIL_PASS (Gmail App Password) is required'),

  // ─── Redis Token TTLs ─────────────────────────────────────
  // How long password reset tokens live in Redis (seconds)
  PASSWORD_RESET_EXPIRY: z.coerce.number().default(3600), // 1 hour
  // How long email OTP lives in Redis (seconds) — 10 minutes
  OTP_EXPIRY: z.coerce.number().default(600),

  // ─── External APIs ───────────────────────────────────────
  REST_COUNTRIES_URL: z.string().url().default('https://restcountries.com/v3.1'),
  WORLD_TIME_API_URL: z.string().url().default('https://worldtimeapi.org/api'),

  // IPinfo — IP geolocation for login security (optional token, 50k req/mo free without)
  IPINFO_TOKEN: z.string().optional().default(''),

  // HaveIBeenPwned — email breach checking (requires paid API key from haveibeenpwned.com)
  HIBP_API_KEY: z.string().optional().default(''),

  // ─── Admin Bootstrap (seed script only) ──────────────────
  ADMIN_EMAIL: z.string().email().default('admin@lexai.io'),
  ADMIN_PASSWORD: z.string().default('Admin112233'),
});

// Parse and validate — exit immediately on failure
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Environment validation failed:');
  console.error(parsed.error.format());
  process.exit(1);
}

// Freeze the config to prevent accidental mutation anywhere in the app
const env = Object.freeze(parsed.data);

// ─── Production Safety Checks ─────────────────────────────────────────────
// Fail fast if placeholder secrets are used in production
if (env.NODE_ENV === 'production') {
    const PLACEHOLDER_PATTERNS = [
        'change-me',
        'your-key-here',
        'secret',
        'example',
        'placeholder',
        'Admin112233',
        'admin@lexai.io',
    ];

    const sensitiveKeys = ['PASETO_LOCAL_SECRET', 'GROQ_API_KEY', 'OPENROUTER_API_KEY'];
    for (const key of sensitiveKeys) {
        const val = env[key] || '';
        if (PLACEHOLDER_PATTERNS.some(p => val.toLowerCase().includes(p.toLowerCase()))) {
            console.error(`❌ SECURITY: ${key} appears to be a placeholder value. Set a real secret before running in production.`);
            process.exit(1);
        }
    }
}

export default env;
