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

  /** Limite do upload de fotos (elas são comprimidas no app antes de subir). */
  MAX_UPLOAD_MB: z.coerce.number().positive().default(5),

  // E-mail (recuperação de senha). Sem SMTP configurado os e-mails são
  // apenas impressos no console — suficiente para desenvolvimento.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('Treinos <nao-responda@treinos.app>'),

  // Notificações (Web Push). As chaves VAPID são opcionais: sem elas o app gera
  // um par na primeira vez e guarda no banco. Defina aqui só para fixar as suas.
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  /** Contato exigido pelos serviços de push (mailto: ou https:). */
  VAPID_SUBJECT: z.string().optional(),

  // Agendamento das notificações com hora marcada (fim do descanso com o app
  // fechado). Em servidor que fica ligado (sua máquina, Render) um timer basta.
  // Em hospedagem sem servidor (Vercel), o processo dorme entre requisições —
  // aí quem "acorda" a API na hora certa é o QStash, da Upstash (grátis).
  QSTASH_URL: z.string().default('https://qstash.upstash.io'),
  QSTASH_TOKEN: z.string().optional(),
  QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().optional(),
  /** Endereço público da API, para o QStash chamar de volta. */
  API_PUBLIC_URL: z.string().optional(),
});

/**
 * Em hospedagens como o Render, a URL pública do serviço chega em
 * RENDER_EXTERNAL_URL. Usamos ela como padrão para os links de e-mail e para o
 * CORS, evitando ter que configurar isso à mão a cada deploy.
 */
const ambiente: NodeJS.ProcessEnv = { ...process.env };
const urlPublica = process.env.RENDER_EXTERNAL_URL;
if (urlPublica) {
  ambiente.APP_URL ??= urlPublica;
  ambiente.CORS_ORIGINS ??= urlPublica;
}
// Na Vercel, o domínio de produção vem pronto — é para lá que o QStash liga
const dominioVercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
ambiente.API_PUBLIC_URL ??= urlPublica ?? (dominioVercel ? `https://${dominioVercel}` : undefined);

const parsed = schema.safeParse(ambiente);

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
