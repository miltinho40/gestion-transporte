import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  CORS_ORIGIN: z.string().default('http://localhost:4200,http://127.0.0.1:4200'),
  FRONTEND_URL: z.string().default('http://localhost:4200'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  AI_PROVIDER: z.enum(['rules', 'openai']).default('rules'),
  OPENAI_API_KEY: z.string().trim().min(1).optional(),
  OPENAI_MODEL: z.string().trim().min(1).default('gpt-5.6-luna'),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(10000),
  OPENAI_MIN_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.55),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('Gestion Transporte <no-reply@localhost>')
});

export const env = envSchema.parse(process.env);
