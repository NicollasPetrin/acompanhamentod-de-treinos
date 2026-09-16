import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { optionalAuth, requireAuth, userId } from '../middleware/auth';
import { getQuery, validate } from '../middleware/validate';
import { serializeExercise } from '../lib/serialize';
import { toJson } from '../lib/json';
import { forbidden, notFound } from '../lib/errors';
import { gerarSvgExercicio } from '../lib/exerciseImage';
import { EQUIPAMENTOS, GRUPOS_MUSCULARES, TIPOS_EXERCICIO } from '../data/exercises';
import { estimar1RM, arredondar, volumeTotal } from '../utils/calculations';
import { booleanoDaQuery } from '../lib/zod';

export const exercisesRouter = Router();

const listaSchema = z.object({
  busca: z.string().trim().optional(),
  grupo: z.string().optional(),
  equipamento: z.string().optional(),
  tipo: z.string().optional(),
  favoritos: booleanoDaQuery.optional(),
  meus: booleanoDaQuery.optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(200).default(50),
});

const exercicioSchema = z.object({
  name: z.string().trim().min(2).max(120),
  muscleGroup: z.string().min(2),
  secondaryMuscles: z.array(z.string()).default([]),
  equipment: z.string().min(2),
  type: z.enum(['forca', 'cardio', 'alongamento', 'mobilidade']).default('forca'),
  instructions: z.string().max(4000).default(''),
  imageUrl: z.string().nullable().optional(),
  videoUrl: z.string().nullable().optional(),
  isUnilateral: z.boolean().default(false),
});

/** GET /api/exercicios/filtros — opções para os seletores da biblioteca. */
exercisesRouter.get('/filtros', (_req, res) => {
  res.json({ gruposMusculares: GRUPOS_MUSCULARES, equipamentos: EQUIPAMENTOS, tipos: TIPOS_EXERCICIO });
});

/**
 * GET /api/exercicios — biblioteca com busca e filtros.
 * Retorna exercícios globais + os personalizados do próprio usuário.
 */
exercisesRouter.get('/', requireAuth, validate(listaSchema, 'query'), async (req, res, next) => {
  try {
    const uid = userId(req);
    const q = getQuery<z.infer<typeof listaSchema>>(req);

    const favoritos = await prisma.favoriteExercise.findMany({
      where: { userId: uid },
      select: { exerciseId: true },
    });
    const idsFavoritos = new Set(favoritos.map((f) => f.exerciseId));

    const where = {
      AND: [
        q.meus ? { createdById: uid } : { OR: [{ createdById: null }, { createdById: uid }] },
        q.busca ? { name: { contains: q.busca } } : {},
        q.grupo ? { muscleGroup: q.grupo } : {},
        q.equipamento ? { equipment: q.equipamento } : {},
        q.tipo ? { type: q.tipo } : {},
        q.favoritos ? { id: { in: [...idsFavoritos] } } : {},
      ],
    };

    const [total, exercicios] = await Promise.all([
      prisma.exercise.count({ where }),
      prisma.exercise.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (q.pagina - 1) * q.limite,
        take: q.limite,
      }),
    ]);

    res.json({
      total,
      pagina: q.pagina,
      limite: q.limite,
      itens: exercicios.map((e) => ({
        ...serializeExercise(e),
        favorito: idsFavoritos.has(e.id),
        personalizado: e.createdById !== null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/exercicios/:id/imagem.svg — ilustração gerada pelo servidor. */
exercisesRouter.get('/:id/imagem.svg', optionalAuth, async (req, res, next) => {
  try {
    const exercicio = await prisma.exercise.findUnique({ where: { id: req.params.id } });
    if (!exercicio) throw notFound('Exercício não encontrado');

    const svg = gerarSvgExercicio({
      nome: exercicio.name,
      grupoPrincipal: exercicio.muscleGroup,
      gruposSecundarios: JSON.parse(exercicio.secondaryMuscles || '[]'),
      equipamento: exercicio.equipment,
    });

    res.type('image/svg+xml').set('Cache-Control', 'public, max-age=86400').send(svg);
  } catch (err) {
    next(err);
  }
});

/** GET /api/exercicios/:id — detalhe do exercício. */
exercisesRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const uid = userId(req);
    const exercicio = await prisma.exercise.findUnique({ where: { id: req.params.id } });
    if (!exercicio || (exercicio.createdById && exercicio.createdById !== uid)) {
      throw notFound('Exercício não encontrado');
    }
    const favorito = await prisma.favoriteExercise.findUnique({
      where: { userId_exerciseId: { userId: uid, exerciseId: exercicio.id } },
    });
    res.json({
      ...serializeExercise(exercicio),
      favorito: Boolean(favorito),
      personalizado: exercicio.createdById !== null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/exercicios/:id/historico — histórico do usuário naquele exercício:
 * melhor carga, melhor série, 1RM estimado e série temporal para o gráfico.
 */
exercisesRouter.get('/:id/historico', requireAuth, async (req, res, next) => {
  try {
    const uid = userId(req);
    const exerciseId = req.params.id;

    const workoutExercises = await prisma.workoutExercise.findMany({
      where: { exerciseId, workout: { userId: uid, status: 'concluido' } },
      include: {
        sets: { orderBy: { order: 'asc' } },
        workout: { select: { id: true, name: true, startedAt: true } },
      },
      orderBy: { workout: { startedAt: 'desc' } },
      take: 60,
    });

    const sessoes = workoutExercises.map((we) => {
      const validas = we.sets.filter((s) => s.completed && s.type !== 'aquecimento');
      const melhorSerie = validas.reduce<(typeof validas)[number] | null>(
        (melhor, s) => (!melhor || s.weight > melhor.weight ? s : melhor),
        null,
      );
      return {
        workoutId: we.workout.id,
        workoutName: we.workout.name,
        date: we.workout.startedAt,
        notes: we.notes,
        sets: we.sets.map((s) => ({
          id: s.id,
          order: s.order,
          weight: s.weight,
          reps: s.reps,
          rpe: s.rpe,
          type: s.type,
          completed: s.completed,
          isPr: s.isPr,
        })),
        volume: volumeTotal(validas),
        cargaMaxima: melhorSerie?.weight ?? 0,
        melhorSerie: melhorSerie ? { weight: melhorSerie.weight, reps: melhorSerie.reps } : null,
        umRmEstimado: validas.reduce((max, s) => Math.max(max, estimar1RM(s.weight, s.reps)), 0),
      };
    });

    const recordes = await prisma.personalRecord.findMany({
      where: { userId: uid, exerciseId },
      orderBy: { value: 'desc' },
    });
    const melhorPorTipo: Record<string, { value: number; date: Date; weight: number | null; reps: number | null }> = {};
    for (const r of recordes) {
      if (!melhorPorTipo[r.type]) {
        melhorPorTipo[r.type] = { value: r.value, date: r.date, weight: r.weight, reps: r.reps };
      }
    }

    // Série temporal (mais antiga → mais recente) para o gráfico de evolução
    const evolucao = [...sessoes]
      .reverse()
      .map((s) => ({
        date: s.date,
        cargaMaxima: s.cargaMaxima,
        volume: s.volume,
        umRm: arredondar(s.umRmEstimado),
      }));

    res.json({
      totalSessoes: sessoes.length,
      recordes: melhorPorTipo,
      evolucao,
      sessoes,
    });
  } catch (err) {
    next(err);
  }
});

/** POST /api/exercicios — cria exercício personalizado (privado do usuário). */
exercisesRouter.post('/', requireAuth, validate(exercicioSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof exercicioSchema>;
    const exercicio = await prisma.exercise.create({
      data: {
        ...body,
        secondaryMuscles: toJson(body.secondaryMuscles),
        createdById: userId(req),
      },
    });
    res.status(201).json({ ...serializeExercise(exercicio), personalizado: true, favorito: false });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/exercicios/:id — edita exercício personalizado do próprio usuário. */
exercisesRouter.patch('/:id', requireAuth, validate(exercicioSchema.partial()), async (req, res, next) => {
  try {
    const uid = userId(req);
    const atual = await prisma.exercise.findUnique({ where: { id: req.params.id } });
    if (!atual) throw notFound('Exercício não encontrado');
    if (atual.createdById !== uid) throw forbidden('Você só pode editar exercícios que criou');

    const { secondaryMuscles, ...resto } = req.body as Partial<z.infer<typeof exercicioSchema>>;
    const exercicio = await prisma.exercise.update({
      where: { id: atual.id },
      data: {
        ...resto,
        ...(secondaryMuscles ? { secondaryMuscles: toJson(secondaryMuscles) } : {}),
      },
    });
    res.json({ ...serializeExercise(exercicio), personalizado: true });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/exercicios/:id — remove exercício personalizado. */
exercisesRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const uid = userId(req);
    const atual = await prisma.exercise.findUnique({ where: { id: req.params.id } });
    if (!atual) throw notFound('Exercício não encontrado');
    if (atual.createdById !== uid) throw forbidden('Você só pode excluir exercícios que criou');

    const emUso = await prisma.workoutExercise.count({ where: { exerciseId: atual.id } });
    const emRotina = await prisma.routineExercise.count({ where: { exerciseId: atual.id } });
    if (emUso > 0 || emRotina > 0) {
      throw forbidden('Este exercício está em uso em treinos ou rotinas e não pode ser excluído');
    }

    await prisma.exercise.delete({ where: { id: atual.id } });
    res.json({ mensagem: 'Exercício excluído' });
  } catch (err) {
    next(err);
  }
});

/** POST /api/exercicios/:id/favorito — marca como favorito. */
exercisesRouter.post('/:id/favorito', requireAuth, async (req, res, next) => {
  try {
    const uid = userId(req);
    const exercicio = await prisma.exercise.findUnique({ where: { id: req.params.id } });
    if (!exercicio) throw notFound('Exercício não encontrado');

    await prisma.favoriteExercise.upsert({
      where: { userId_exerciseId: { userId: uid, exerciseId: exercicio.id } },
      create: { userId: uid, exerciseId: exercicio.id },
      update: {},
    });
    res.json({ favorito: true });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/exercicios/:id/favorito — desmarca favorito. */
exercisesRouter.delete('/:id/favorito', requireAuth, async (req, res, next) => {
  try {
    await prisma.favoriteExercise.deleteMany({
      where: { userId: userId(req), exerciseId: req.params.id },
    });
    res.json({ favorito: false });
  } catch (err) {
    next(err);
  }
});
