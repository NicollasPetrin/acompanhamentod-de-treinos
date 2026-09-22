import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, userId } from '../middleware/auth';
import { getQuery, validate } from '../middleware/validate';
import { serializeExercise, serializeSet } from '../lib/serialize';
import { badRequest, conflict, notFound } from '../lib/errors';
import { recalcularRecordes, verificarRecordeProvisorio } from '../services/records';
import { verificarConquistas } from '../services/achievements';
import { arredondar, resumirSeries, volumeTotal } from '../utils/calculations';
import { chaveDoDia, fusoDoUsuario, inicioDoDiaLocal } from '../lib/datas';

export const workoutsRouter = Router();
workoutsRouter.use(requireAuth);

const incluiTreino = {
  exercises: {
    orderBy: { order: 'asc' as const },
    include: {
      exercise: true,
      sets: { orderBy: { order: 'asc' as const } },
    },
  },
};

type TreinoCompleto = Awaited<ReturnType<typeof buscarTreino>>;

const serializeWorkout = (w: {
  exercises: Array<{ exercise: Record<string, unknown>; sets: Array<Record<string, unknown>> }>;
} & Record<string, unknown>) => ({
  ...w,
  exercises: w.exercises.map((we) => ({
    ...we,
    exercise: serializeExercise(we.exercise),
    sets: we.sets.map(serializeSet),
  })),
});

async function buscarTreino(uid: string, id: string) {
  const treino = await prisma.workout.findFirst({
    where: { id, userId: uid },
    include: incluiTreino,
  });
  if (!treino) throw notFound('Treino não encontrado');
  return treino;
}

/** Últimos valores usados pelo usuário em um exercício (para pré-preencher as séries). */
async function ultimasSeries(uid: string, exerciseId: string) {
  const ultima = await prisma.workoutExercise.findFirst({
    where: { exerciseId, workout: { userId: uid, status: 'concluido' } },
    include: { sets: { orderBy: { order: 'asc' } } },
    orderBy: { workout: { startedAt: 'desc' } },
  });
  return ultima?.sets.filter((s) => s.completed) ?? [];
}

const iniciarSchema = z.object({
  routineDayId: z.string().nullable().optional(),
  name: z.string().trim().max(80).optional(),
  clientId: z.string().max(60).optional(),
});

/**
 * POST /api/treinos/iniciar
 * Cria o treino em andamento. A partir de um dia da rotina, já traz os
 * exercícios com as séries pré-preenchidas com os valores da última vez.
 */
workoutsRouter.post('/iniciar', validate(iniciarSchema), async (req, res, next) => {
  try {
    const uid = userId(req);
    const { routineDayId, name, clientId } = req.body as z.infer<typeof iniciarSchema>;

    const emAndamento = await prisma.workout.findFirst({
      where: { userId: uid, status: 'em_andamento' },
    });
    if (emAndamento) throw conflict('Você já tem um treino em andamento. Retome ou descarte antes de iniciar outro.');

    let nome = name ?? 'Treino livre';
    let exerciciosDoDia: Array<{
      exerciseId: string;
      order: number;
      sets: number;
      repsMin: number;
      repsMax: number;
      suggestedLoad: number | null;
      restSec: number;
      technique: string;
      groupKey: string | null;
      notes: string | null;
    }> = [];

    if (routineDayId) {
      const dia = await prisma.routineDay.findFirst({
        where: { id: routineDayId, routine: { userId: uid } },
        include: { exercises: { orderBy: { order: 'asc' } }, routine: { select: { name: true } } },
      });
      if (!dia) throw notFound('Dia de treino não encontrado');
      nome = name ?? dia.name;
      exerciciosDoDia = dia.exercises;
    }

    const treino = await prisma.workout.create({
      data: {
        userId: uid,
        routineDayId: routineDayId ?? null,
        name: nome,
        clientId: clientId ?? null,
        status: 'em_andamento',
        startedAt: new Date(),
      },
    });

    // Monta exercícios e séries sugeridas com base no histórico
    for (const item of exerciciosDoDia) {
      const anteriores = await ultimasSeries(uid, item.exerciseId);
      const we = await prisma.workoutExercise.create({
        data: {
          workoutId: treino.id,
          exerciseId: item.exerciseId,
          order: item.order,
          notes: item.notes,
          restSec: item.restSec,
          technique: item.technique,
          groupKey: item.groupKey,
        },
      });

      const quantidade = Math.max(item.sets, 1);
      const series = Array.from({ length: quantidade }, (_, i) => {
        const anterior = anteriores[i] ?? anteriores[anteriores.length - 1];
        return {
          workoutExerciseId: we.id,
          order: i,
          weight: anterior?.weight ?? item.suggestedLoad ?? 0,
          reps: anterior?.reps ?? item.repsMin,
          type: item.technique === 'aquecimento' && i === 0 ? 'aquecimento' : 'normal',
          completed: false,
        };
      });
      await prisma.workoutSet.createMany({ data: series });
    }

    res.status(201).json(serializeWorkout(await buscarTreino(uid, treino.id)));
  } catch (err) {
    next(err);
  }
});

/** GET /api/treinos/em-andamento — rascunho do treino atual (ou null). */
workoutsRouter.get('/em-andamento', async (req, res, next) => {
  try {
    const treino = await prisma.workout.findFirst({
      where: { userId: userId(req), status: 'em_andamento' },
      include: incluiTreino,
      orderBy: { startedAt: 'desc' },
    });
    res.json(treino ? serializeWorkout(treino) : null);
  } catch (err) {
    next(err);
  }
});

const listaSchema = z.object({
  de: z.coerce.date().optional(),
  ate: z.coerce.date().optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
});

/** GET /api/treinos — histórico paginado. */
workoutsRouter.get('/', validate(listaSchema, 'query'), async (req, res, next) => {
  try {
    const uid = userId(req);
    const q = getQuery<z.infer<typeof listaSchema>>(req);
    const where = {
      userId: uid,
      status: 'concluido',
      ...(q.de || q.ate ? { startedAt: { ...(q.de ? { gte: q.de } : {}), ...(q.ate ? { lte: q.ate } : {}) } } : {}),
    };

    const [total, treinos] = await Promise.all([
      prisma.workout.count({ where }),
      prisma.workout.findMany({
        where,
        include: incluiTreino,
        orderBy: { startedAt: 'desc' },
        skip: (q.pagina - 1) * q.limite,
        take: q.limite,
      }),
    ]);

    res.json({
      total,
      pagina: q.pagina,
      limite: q.limite,
      itens: treinos.map((t) => serializeWorkout(t)),
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/treinos/calendario?mes=2026-09 — dias treinados no mês. */
workoutsRouter.get(
  '/calendario',
  validate(z.object({ mes: z.string().regex(/^\d{4}-\d{2}$/) }), 'query'),
  async (req, res, next) => {
    try {
      const { mes } = getQuery<{ mes: string }>(req);
      const [ano, m] = mes.split('-').map(Number);
      // Os limites do mês são no fuso de quem treina: um treino das 22h do
      // dia 31 pertence a este mês, não ao seguinte.
      const fuso = await fusoDoUsuario(userId(req));
      const inicio = inicioDoDiaLocal(ano, m, 1, fuso);
      const fim = new Date(inicioDoDiaLocal(m === 12 ? ano + 1 : ano, m === 12 ? 1 : m + 1, 1, fuso).getTime() - 1);

      const treinos = await prisma.workout.findMany({
        where: { userId: userId(req), status: 'concluido', startedAt: { gte: inicio, lte: fim } },
        select: { id: true, name: true, startedAt: true, durationSec: true, totalVolume: true },
        orderBy: { startedAt: 'asc' },
      });

      const dias: Record<string, Array<(typeof treinos)[number]>> = {};
      for (const t of treinos) {
        const chave = chaveDoDia(t.startedAt, fuso);
        (dias[chave] ??= []).push(t);
      }

      res.json({ mes, dias });
    } catch (err) {
      next(err);
    }
  },
);

/** GET /api/treinos/:id */
workoutsRouter.get('/:id', async (req, res, next) => {
  try {
    res.json(serializeWorkout(await buscarTreino(userId(req), req.params.id)));
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/treinos/:id — edita nome, anotações, RPE e data do treino. */
workoutsRouter.patch(
  '/:id',
  validate(
    z.object({
      name: z.string().trim().min(1).max(80).optional(),
      notes: z.string().max(2000).nullable().optional(),
      rpe: z.number().int().min(1).max(10).nullable().optional(),
      startedAt: z.coerce.date().optional(),
      finishedAt: z.coerce.date().nullable().optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const uid = userId(req);
      const treino = await buscarTreino(uid, req.params.id);
      const body = req.body as Record<string, unknown>;

      const atualizado = await prisma.workout.update({
        where: { id: treino.id },
        data: {
          ...body,
          ...(body.startedAt && treino.finishedAt
            ? {
                durationSec: Math.max(
                  0,
                  Math.round((treino.finishedAt.getTime() - (body.startedAt as Date).getTime()) / 1000),
                ),
              }
            : {}),
        },
        include: incluiTreino,
      });
      res.json(serializeWorkout(atualizado));
    } catch (err) {
      next(err);
    }
  },
);

/** DELETE /api/treinos/:id — exclui o treino e recalcula os recordes afetados. */
workoutsRouter.delete('/:id', async (req, res, next) => {
  try {
    const uid = userId(req);
    const treino = await buscarTreino(uid, req.params.id);
    const exerciciosAfetados = treino.exercises.map((e) => e.exerciseId);

    await prisma.workout.delete({ where: { id: treino.id } });
    for (const exerciseId of new Set(exerciciosAfetados)) {
      await recalcularRecordes(uid, exerciseId);
    }

    res.json({ mensagem: 'Treino excluído' });
  } catch (err) {
    next(err);
  }
});

/** POST /api/treinos/:id/exercicios — adiciona exercício durante o treino. */
workoutsRouter.post(
  '/:id/exercicios',
  validate(
    z.object({
      exerciseId: z.string().min(1),
      sets: z.number().int().min(0).max(20).default(3),
      restSec: z.number().int().min(0).max(900).optional(),
      notes: z.string().max(500).nullable().optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const uid = userId(req);
      const treino = await buscarTreino(uid, req.params.id);
      const body = req.body as { exerciseId: string; sets: number; restSec?: number; notes?: string | null };

      const exercicio = await prisma.exercise.findFirst({
        where: { id: body.exerciseId, OR: [{ createdById: null }, { createdById: uid }] },
      });
      if (!exercicio) throw notFound('Exercício não encontrado');

      const anteriores = await ultimasSeries(uid, body.exerciseId);
      const we = await prisma.workoutExercise.create({
        data: {
          workoutId: treino.id,
          exerciseId: body.exerciseId,
          order: treino.exercises.length,
          restSec: body.restSec ?? null,
          notes: body.notes ?? null,
          sets: {
            create: Array.from({ length: body.sets }, (_, i) => ({
              order: i,
              weight: anteriores[i]?.weight ?? anteriores[anteriores.length - 1]?.weight ?? 0,
              reps: anteriores[i]?.reps ?? anteriores[anteriores.length - 1]?.reps ?? 10,
            })),
          },
        },
        include: { exercise: true, sets: { orderBy: { order: 'asc' } } },
      });

      res.status(201).json({
        ...we,
        exercise: serializeExercise(we.exercise),
        sets: we.sets.map(serializeSet),
      });
    } catch (err) {
      next(err);
    }
  },
);

/** PATCH /api/treinos/exercicios/:itemId — anotação por exercício. */
workoutsRouter.patch(
  '/exercicios/:itemId',
  validate(
    z.object({
      notes: z.string().max(1000).nullable().optional(),
      restSec: z.number().int().min(0).max(900).nullable().optional(),
      order: z.number().int().min(0).optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const item = await prisma.workoutExercise.findFirst({
        where: { id: req.params.itemId, workout: { userId: userId(req) } },
      });
      if (!item) throw notFound('Exercício do treino não encontrado');

      const atualizado = await prisma.workoutExercise.update({
        where: { id: item.id },
        data: req.body as Record<string, unknown>,
        include: { exercise: true, sets: { orderBy: { order: 'asc' } } },
      });
      res.json({
        ...atualizado,
        exercise: serializeExercise(atualizado.exercise),
        sets: atualizado.sets.map(serializeSet),
      });
    } catch (err) {
      next(err);
    }
  },
);

/** DELETE /api/treinos/exercicios/:itemId — remove exercício do treino. */
workoutsRouter.delete('/exercicios/:itemId', async (req, res, next) => {
  try {
    const item = await prisma.workoutExercise.findFirst({
      where: { id: req.params.itemId, workout: { userId: userId(req) } },
    });
    if (!item) throw notFound('Exercício do treino não encontrado');
    await prisma.workoutExercise.delete({ where: { id: item.id } });
    res.json({ mensagem: 'Exercício removido do treino' });
  } catch (err) {
    next(err);
  }
});

/** POST /api/treinos/exercicios/:itemId/series — adiciona série. */
workoutsRouter.post(
  '/exercicios/:itemId/series',
  validate(
    z.object({
      weight: z.number().min(0).max(2000).optional(),
      reps: z.number().int().min(0).max(500).optional(),
      type: z.enum(['normal', 'aquecimento', 'drop', 'rest_pause', 'falha']).default('normal'),
    }),
  ),
  async (req, res, next) => {
    try {
      const item = await prisma.workoutExercise.findFirst({
        where: { id: req.params.itemId, workout: { userId: userId(req) } },
        include: { sets: { orderBy: { order: 'desc' }, take: 1 } },
      });
      if (!item) throw notFound('Exercício do treino não encontrado');

      const body = req.body as { weight?: number; reps?: number; type: string };
      const ultima = item.sets[0];
      const serie = await prisma.workoutSet.create({
        data: {
          workoutExerciseId: item.id,
          order: (ultima?.order ?? -1) + 1,
          weight: body.weight ?? ultima?.weight ?? 0,
          reps: body.reps ?? ultima?.reps ?? 0,
          type: body.type,
        },
      });
      res.status(201).json(serializeSet(serie));
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /api/treinos/series/:setId — edita peso/reps/RPE e marca como concluída.
 * Ao concluir, devolve os recordes pessoais batidos pela série.
 */
workoutsRouter.patch(
  '/series/:setId',
  validate(
    z.object({
      weight: z.number().min(0).max(2000).optional(),
      reps: z.number().int().min(0).max(500).optional(),
      rpe: z.number().int().min(1).max(10).nullable().optional(),
      type: z.enum(['normal', 'aquecimento', 'drop', 'rest_pause', 'falha']).optional(),
      completed: z.boolean().optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const uid = userId(req);
      const serie = await prisma.workoutSet.findFirst({
        where: { id: req.params.setId, workoutExercise: { workout: { userId: uid } } },
        include: { workoutExercise: { select: { exerciseId: true, workoutId: true } } },
      });
      if (!serie) throw notFound('Série não encontrada');

      const body = req.body as Record<string, unknown>;
      const atualizada = await prisma.workoutSet.update({
        where: { id: serie.id },
        data: {
          ...body,
          ...(body.completed === true ? { completedAt: new Date() } : {}),
          ...(body.completed === false ? { completedAt: null, isPr: false, prTypes: '[]' } : {}),
        },
      });

      let recordes: Array<{ type: string; value: number }> = [];
      if (atualizada.completed) {
        recordes = await verificarRecordeProvisorio({
          userId: uid,
          exerciseId: serie.workoutExercise.exerciseId,
          workoutId: serie.workoutExercise.workoutId,
          set: atualizada,
        });
      }

      const final = await prisma.workoutSet.findUniqueOrThrow({ where: { id: serie.id } });
      res.json({ serie: serializeSet(final), recordes });
    } catch (err) {
      next(err);
    }
  },
);

/** DELETE /api/treinos/series/:setId */
workoutsRouter.delete('/series/:setId', async (req, res, next) => {
  try {
    const serie = await prisma.workoutSet.findFirst({
      where: { id: req.params.setId, workoutExercise: { workout: { userId: userId(req) } } },
    });
    if (!serie) throw notFound('Série não encontrada');
    await prisma.workoutSet.delete({ where: { id: serie.id } });
    res.json({ mensagem: 'Série removida' });
  } catch (err) {
    next(err);
  }
});

/** Monta o resumo pós-treino (volume, séries, PRs, grupos musculares). */
async function montarResumo(uid: string, workoutId: string) {
  const treino = await buscarTreino(uid, workoutId);
  const todasSeries = treino.exercises.flatMap((e) => e.sets);
  const resumo = resumirSeries(todasSeries);

  const gruposMusculares: Record<string, number> = {};
  for (const we of treino.exercises) {
    const seriesValidas = we.sets.filter((s) => s.completed && s.type !== 'aquecimento').length;
    if (!seriesValidas) continue;
    gruposMusculares[we.exercise.muscleGroup] = (gruposMusculares[we.exercise.muscleGroup] ?? 0) + seriesValidas;
  }

  const recordes = await prisma.personalRecord.findMany({
    where: { userId: uid, workoutId },
    include: { exercise: { select: { id: true, name: true } } },
    orderBy: { value: 'desc' },
  });

  return {
    treino: serializeWorkout(treino),
    duracaoSeg: treino.durationSec ?? 0,
    volumeTotal: resumo.volume,
    seriesConcluidas: resumo.seriesConcluidas,
    repeticoesTotais: resumo.repeticoes,
    exerciciosRealizados: treino.exercises.filter((e) => e.sets.some((s) => s.completed)).length,
    gruposMusculares,
    recordes: recordes.map((r) => ({
      type: r.type,
      value: r.value,
      weight: r.weight,
      reps: r.reps,
      exercise: r.exercise,
    })),
  };
}

/**
 * POST /api/treinos/:id/finalizar
 * Fecha o treino, calcula métricas, consolida os recordes e verifica conquistas.
 */
workoutsRouter.post(
  '/:id/finalizar',
  validate(
    z.object({
      notes: z.string().max(2000).nullable().optional(),
      rpe: z.number().int().min(1).max(10).nullable().optional(),
      finishedAt: z.coerce.date().optional(),
      descartarSeriesNaoConcluidas: z.boolean().default(true),
    }),
  ),
  async (req, res, next) => {
    try {
      const uid = userId(req);
      const treino = await buscarTreino(uid, req.params.id);
      if (treino.status === 'concluido') throw badRequest('Este treino já foi finalizado');

      const body = req.body as {
        notes?: string | null;
        rpe?: number | null;
        finishedAt?: Date;
        descartarSeriesNaoConcluidas: boolean;
      };

      if (body.descartarSeriesNaoConcluidas) {
        await prisma.workoutSet.deleteMany({
          where: { completed: false, workoutExercise: { workoutId: treino.id } },
        });
        // Exercícios que ficaram sem nenhuma série também saem do registro
        const vazios = await prisma.workoutExercise.findMany({
          where: { workoutId: treino.id, sets: { none: {} } },
          select: { id: true },
        });
        if (vazios.length) {
          await prisma.workoutExercise.deleteMany({ where: { id: { in: vazios.map((v) => v.id) } } });
        }
      }

      const atualizado = await buscarTreino(uid, treino.id);
      const series = atualizado.exercises.flatMap((e) => e.sets);
      const resumo = resumirSeries(series);
      const finishedAt = body.finishedAt ?? new Date();

      await prisma.workout.update({
        where: { id: treino.id },
        data: {
          status: 'concluido',
          finishedAt,
          durationSec: Math.max(0, Math.round((finishedAt.getTime() - treino.startedAt.getTime()) / 1000)),
          notes: body.notes ?? treino.notes,
          rpe: body.rpe ?? treino.rpe,
          totalVolume: resumo.volume,
          totalSets: resumo.seriesConcluidas,
          totalReps: resumo.repeticoes,
        },
      });

      // Consolida os recordes de cada exercício envolvido (agora que o treino conta)
      for (const exerciseId of new Set(atualizado.exercises.map((e) => e.exerciseId))) {
        await recalcularRecordes(uid, exerciseId);
      }

      const conquistas = await verificarConquistas(uid);
      const resumoFinal = await montarResumo(uid, treino.id);

      res.json({ ...resumoFinal, conquistas });
    } catch (err) {
      next(err);
    }
  },
);

/** GET /api/treinos/:id/resumo — resumo pós-treino (também usado no histórico). */
workoutsRouter.get('/:id/resumo', async (req, res, next) => {
  try {
    res.json(await montarResumo(userId(req), req.params.id));
  } catch (err) {
    next(err);
  }
});

/** POST /api/treinos/:id/descartar — apaga o rascunho em andamento. */
workoutsRouter.post('/:id/descartar', async (req, res, next) => {
  try {
    const uid = userId(req);
    const treino = await buscarTreino(uid, req.params.id);
    if (treino.status === 'concluido') throw badRequest('Treinos concluídos devem ser excluídos, não descartados');
    await prisma.workout.delete({ where: { id: treino.id } });
    res.json({ mensagem: 'Treino descartado' });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------- Sincronização offline

const serieOfflineSchema = z.object({
  order: z.number().int().min(0).default(0),
  weight: z.number().min(0).max(2000).default(0),
  reps: z.number().int().min(0).max(500).default(0),
  rpe: z.number().int().min(1).max(10).nullable().optional(),
  type: z.enum(['normal', 'aquecimento', 'drop', 'rest_pause', 'falha']).default('normal'),
  completed: z.boolean().default(true),
});

const treinoOfflineSchema = z.object({
  clientId: z.string().min(1).max(60),
  routineDayId: z.string().nullable().optional(),
  name: z.string().max(80).default('Treino livre'),
  startedAt: z.coerce.date(),
  finishedAt: z.coerce.date(),
  notes: z.string().max(2000).nullable().optional(),
  rpe: z.number().int().min(1).max(10).nullable().optional(),
  exercises: z
    .array(
      z.object({
        exerciseId: z.string().min(1),
        order: z.number().int().min(0).default(0),
        notes: z.string().max(1000).nullable().optional(),
        sets: z.array(serieOfflineSchema).default([]),
      }),
    )
    .default([]),
});

/**
 * POST /api/treinos/sincronizar
 * Recebe os treinos registrados offline (PWA) e grava em lote.
 * A idempotência vem do par único (userId, clientId): reenviar o mesmo treino
 * não duplica nada.
 */
workoutsRouter.post(
  '/sincronizar',
  validate(z.object({ treinos: z.array(treinoOfflineSchema).max(50) })),
  async (req, res, next) => {
    try {
      const uid = userId(req);
      const { treinos } = req.body as { treinos: z.infer<typeof treinoOfflineSchema>[] };
      const resultados: Array<{ clientId: string; workoutId: string; status: string }> = [];

      for (const t of treinos) {
        const existente = await prisma.workout.findFirst({ where: { userId: uid, clientId: t.clientId } });
        if (existente?.status === 'concluido') {
          // Já sincronizado antes: nada a fazer (idempotência)
          resultados.push({ clientId: t.clientId, workoutId: existente.id, status: 'ja_sincronizado' });
          continue;
        }
        if (existente) {
          // O treino começou online (rascunho no servidor) e terminou offline:
          // o rascunho é substituído pela versão finalizada que veio do aparelho.
          await prisma.workout.delete({ where: { id: existente.id } });
        }

        // Só aceita exercícios visíveis para este usuário
        const ids = [...new Set(t.exercises.map((e) => e.exerciseId))];
        const validos = new Set(
          (
            await prisma.exercise.findMany({
              where: { id: { in: ids }, OR: [{ createdById: null }, { createdById: uid }] },
              select: { id: true },
            })
          ).map((e) => e.id),
        );

        const exercicios = t.exercises.filter((e) => validos.has(e.exerciseId));
        const series = exercicios.flatMap((e) => e.sets);
        const resumo = resumirSeries(series);

        const criado = await prisma.workout.create({
          data: {
            userId: uid,
            clientId: t.clientId,
            routineDayId: t.routineDayId ?? null,
            name: t.name,
            startedAt: t.startedAt,
            finishedAt: t.finishedAt,
            durationSec: Math.max(0, Math.round((t.finishedAt.getTime() - t.startedAt.getTime()) / 1000)),
            notes: t.notes ?? null,
            rpe: t.rpe ?? null,
            status: 'concluido',
            totalVolume: resumo.volume,
            totalSets: resumo.seriesConcluidas,
            totalReps: resumo.repeticoes,
            exercises: {
              create: exercicios.map((e) => ({
                exerciseId: e.exerciseId,
                order: e.order,
                notes: e.notes ?? null,
                sets: {
                  create: e.sets.map((s, i) => ({
                    order: s.order ?? i,
                    weight: s.weight,
                    reps: s.reps,
                    rpe: s.rpe ?? null,
                    type: s.type,
                    completed: s.completed,
                    completedAt: s.completed ? t.finishedAt : null,
                  })),
                },
              })),
            },
          },
        });

        for (const exerciseId of new Set(exercicios.map((e) => e.exerciseId))) {
          await recalcularRecordes(uid, exerciseId);
        }

        resultados.push({
          clientId: t.clientId,
          workoutId: criado.id,
          status: existente ? 'atualizado' : 'criado',
        });
      }

      const conquistas = await verificarConquistas(uid);
      res.json({ resultados, conquistas });
    } catch (err) {
      next(err);
    }
  },
);

/** GET /api/treinos/:id/volume — volume por exercício (usado em gráficos do detalhe). */
workoutsRouter.get('/:id/volume', async (req, res, next) => {
  try {
    const treino = await buscarTreino(userId(req), req.params.id);
    res.json(
      treino.exercises.map((we) => ({
        exerciseId: we.exerciseId,
        nome: we.exercise.name,
        volume: arredondar(volumeTotal(we.sets)),
        series: we.sets.filter((s) => s.completed).length,
      })),
    );
  } catch (err) {
    next(err);
  }
});

export type { TreinoCompleto };
