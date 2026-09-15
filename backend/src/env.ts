import 'dotenv/config';
import { z } from 'zod';

/**
 * Validação das variáveis de ambiente. A aplicação falha rápido (na subida)
 * caso alguma configuração obrigatória esteja ausente ou inválida.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z.string().min(1).default('file:./dev.db'),

  JWT_ACCESS_SECRET: z.string().min(16).default('dev-access-secret-troque-em-producao'),
  JWT_REFRESH_SECRET: z.string().min(16).default('dev-refresh-secret-troque-em-producao'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  /** "Manter conectado" desmarcado → refresh token curto. */
  REFRESH_TOKEN_SHORT_TTL_DAYS: z.coerce.number().int().positive().default(1),

  APP_URL: z.string().default('http://localhost:5173'),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:4173'),

  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(5),

  // E-mail (recuperação de senha). Sem SMTP configurado os e-mails são
  // apenas impressos no console — suficiente para desenvolvimento.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('Treinos <nao-responda@treinos.app>'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas:', parsed.error.flatten().fieldErrors);
  throw new Error('Configuração inválida. Confira o arquivo .env');
}

export const env = parsed.data;

export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
