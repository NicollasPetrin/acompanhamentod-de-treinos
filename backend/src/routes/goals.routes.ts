import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, userId } from '../middleware/auth';
import { getQuery, validate } from '../middleware/validate';
import { notFound } from '../lib/errors';
import { metasComProgresso } from '../services/goals';
import { booleanoDaQuery } from '../lib/zod';

export const goalsRouter = Router();
goalsRouter.use(requireAuth);

const metaSchema = z.object({
  title: z.string().trim().min(3).max(120),
  type: z.enum(['carga', '1rm', 'reps', 'peso_corporal', 'frequencia', 'volume']),
  exerciseId: z.string().nullable().optional(),
  targetValue: z.number().min(0).max(100000),
  startValue: z.number().min(0).max(100000).nullable().optional(),
  deadline: z.coerce.date().nullable().optional(),
});

/** GET /api/metas — metas com valor atual e progresso calculados. */
goalsRouter.get(
  '/',
  validate(z.object({ abertas: booleanoDaQuery.optional() }), 'query'),
  async (req, res, next) => {
    try {
      const { abertas } = getQuery<{ abertas?: boolean }>(req);
      res.json(await metasComProgresso(userId(req), abertas ?? false));
    } catch (err) {
      next(err);
    }
  },
);

/** POST /api/metas — cria meta (ex.: "Supino 100 kg até dezembro"). */
goalsRouter.post('/', validate(metaSchema), async (req, res, next) => {
  try {
    const uid = userId(req);
    const body = req.body as z.infer<typeof metaSchema>;

    if (body.exerciseId) {
      const existe = await prisma.exercise.findFirst({
        where: { id: body.exerciseId, OR: [{ createdById: null }, { createdById: uid }] },
      });
      if (!existe) throw notFound('Exercício não encontrado');
    }

    const meta = await prisma.goal.create({
      data: {
        userId: uid,
        title: body.title,
        type: body.type,
        exerciseId: body.exerciseId ?? null,
        targetValue: body.targetValue,
        startValue: body.startValue ?? null,
        deadline: body.deadline ?? null,
      },
    });

    const comProgresso = (await metasComProgresso(uid)).find((m) => m.id === meta.id);
    res.status(201).json(comProgresso ?? meta);
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/metas/:id */
goalsRouter.patch('/:id', validate(metaSchema.partial().extend({ completed: z.boolean().optional() })), async (req, res, next) => {
  try {
    const uid = userId(req);
    const atual = await prisma.goal.findFirst({ where: { id: req.params.id, userId: uid } });
    if (!atual) throw notFound('Meta não encontrada');

    const body = req.body as Partial<z.infer<typeof metaSchema>> & { completed?: boolean };
    await prisma.goal.update({
      where: { id: atual.id },
      data: {
        ...body,
        ...(body.completed !== undefined
          ? { completed: body.completed, completedAt: body.completed ? new Date() : null }
          : {}),
      },
    });

    const comProgresso = (await metasComProgresso(uid)).find((m) => m.id === atual.id);
    res.json(comProgresso);
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/metas/:id */
goalsRouter.delete('/:id', async (req, res, next) => {
  try {
    const atual = await prisma.goal.findFirst({ where: { id: req.params.id, userId: userId(req) } });
    if (!atual) throw notFound('Meta não encontrada');
    await prisma.goal.delete({ where: { id: atual.id } });
    res.json({ mensagem: 'Meta excluída' });
  } catch (err) {
    next(err);
  }
});
