import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, userId } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { serializeUser } from '../lib/serialize';
import { toJson } from '../lib/json';
import { badRequest, notFound } from '../lib/errors';
import { checkPasswordStrength, comparePassword, hashPassword } from '../lib/password';
import { uploadImagem, urlDaFoto } from '../lib/upload';

export const usersRouter = Router();
usersRouter.use(requireAuth);

const perfilSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  birthDate: z.coerce.date().nullable().optional(),
  sex: z.enum(['masculino', 'feminino', 'outro']).nullable().optional(),
  heightCm: z.number().min(80).max(260).nullable().optional(),
  weightKg: z.number().min(20).max(400).nullable().optional(),
  goal: z.enum(['hipertrofia', 'emagrecimento', 'forca', 'condicionamento']).nullable().optional(),
  level: z.enum(['iniciante', 'intermediario', 'avancado']).nullable().optional(),
  photoUrl: z.string().nullable().optional(),
});

/** Cores de destaque disponíveis (a paleta vive no frontend, em lib/tema.ts). */
export const CORES_DESTAQUE = [
  'verde',
  'rosa',
  'roxo',
  'azul',
  'ciano',
  'laranja',
  'vermelho',
  'amarelo',
] as const;

const preferenciasSchema = z.object({
  weightUnit: z.enum(['kg', 'lb']).optional(),
  theme: z.enum(['dark', 'light']).optional(),
  accentColor: z.enum(CORES_DESTAQUE).optional(),
  trainingDays: z.array(z.enum(['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'])).optional(),
  defaultRestSec: z.number().int().min(15).max(600).optional(),
  remindersOn: z.boolean().optional(),
  reminderTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use o formato HH:MM')
    .nullable()
    .optional(),
});

/** GET /api/usuarios/eu — dados do usuário autenticado. */
usersRouter.get('/eu', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId(req) } });
    if (!user) throw notFound('Usuário não encontrado');
    res.json(serializeUser(user));
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/usuarios/eu — atualiza dados de perfil. */
usersRouter.patch('/eu', validate(perfilSchema), async (req, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: userId(req) },
      data: req.body as z.infer<typeof perfilSchema>,
    });
    res.json(serializeUser(user));
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/usuarios/eu/preferencias — unidade, tema, dias de treino, descanso padrão. */
usersRouter.patch('/eu/preferencias', validate(preferenciasSchema), async (req, res, next) => {
  try {
    const { trainingDays, ...resto } = req.body as z.infer<typeof preferenciasSchema>;
    const user = await prisma.user.update({
      where: { id: userId(req) },
      data: { ...resto, ...(trainingDays ? { trainingDays: toJson(trainingDays) } : {}) },
    });
    res.json(serializeUser(user));
  } catch (err) {
    next(err);
  }
});

/** POST /api/usuarios/eu/foto — envia a foto de perfil (multipart/form-data, campo `foto`). */
usersRouter.post('/eu/foto', uploadImagem.single('foto'), async (req, res, next) => {
  try {
    const uid = userId(req);
    if (!req.file) throw badRequest('Envie um arquivo no campo "foto"');

    const foto = await prisma.photo.create({
      data: {
        userId: uid,
        mimeType: req.file.mimetype,
        size: req.file.size,
        // Uint8Array é o formato que o Prisma espera em colunas Bytes
        data: new Uint8Array(req.file.buffer),
      },
    });

    const anterior = await prisma.user.findUnique({ where: { id: uid }, select: { photoUrl: true } });
    const user = await prisma.user.update({ where: { id: uid }, data: { photoUrl: urlDaFoto(foto.id) } });

    // A foto antiga não serve mais para nada: sai do banco junto
    const idAnterior = anterior?.photoUrl?.match(/\/api\/fotos\/(.+)$/)?.[1];
    if (idAnterior) await prisma.photo.deleteMany({ where: { id: idAnterior, userId: uid } });

    res.json(serializeUser(user));
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/usuarios/eu/senha — troca de senha (exige a senha atual). */
usersRouter.patch(
  '/eu/senha',
  validate(z.object({ senhaAtual: z.string().min(1), novaSenha: z.string().min(8).max(128) })),
  async (req, res, next) => {
    try {
      const { senhaAtual, novaSenha } = req.body as { senhaAtual: string; novaSenha: string };
      const user = await prisma.user.findUnique({ where: { id: userId(req) } });
      if (!user) throw notFound('Usuário não encontrado');

      if (!(await comparePassword(senhaAtual, user.passwordHash))) {
        throw badRequest('Senha atual incorreta');
      }
      const forca = checkPasswordStrength(novaSenha);
      if (!forca.valid) throw badRequest('Senha fraca', forca.problemas);

      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(novaSenha) },
      });
      await prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      res.json({ mensagem: 'Senha alterada. Faça login novamente.' });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /api/usuarios/eu — exclusão definitiva da conta.
 * Exige a senha e a confirmação textual "EXCLUIR" como dupla checagem.
 */
usersRouter.delete(
  '/eu',
  validate(z.object({ password: z.string().min(1), confirmacao: z.string() })),
  async (req, res, next) => {
    try {
      const { password, confirmacao } = req.body as { password: string; confirmacao: string };
      if (confirmacao.trim().toUpperCase() !== 'EXCLUIR') {
        throw badRequest('Digite EXCLUIR para confirmar a exclusão da conta');
      }

      const user = await prisma.user.findUnique({ where: { id: userId(req) } });
      if (!user) throw notFound('Usuário não encontrado');
      if (!(await comparePassword(password, user.passwordHash))) throw badRequest('Senha incorreta');

      // onDelete: Cascade no schema remove rotinas, treinos, medidas, metas etc.
      await prisma.user.delete({ where: { id: user.id } });
      res.json({ mensagem: 'Conta excluída. Sentiremos sua falta!' });
    } catch (err) {
      next(err);
    }
  },
);
