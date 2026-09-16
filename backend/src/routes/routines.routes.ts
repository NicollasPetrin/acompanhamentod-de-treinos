import { Router } from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { prisma } from '../lib/prisma';
import { optionalAuth, requireAuth, userId } from '../middleware/auth';
import { getQuery, validate } from '../middleware/validate';
import { serializeExercise } from '../lib/serialize';
import { badRequest, notFound } from '../lib/errors';
import { TEMPLATES, getTemplate } from '../data/templates';
import { booleanoDaQuery } from '../lib/zod';

export const routinesRouter = Router();

const incluiEstrutura = {
  days: {
    orderBy: { order: 'asc' as const },
    include: {
      exercises: {
        orderBy: { order: 'asc' as const },
        include: { exercise: true },
      },
    },
  },
};

type RotinaComEstrutura = {
  days: Array<{ exercises: Array<{ exercise: Record<string, unknown> }> }>;
} & Record<string, unknown>;

const serializeRoutine = (rotina: RotinaComEstrutura) => ({
  ...rotina,
  days: rotina.days.map((d) => ({
    ...d,
    exercises: d.exercises.map((re) => ({ ...re, exercise: serializeExercise(re.exercise) })),
  })),
});

/** Busca a rotina garantindo que pertence ao usuário autenticado. */
async function rotinaDoUsuario(uid: string, routineId: string) {
  const rotina = await prisma.routine.findFirst({
    where: { id: routineId, userId: uid },
    include: incluiEstrutura,
  });
  if (!rotina) throw notFound('Rotina não encontrada');
  return rotina;
}

async function diaDoUsuario(uid: string, dayId: string) {
  const dia = await prisma.routineDay.findFirst({
    where: { id: dayId, routine: { userId: uid } },
    include: { routine: { select: { id: true } } },
  });
  if (!dia) throw notFound('Dia de treino não encontrado');
  return dia;
}

const rotinaSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().max(1000).nullable().optional(),
  goal: z.string().max(60).nullable().optional(),
  isActive: z.boolean().optional(),
});

const diaSchema = z.object({
  name: z.string().trim().min(1).max(80),
  notes: z.string().max(1000).nullable().optional(),
  order: z.number().int().min(0).optional(),
});

const exercicioRotinaSchema = z.object({
  exerciseId: z.string().min(1),
  sets: z.number().int().min(1).max(20).default(3),
  repsMin: z.number().int().min(1).max(200).default(8),
  repsMax: z.number().int().min(1).max(200).default(12),
  suggestedLoad: z.number().min(0).max(1000).nullable().optional(),
  restSec: z.number().int().min(0).max(900).default(90),
  technique: z
    .enum(['normal', 'superset', 'biset', 'dropset', 'rest_pause', 'aquecimento'])
    .default('normal'),
  groupKey: z.string().max(40).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  order: z.number().int().min(0).optional(),
});

// ---------------------------------------------------------------- Templates

/** GET /api/rotinas/templates — modelos prontos (ABC, PPL, Upper/Lower...). */
routinesRouter.get('/templates', (_req, res) => {
  res.json(
    TEMPLATES.map((t) => ({
      slug: t.slug,
      nome: t.nome,
      descricao: t.descricao,
      objetivo: t.objetivo,
      nivel: t.nivel,
      diasPorSemana: t.diasPorSemana,
      dias: t.dias.map((d) => ({ nome: d.nome, exercicios: d.exercicios.map((e) => e.exercicio) })),
    })),
  );
});

/** POST /api/rotinas/templates/:slug/aplicar — cria uma rotina a partir do modelo. */
routinesRouter.post('/templates/:slug/aplicar', requireAuth, async (req, res, next) => {
  try {
    const uid = userId(req);
    const template = getTemplate(req.params.slug);
    if (!template) throw notFound('Template não encontrado');

    const nomes = [...new Set(template.dias.flatMap((d) => d.exercicios.map((e) => e.exercicio)))];
    const exercicios = await prisma.exercise.findMany({
      where: { name: { in: nomes }, OR: [{ createdById: null }, { createdById: uid }] },
    });
    const porNome = new Map(exercicios.map((e) => [e.name, e.id]));

    const rotina = await prisma.routine.create({
      data: {
        userId: uid,
        name: template.nome,
        description: template.descricao,
        goal: template.objetivo,
        days: {
          create: template.dias.map((dia, iDia) => ({
            name: dia.nome,
            order: iDia,
            exercises: {
              create: dia.exercicios
                .filter((ex) => porNome.has(ex.exercicio))
                .map((ex, iEx) => ({
                  exerciseId: porNome.get(ex.exercicio)!,
                  order: iEx,
                  sets: ex.sets,
                  repsMin: ex.repsMin,
                  repsMax: ex.repsMax,
                  restSec: ex.restSec,
                  technique: ex.technique ?? 'normal',
                  groupKey: ex.groupKey ?? null,
                  notes: ex.notes ?? null,
                })),
            },
          })),
        },
      },
      include: incluiEstrutura,
    });

    res.status(201).json(serializeRoutine(rotina));
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------- Rotinas compartilhadas

/** GET /api/rotinas/compartilhadas/:slug — leitura pública de rotina compartilhada. */
routinesRouter.get('/compartilhadas/:slug', optionalAuth, async (req, res, next) => {
  try {
    const rotina = await prisma.routine.findUnique({
      where: { shareSlug: req.params.slug },
      include: { ...incluiEstrutura, user: { select: { name: true } } },
    });
    if (!rotina) throw notFound('Rotina compartilhada não encontrada ou link revogado');

    const { userId: _uid, ...publica } = rotina;
    res.json({ ...serializeRoutine(publica as never), autor: rotina.user.name });
  } catch (err) {
    next(err);
  }
});

/** POST /api/rotinas/compartilhadas/:slug/copiar — copia a rotina para a própria conta. */
routinesRouter.post('/compartilhadas/:slug/copiar', requireAuth, async (req, res, next) => {
  try {
    const uid = userId(req);
    const origem = await prisma.routine.findUnique({
      where: { shareSlug: req.params.slug },
      include: incluiEstrutura,
    });
    if (!origem) throw notFound('Rotina compartilhada não encontrada');

    const copia = await prisma.routine.create({
      data: {
        userId: uid,
        name: `${origem.name} (cópia)`,
        description: origem.description,
        goal: origem.goal,
        days: {
          create: origem.days.map((d) => ({
            name: d.name,
            order: d.order,
            notes: d.notes,
            exercises: {
              create: d.exercises.map((e) => ({
                exerciseId: e.exerciseId,
                order: e.order,
                sets: e.sets,
                repsMin: e.repsMin,
                repsMax: e.repsMax,
                suggestedLoad: e.suggestedLoad,
                restSec: e.restSec,
                technique: e.technique,
                groupKey: e.groupKey,
                notes: e.notes,
              })),
            },
          })),
        },
      },
      include: incluiEstrutura,
    });

    res.status(201).json(serializeRoutine(copia));
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------------ Rotinas

routinesRouter.use(requireAuth);

/** GET /api/rotinas — lista as rotinas do usuário. */
routinesRouter.get(
  '/',
  validate(z.object({ arquivadas: booleanoDaQuery.optional() }), 'query'),
  async (req, res, next) => {
    try {
      const { arquivadas } = getQuery<{ arquivadas?: boolean }>(req);
      const rotinas = await prisma.routine.findMany({
        where: { userId: userId(req), archived: arquivadas ?? false },
        include: incluiEstrutura,
        orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
      });
      res.json(rotinas.map((r) => serializeRoutine(r)));
    } catch (err) {
      next(err);
    }
  },
);

/** GET /api/rotinas/ativa — rotina marcada como ativa (aparece na Home). */
routinesRouter.get('/ativa', async (req, res, next) => {
  try {
    const rotina = await prisma.routine.findFirst({
      where: { userId: userId(req), isActive: true, archived: false },
      include: incluiEstrutura,
    });
    res.json(rotina ? serializeRoutine(rotina) : null);
  } catch (err) {
    next(err);
  }
});

/** POST /api/rotinas — cria rotina (opcionalmente já com dias). */
routinesRouter.post(
  '/',
  validate(
    rotinaSchema.extend({
      days: z.array(diaSchema.extend({ exercises: z.array(exercicioRotinaSchema).default([]) })).default([]),
    }),
  ),
  async (req, res, next) => {
    try {
      const uid = userId(req);
      const body = req.body as z.infer<typeof rotinaSchema> & {
        days: Array<z.infer<typeof diaSchema> & { exercises: z.infer<typeof exercicioRotinaSchema>[] }>;
      };

      if (body.isActive) {
        await prisma.routine.updateMany({ where: { userId: uid }, data: { isActive: false } });
      }

      const rotina = await prisma.routine.create({
        data: {
          userId: uid,
          name: body.name,
          description: body.description ?? null,
          goal: body.goal ?? null,
          isActive: body.isActive ?? false,
          days: {
            create: body.days.map((d, i) => ({
              name: d.name,
              order: d.order ?? i,
              notes: d.notes ?? null,
              exercises: {
                create: d.exercises.map((e, j) => ({
                  exerciseId: e.exerciseId,
                  order: e.order ?? j,
                  sets: e.sets,
                  repsMin: e.repsMin,
                  repsMax: e.repsMax,
                  suggestedLoad: e.suggestedLoad ?? null,
                  restSec: e.restSec,
                  technique: e.technique,
                  groupKey: e.groupKey ?? null,
                  notes: e.notes ?? null,
                })),
              },
            })),
          },
        },
        include: incluiEstrutura,
      });

      res.status(201).json(serializeRoutine(rotina));
    } catch (err) {
      next(err);
    }
  },
);

/** GET /api/rotinas/:id */
routinesRouter.get('/:id', async (req, res, next) => {
  try {
    res.json(serializeRoutine(await rotinaDoUsuario(userId(req), req.params.id)));
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/rotinas/:id */
routinesRouter.patch(
  '/:id',
  validate(rotinaSchema.partial().extend({ archived: z.boolean().optional() })),
  async (req, res, next) => {
    try {
      const uid = userId(req);
      await rotinaDoUsuario(uid, req.params.id);
      const body = req.body as Partial<z.infer<typeof rotinaSchema>> & { archived?: boolean };

      if (body.isActive) {
        await prisma.routine.updateMany({ where: { userId: uid }, data: { isActive: false } });
      }
      const rotina = await prisma.routine.update({
        where: { id: req.params.id },
        data: body,
        include: incluiEstrutura,
      });
      res.json(serializeRoutine(rotina));
    } catch (err) {
      next(err);
    }
  },
);

/** DELETE /api/rotinas/:id */
routinesRouter.delete('/:id', async (req, res, next) => {
  try {
    await rotinaDoUsuario(userId(req), req.params.id);
    await prisma.routine.delete({ where: { id: req.params.id } });
    res.json({ mensagem: 'Rotina excluída' });
  } catch (err) {
    next(err);
  }
});

/** POST /api/rotinas/:id/ativar — define como rotina ativa (só uma por vez). */
routinesRouter.post('/:id/ativar', async (req, res, next) => {
  try {
    const uid = userId(req);
    await rotinaDoUsuario(uid, req.params.id);
    await prisma.routine.updateMany({ where: { userId: uid }, data: { isActive: false } });
    const rotina = await prisma.routine.update({
      where: { id: req.params.id },
      data: { isActive: true, archived: false },
      include: incluiEstrutura,
    });
    res.json(serializeRoutine(rotina));
  } catch (err) {
    next(err);
  }
});

/** POST /api/rotinas/:id/arquivar — arquiva/desarquiva a rotina. */
routinesRouter.post('/:id/arquivar', async (req, res, next) => {
  try {
    const atual = await rotinaDoUsuario(userId(req), req.params.id);
    const rotina = await prisma.routine.update({
      where: { id: atual.id },
      data: { archived: !atual.archived, isActive: false },
      include: incluiEstrutura,
    });
    res.json(serializeRoutine(rotina));
  } catch (err) {
    next(err);
  }
});

/** POST /api/rotinas/:id/duplicar — duplica a rotina inteira. */
routinesRouter.post('/:id/duplicar', async (req, res, next) => {
  try {
    const uid = userId(req);
    const origem = await rotinaDoUsuario(uid, req.params.id);
    const copia = await prisma.routine.create({
      data: {
        userId: uid,
        name: `${origem.name} (cópia)`,
        description: origem.description,
        goal: origem.goal,
        days: {
          create: origem.days.map((d) => ({
            name: d.name,
            order: d.order,
            notes: d.notes,
            exercises: {
              create: d.exercises.map((e) => ({
                exerciseId: e.exerciseId,
                order: e.order,
                sets: e.sets,
                repsMin: e.repsMin,
                repsMax: e.repsMax,
                suggestedLoad: e.suggestedLoad,
                restSec: e.restSec,
                technique: e.technique,
                groupKey: e.groupKey,
                notes: e.notes,
              })),
            },
          })),
        },
      },
      include: incluiEstrutura,
    });
    res.status(201).json(serializeRoutine(copia));
  } catch (err) {
    next(err);
  }
});

/** POST /api/rotinas/:id/compartilhar — gera (ou devolve) o link público. */
routinesRouter.post('/:id/compartilhar', async (req, res, next) => {
  try {
    const rotina = await rotinaDoUsuario(userId(req), req.params.id);
    const slug = rotina.shareSlug ?? nanoid(12);
    if (!rotina.shareSlug) {
      await prisma.routine.update({ where: { id: rotina.id }, data: { shareSlug: slug } });
    }
    res.json({ shareSlug: slug, caminho: `/r/${slug}` });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/rotinas/:id/compartilhar — revoga o link público. */
routinesRouter.delete('/:id/compartilhar', async (req, res, next) => {
  try {
    const rotina = await rotinaDoUsuario(userId(req), req.params.id);
    await prisma.routine.update({ where: { id: rotina.id }, data: { shareSlug: null } });
    res.json({ mensagem: 'Link revogado' });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------------- Dias de treino

/** POST /api/rotinas/:id/dias — adiciona um dia (Treino A, B, C...). */
routinesRouter.post('/:id/dias', validate(diaSchema), async (req, res, next) => {
  try {
    const rotina = await rotinaDoUsuario(userId(req), req.params.id);
    const body = req.body as z.infer<typeof diaSchema>;
    const dia = await prisma.routineDay.create({
      data: {
        routineId: rotina.id,
        name: body.name,
        notes: body.notes ?? null,
        order: body.order ?? rotina.days.length,
      },
      include: { exercises: { include: { exercise: true }, orderBy: { order: 'asc' } } },
    });
    res.status(201).json({
      ...dia,
      exercises: dia.exercises.map((e) => ({ ...e, exercise: serializeExercise(e.exercise) })),
    });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/rotinas/dias/:diaId */
routinesRouter.patch('/dias/:diaId', validate(diaSchema.partial()), async (req, res, next) => {
  try {
    const dia = await diaDoUsuario(userId(req), req.params.diaId);
    const atualizado = await prisma.routineDay.update({
      where: { id: dia.id },
      data: req.body as Partial<z.infer<typeof diaSchema>>,
      include: { exercises: { include: { exercise: true }, orderBy: { order: 'asc' } } },
    });
    res.json({
      ...atualizado,
      exercises: atualizado.exercises.map((e) => ({ ...e, exercise: serializeExercise(e.exercise) })),
    });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/rotinas/dias/:diaId */
routinesRouter.delete('/dias/:diaId', async (req, res, next) => {
  try {
    const dia = await diaDoUsuario(userId(req), req.params.diaId);
    await prisma.routineDay.delete({ where: { id: dia.id } });
    res.json({ mensagem: 'Dia excluído' });
  } catch (err) {
    next(err);
  }
});

/** POST /api/rotinas/dias/:diaId/duplicar */
routinesRouter.post('/dias/:diaId/duplicar', async (req, res, next) => {
  try {
    const uid = userId(req);
    await diaDoUsuario(uid, req.params.diaId);
    const origem = await prisma.routineDay.findUniqueOrThrow({
      where: { id: req.params.diaId },
      include: { exercises: true },
    });
    const total = await prisma.routineDay.count({ where: { routineId: origem.routineId } });

    const copia = await prisma.routineDay.create({
      data: {
        routineId: origem.routineId,
        name: `${origem.name} (cópia)`,
        notes: origem.notes,
        order: total,
        exercises: {
          create: origem.exercises.map((e) => ({
            exerciseId: e.exerciseId,
            order: e.order,
            sets: e.sets,
            repsMin: e.repsMin,
            repsMax: e.repsMax,
            suggestedLoad: e.suggestedLoad,
            restSec: e.restSec,
            technique: e.technique,
            groupKey: e.groupKey,
            notes: e.notes,
          })),
        },
      },
      include: { exercises: { include: { exercise: true }, orderBy: { order: 'asc' } } },
    });

    res.status(201).json({
      ...copia,
      exercises: copia.exercises.map((e) => ({ ...e, exercise: serializeExercise(e.exercise) })),
    });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/rotinas/:id/dias/reordenar — nova ordem dos dias. */
routinesRouter.patch(
  '/:id/dias/reordenar',
  validate(z.object({ ordem: z.array(z.string()).min(1) })),
  async (req, res, next) => {
    try {
      const rotina = await rotinaDoUsuario(userId(req), req.params.id);
      const { ordem } = req.body as { ordem: string[] };
      const idsValidos = new Set(rotina.days.map((d) => d.id));
      if (ordem.some((id) => !idsValidos.has(id))) throw badRequest('Lista de dias inválida');

      await prisma.$transaction(
        ordem.map((id, i) => prisma.routineDay.update({ where: { id }, data: { order: i } })),
      );
      res.json(serializeRoutine(await rotinaDoUsuario(userId(req), rotina.id)));
    } catch (err) {
      next(err);
    }
  },
);

// ------------------------------------------------- Exercícios dentro do dia

/** POST /api/rotinas/dias/:diaId/exercicios — adiciona exercício ao dia. */
routinesRouter.post('/dias/:diaId/exercicios', validate(exercicioRotinaSchema), async (req, res, next) => {
  try {
    const uid = userId(req);
    const dia = await diaDoUsuario(uid, req.params.diaId);
    const body = req.body as z.infer<typeof exercicioRotinaSchema>;

    const exercicio = await prisma.exercise.findFirst({
      where: { id: body.exerciseId, OR: [{ createdById: null }, { createdById: uid }] },
    });
    if (!exercicio) throw notFound('Exercício não encontrado');
    if (body.repsMin > body.repsMax) throw badRequest('A repetição mínima não pode ser maior que a máxima');

    const total = await prisma.routineExercise.count({ where: { routineDayId: dia.id } });
    const criado = await prisma.routineExercise.create({
      data: {
        routineDayId: dia.id,
        exerciseId: body.exerciseId,
        order: body.order ?? total,
        sets: body.sets,
        repsMin: body.repsMin,
        repsMax: body.repsMax,
        suggestedLoad: body.suggestedLoad ?? null,
        restSec: body.restSec,
        technique: body.technique,
        groupKey: body.groupKey ?? null,
        notes: body.notes ?? null,
      },
      include: { exercise: true },
    });

    res.status(201).json({ ...criado, exercise: serializeExercise(criado.exercise) });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/rotinas/exercicios/:itemId — edita séries, reps, descanso, técnica... */
routinesRouter.patch(
  '/exercicios/:itemId',
  validate(exercicioRotinaSchema.partial().omit({ exerciseId: true })),
  async (req, res, next) => {
    try {
      const item = await prisma.routineExercise.findFirst({
        where: { id: req.params.itemId, day: { routine: { userId: userId(req) } } },
      });
      if (!item) throw notFound('Exercício da rotina não encontrado');

      const atualizado = await prisma.routineExercise.update({
        where: { id: item.id },
        data: req.body as Partial<z.infer<typeof exercicioRotinaSchema>>,
        include: { exercise: true },
      });
      res.json({ ...atualizado, exercise: serializeExercise(atualizado.exercise) });
    } catch (err) {
      next(err);
    }
  },
);

/** DELETE /api/rotinas/exercicios/:itemId */
routinesRouter.delete('/exercicios/:itemId', async (req, res, next) => {
  try {
    const item = await prisma.routineExercise.findFirst({
      where: { id: req.params.itemId, day: { routine: { userId: userId(req) } } },
    });
    if (!item) throw notFound('Exercício da rotina não encontrado');
    await prisma.routineExercise.delete({ where: { id: item.id } });
    res.json({ mensagem: 'Exercício removido da rotina' });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/rotinas/dias/:diaId/exercicios/reordenar — arrastar e soltar. */
routinesRouter.patch(
  '/dias/:diaId/exercicios/reordenar',
  validate(z.object({ ordem: z.array(z.string()).min(1) })),
  async (req, res, next) => {
    try {
      const dia = await diaDoUsuario(userId(req), req.params.diaId);
      const { ordem } = req.body as { ordem: string[] };
      const itens = await prisma.routineExercise.findMany({ where: { routineDayId: dia.id } });
      const idsValidos = new Set(itens.map((i) => i.id));
      if (ordem.some((id) => !idsValidos.has(id))) throw badRequest('Lista de exercícios inválida');

      await prisma.$transaction(
        ordem.map((id, i) => prisma.routineExercise.update({ where: { id }, data: { order: i } })),
      );

      const atualizados = await prisma.routineExercise.findMany({
        where: { routineDayId: dia.id },
        orderBy: { order: 'asc' },
        include: { exercise: true },
      });
      res.json(atualizados.map((e) => ({ ...e, exercise: serializeExercise(e.exercise) })));
    } catch (err) {
      next(err);
    }
  },
);
