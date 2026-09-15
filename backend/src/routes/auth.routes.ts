import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { env, isTest } from '../env';
import { AppError, badRequest, unauthorized } from '../lib/errors';
import { checkPasswordStrength, comparePassword, hashPassword } from '../lib/password';
import { hashToken, randomToken, signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt';
import { passwordResetEmail, sendMail } from '../lib/mailer';
import { validate } from '../middleware/validate';
import { requireAuth, userId } from '../middleware/auth';
import { serializeUser } from '../lib/serialize';
import { toJson } from '../lib/json';

export const authRouter = Router();

/** Protege as rotas sensíveis contra força bruta. */
const limiteTentativas = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isTest ? 10_000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: { codigo: 'muitas_tentativas', mensagem: 'Muitas tentativas. Tente novamente em alguns minutos.' } },
});

const senhaSchema = z.string().min(8, 'A senha deve ter pelo menos 8 caracteres').max(128);

const registrarSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome').max(80),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  password: senhaSchema,
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  password: z.string().min(1, 'Informe a senha'),
  rememberMe: z.boolean().optional().default(false),
});

async function emitirTokens(user: { id: string; email: string }, rememberMe: boolean, userAgent?: string) {
  const accessToken = signAccessToken({ sub: user.id, email: user.email });
  const dias = rememberMe ? env.REFRESH_TOKEN_TTL_DAYS : env.REFRESH_TOKEN_SHORT_TTL_DAYS;
  const { token: refreshToken, expiresAt } = signRefreshToken(user.id, dias);

  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: hashToken(refreshToken), expiresAt, userAgent: userAgent?.slice(0, 200) },
  });

  return { accessToken, refreshToken, expiresAt };
}

/**
 * POST /api/auth/registrar — cria a conta e já devolve os tokens.
 */
authRouter.post('/registrar', limiteTentativas, validate(registrarSchema), async (req, res, next) => {
  try {
    const { name, email, password } = req.body as z.infer<typeof registrarSchema>;

    const forca = checkPasswordStrength(password);
    if (!forca.valid) throw badRequest('Senha fraca', forca.problemas);

    const existente = await prisma.user.findUnique({ where: { email } });
    if (existente) throw new AppError(409, 'Este e-mail já está cadastrado', 'email_em_uso');

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        trainingDays: toJson(['seg', 'ter', 'qua', 'qui', 'sex']),
      },
    });

    const tokens = await emitirTokens(user, true, req.headers['user-agent']);
    res.status(201).json({ usuario: serializeUser(user), ...tokens });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login — autentica e devolve access + refresh token.
 * `rememberMe` define a validade do refresh token.
 */
authRouter.post('/login', limiteTentativas, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password, rememberMe } = req.body as z.infer<typeof loginSchema>;
    const user = await prisma.user.findUnique({ where: { email } });
    // Mensagem genérica para não revelar se o e-mail existe
    if (!user) throw unauthorized('E-mail ou senha inválidos');

    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) throw unauthorized('E-mail ou senha inválidos');

    const tokens = await emitirTokens(user, rememberMe, req.headers['user-agent']);
    res.json({ usuario: serializeUser(user), ...tokens });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/refresh — rotação de refresh token.
 * O token antigo é revogado a cada uso (detecção de reuso).
 */
authRouter.post(
  '/refresh',
  validate(z.object({ refreshToken: z.string().min(10) })),
  async (req, res, next) => {
    try {
      const { refreshToken } = req.body as { refreshToken: string };

      let payload: { sub: string };
      try {
        payload = verifyRefreshToken(refreshToken);
      } catch {
        throw unauthorized('Sessão expirada. Faça login novamente.');
      }

      const guardado = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) } });
      if (!guardado || guardado.revokedAt || guardado.expiresAt < new Date()) {
        // Token válido na assinatura mas revogado → possível reuso: derruba a sessão toda
        await prisma.refreshToken.updateMany({
          where: { userId: payload.sub, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        throw unauthorized('Sessão expirada. Faça login novamente.');
      }

      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) throw unauthorized();

      await prisma.refreshToken.update({ where: { id: guardado.id }, data: { revokedAt: new Date() } });

      const diasRestantes = Math.max(
        1,
        Math.ceil((guardado.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
      );
      const accessToken = signAccessToken({ sub: user.id, email: user.email });
      const novo = signRefreshToken(user.id, diasRestantes);
      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(novo.token),
          expiresAt: novo.expiresAt,
          userAgent: req.headers['user-agent']?.slice(0, 200),
        },
      });

      res.json({ accessToken, refreshToken: novo.token, expiresAt: novo.expiresAt, usuario: serializeUser(user) });
    } catch (err) {
      next(err);
    }
  },
);

/** POST /api/auth/logout — revoga o refresh token informado. */
authRouter.post('/logout', validate(z.object({ refreshToken: z.string().optional() })), async (req, res, next) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (refreshToken) {
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashToken(refreshToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    res.json({ mensagem: 'Sessão encerrada' });
  } catch (err) {
    next(err);
  }
});

/** POST /api/auth/logout-todos — encerra a sessão em todos os aparelhos. */
authRouter.post('/logout-todos', requireAuth, async (req, res, next) => {
  try {
    await prisma.refreshToken.updateMany({
      where: { userId: userId(req), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    res.json({ mensagem: 'Todas as sessões foram encerradas' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/esqueci-senha — envia o link de recuperação.
 * Responde sempre 200, mesmo quando o e-mail não existe (evita enumeração).
 */
authRouter.post(
  '/esqueci-senha',
  limiteTentativas,
  validate(z.object({ email: z.string().trim().toLowerCase().email() })),
  async (req, res, next) => {
    try {
      const { email } = req.body as { email: string };
      const user = await prisma.user.findUnique({ where: { email } });

      if (user) {
        const token = randomToken();
        await prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash: hashToken(token),
            expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hora
          },
        });
        const link = `${env.APP_URL}/redefinir-senha?token=${token}`;
        await sendMail({ to: user.email, ...passwordResetEmail(user.name, link) });
      }

      res.json({ mensagem: 'Se o e-mail estiver cadastrado, você receberá o link de recuperação.' });
    } catch (err) {
      next(err);
    }
  },
);

/** POST /api/auth/redefinir-senha — troca a senha usando o token do e-mail. */
authRouter.post(
  '/redefinir-senha',
  limiteTentativas,
  validate(z.object({ token: z.string().min(10), password: senhaSchema })),
  async (req, res, next) => {
    try {
      const { token, password } = req.body as { token: string; password: string };

      const forca = checkPasswordStrength(password);
      if (!forca.valid) throw badRequest('Senha fraca', forca.problemas);

      const registro = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
      if (!registro || registro.usedAt || registro.expiresAt < new Date()) {
        throw badRequest('Link inválido ou expirado. Peça um novo.');
      }

      await prisma.$transaction([
        prisma.user.update({
          where: { id: registro.userId },
          data: { passwordHash: await hashPassword(password) },
        }),
        prisma.passwordResetToken.update({ where: { id: registro.id }, data: { usedAt: new Date() } }),
        // Por segurança, derruba todas as sessões ativas
        prisma.refreshToken.updateMany({
          where: { userId: registro.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        }),
      ]);

      res.json({ mensagem: 'Senha alterada com sucesso. Faça login novamente.' });
    } catch (err) {
      next(err);
    }
  },
);

/** POST /api/auth/forca-senha — utilitário usado pelo medidor de força no cadastro. */
authRouter.post('/forca-senha', validate(z.object({ password: z.string() })), (req, res) => {
  res.json(checkPasswordStrength((req.body as { password: string }).password));
});
