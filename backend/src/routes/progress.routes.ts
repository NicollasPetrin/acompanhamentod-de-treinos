import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, userId } from '../middleware/auth';
import { getQuery, validate } from '../middleware/validate';
import { arredondar, calcularStreakDias } from '../utils/calculations';
import { CATALOGO_CONQUISTAS } from '../services/achievements';
import {
  chaveDoDia, chaveDoMes, fusoDoUsuario, inicioDaSemana, inicioDoMes, somarDias, somarMeses,
} from '../lib/datas';

export const progressRouter = Router();
progressRouter.use(requireAuth);

/**
 * GET /api/progresso/resumo
 * Dados da tela inicial: rotina ativa, próximo treino sugerido, streak e
 * resumo da semana.
 */
progressRouter.get('/resumo', async (req, res, next) => {
  try {
    const uid = userId(req);
    const fuso = await fusoDoUsuario(uid);
    const inicioSemana = inicioDaSemana(new Date(), fuso);

    const [treinos, rotinaAtiva, emAndamento, usuario] = await Promise.all([
      prisma.workout.findMany({
        where: { userId: uid, status: 'concluido' },
        select: { id: true, name: true, startedAt: true, durationSec: true, totalVolume: true, totalSets: true, routineDayId: true },
        orderBy: { startedAt: 'desc' },
        take: 200,
      }),
      prisma.routine.findFirst({
        where: { userId: uid, isActive: true, archived: false },
        include: {
          days: {
            orderBy: { order: 'asc' },
            include: { exercises: { include: { exercise: { select: { name: true, muscleGroup: true } } } } },
          },
        },
      }),
      prisma.workout.findFirst({
        where: { userId: uid, status: 'em_andamento' },
        select: { id: true, name: true, startedAt: true },
      }),
      prisma.user.findUnique({ where: { id: uid }, select: { name: true, trainingDays: true } }),
    ]);

    const daSemana = treinos.filter((t) => t.startedAt >= inicioSemana);

    // Próximo treino sugerido: o dia seguinte ao último realizado da rotina ativa
    let proximoDia: { id: string; name: string; exercicios: number } | null = null;
    if (rotinaAtiva && rotinaAtiva.days.length > 0) {
      const idsDias = rotinaAtiva.days.map((d) => d.id);
      const ultimo = treinos.find((t) => t.routineDayId && idsDias.includes(t.routineDayId));
      const indiceUltimo = ultimo ? rotinaAtiva.days.findIndex((d) => d.id === ultimo.routineDayId) : -1;
      const proximo = rotinaAtiva.days[(indiceUltimo + 1) % rotinaAtiva.days.length];
      proximoDia = { id: proximo.id, name: proximo.name, exercicios: proximo.exercises.length };
    }

    res.json({
      usuario: { nome: usuario?.name ?? '' },
      streak: calcularStreakDias(treinos.map((t) => t.startedAt), new Date(), fuso),
      totalTreinos: treinos.length,
      treinoEmAndamento: emAndamento,
      semana: {
        inicio: inicioSemana,
        treinos: daSemana.length,
        volume: arredondar(daSemana.reduce((acc, t) => acc + (t.totalVolume ?? 0), 0)),
        series: daSemana.reduce((acc, t) => acc + (t.totalSets ?? 0), 0),
        minutos: Math.round(daSemana.reduce((acc, t) => acc + (t.durationSec ?? 0), 0) / 60),
      },
      rotinaAtiva: rotinaAtiva
        ? {
            id: rotinaAtiva.id,
            name: rotinaAtiva.name,
            dias: rotinaAtiva.days.map((d) => ({
              id: d.id,
              name: d.name,
              exercicios: d.exercises.length,
              grupos: [...new Set(d.exercises.map((e) => e.exercise.muscleGroup))],
            })),
          }
        : null,
      proximoTreino: proximoDia,
      ultimosTreinos: treinos.slice(0, 5),
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/progresso/volume-semanal?semanas=12 — volume total por semana. */
progressRouter.get(
  '/volume-semanal',
  validate(z.object({ semanas: z.coerce.number().int().min(1).max(52).default(12) }), 'query'),
  async (req, res, next) => {
    try {
      const { semanas } = getQuery<{ semanas: number }>(req);
      const fuso = await fusoDoUsuario(userId(req));
      const inicio = somarDias(inicioDaSemana(new Date(), fuso), -(semanas - 1) * 7, fuso);

      const treinos = await prisma.workout.findMany({
        where: { userId: userId(req), status: 'concluido', startedAt: { gte: inicio } },
        select: { startedAt: true, totalVolume: true, totalSets: true },
      });

      const buckets = new Map<string, { semana: string; volume: number; treinos: number; series: number }>();
      for (let i = 0; i < semanas; i++) {
        const chave = chaveDoDia(somarDias(inicio, i * 7, fuso), fuso);
        buckets.set(chave, { semana: chave, volume: 0, treinos: 0, series: 0 });
      }
      for (const t of treinos) {
        const chave = chaveDoDia(inicioDaSemana(t.startedAt, fuso), fuso);
        const bucket = buckets.get(chave);
        if (!bucket) continue;
        bucket.volume = arredondar(bucket.volume + (t.totalVolume ?? 0));
        bucket.series += t.totalSets ?? 0;
        bucket.treinos += 1;
      }

      res.json([...buckets.values()]);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/progresso/grupos-musculares?dias=30
 * Distribuição de séries e volume por grupo muscular — ajuda a identificar
 * desequilíbrios no treino.
 */
progressRouter.get(
  '/grupos-musculares',
  validate(z.object({ dias: z.coerce.number().int().min(7).max(365).default(30) }), 'query'),
  async (req, res, next) => {
    try {
      const { dias } = getQuery<{ dias: number }>(req);
      const inicio = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

      const exercicios = await prisma.workoutExercise.findMany({
        where: { workout: { userId: userId(req), status: 'concluido', startedAt: { gte: inicio } } },
        include: {
          exercise: { select: { muscleGroup: true } },
          sets: { where: { completed: true }, select: { weight: true, reps: true, type: true } },
        },
      });

      const mapa = new Map<string, { grupo: string; series: number; volume: number }>();
      for (const we of exercicios) {
        const validas = we.sets.filter((s) => s.type !== 'aquecimento');
        if (!validas.length) continue;
        const atual = mapa.get(we.exercise.muscleGroup) ?? {
          grupo: we.exercise.muscleGroup,
          series: 0,
          volume: 0,
        };
        atual.series += validas.length;
        atual.volume = arredondar(atual.volume + validas.reduce((acc, s) => acc + s.weight * s.reps, 0));
        mapa.set(we.exercise.muscleGroup, atual);
      }

      const itens = [...mapa.values()].sort((a, b) => b.series - a.series);
      const totalSeries = itens.reduce((acc, i) => acc + i.series, 0);
      res.json(
        itens.map((i) => ({
          ...i,
          percentual: totalSeries ? arredondar((i.series / totalSeries) * 100, 1) : 0,
        })),
      );
    } catch (err) {
      next(err);
    }
  },
);

/** GET /api/progresso/frequencia?meses=6 — treinos por mês e média semanal. */
progressRouter.get(
  '/frequencia',
  validate(z.object({ meses: z.coerce.number().int().min(1).max(24).default(6) }), 'query'),
  async (req, res, next) => {
    try {
      const { meses } = getQuery<{ meses: number }>(req);
      const fuso = await fusoDoUsuario(userId(req));
      const inicio = somarMeses(new Date(), -(meses - 1), fuso);

      const treinos = await prisma.workout.findMany({
        where: { userId: userId(req), status: 'concluido', startedAt: { gte: inicio } },
        select: { startedAt: true, durationSec: true, totalVolume: true },
      });

      const buckets = new Map<string, { mes: string; treinos: number; minutos: number; volume: number }>();
      for (let i = 0; i < meses; i++) {
        const chave = chaveDoMes(somarMeses(inicio, i, fuso), fuso);
        buckets.set(chave, { mes: chave, treinos: 0, minutos: 0, volume: 0 });
      }
      for (const t of treinos) {
        const chave = chaveDoMes(t.startedAt, fuso);
        const bucket = buckets.get(chave);
        if (!bucket) continue;
        bucket.treinos += 1;
        bucket.minutos += Math.round((t.durationSec ?? 0) / 60);
        bucket.volume = arredondar(bucket.volume + (t.totalVolume ?? 0));
      }

      const itens = [...buckets.values()];
      const mediaSemanal = itens.length
        ? arredondar(itens.reduce((acc, i) => acc + i.treinos, 0) / (itens.length * 4.345), 1)
        : 0;

      res.json({ itens, mediaSemanal });
    } catch (err) {
      next(err);
    }
  },
);

/** GET /api/progresso/comparativo — este mês vs. mês passado. */
progressRouter.get('/comparativo', async (req, res, next) => {
  try {
    const uid = userId(req);
    const fuso = await fusoDoUsuario(uid);
    const agora = new Date();
    const inicioMes = inicioDoMes(agora, fuso);
    const inicioMesPassado = somarMeses(agora, -1, fuso);

    const [atual, anterior] = await Promise.all([
      prisma.workout.findMany({
        where: { userId: uid, status: 'concluido', startedAt: { gte: inicioMes } },
        select: { durationSec: true, totalVolume: true, totalSets: true, totalReps: true },
      }),
      prisma.workout.findMany({
        where: { userId: uid, status: 'concluido', startedAt: { gte: inicioMesPassado, lt: inicioMes } },
        select: { durationSec: true, totalVolume: true, totalSets: true, totalReps: true },
      }),
    ]);

    const agregar = (lista: typeof atual) => ({
      treinos: lista.length,
      volume: arredondar(lista.reduce((a, t) => a + (t.totalVolume ?? 0), 0)),
      series: lista.reduce((a, t) => a + (t.totalSets ?? 0), 0),
      repeticoes: lista.reduce((a, t) => a + (t.totalReps ?? 0), 0),
      minutos: Math.round(lista.reduce((a, t) => a + (t.durationSec ?? 0), 0) / 60),
    });

    const mesAtual = agregar(atual);
    const mesAnterior = agregar(anterior);
    const variacao = (a: number, b: number) => (b === 0 ? (a > 0 ? 100 : 0) : arredondar(((a - b) / b) * 100, 1));

    res.json({
      mesAtual,
      mesAnterior,
      variacao: {
        treinos: variacao(mesAtual.treinos, mesAnterior.treinos),
        volume: variacao(mesAtual.volume, mesAnterior.volume),
        series: variacao(mesAtual.series, mesAnterior.series),
        minutos: variacao(mesAtual.minutos, mesAnterior.minutos),
      },
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/progresso/recordes — quadro de PRs por exercício. */
progressRouter.get('/recordes', async (req, res, next) => {
  try {
    const recordes = await prisma.personalRecord.findMany({
      where: { userId: userId(req) },
      include: { exercise: { select: { id: true, name: true, muscleGroup: true } } },
      orderBy: { date: 'desc' },
    });

    const porExercicio = new Map<
      string,
      {
        exercise: { id: string; name: string; muscleGroup: string };
        recordes: Record<string, { value: number; weight: number | null; reps: number | null; date: Date }>;
      }
    >();

    for (const r of recordes) {
      const atual = porExercicio.get(r.exerciseId) ?? { exercise: r.exercise, recordes: {} };
      const existente = atual.recordes[r.type];
      if (!existente || r.value > existente.value) {
        atual.recordes[r.type] = { value: r.value, weight: r.weight, reps: r.reps, date: r.date };
      }
      porExercicio.set(r.exerciseId, atual);
    }

    res.json(
      [...porExercicio.values()].sort((a, b) =>
        (b.recordes.carga?.value ?? 0) - (a.recordes.carga?.value ?? 0),
      ),
    );
  } catch (err) {
    next(err);
  }
});

/** GET /api/progresso/conquistas — conquistas obtidas + catálogo completo. */
progressRouter.get('/conquistas', async (req, res, next) => {
  try {
    const obtidas = await prisma.achievement.findMany({
      where: { userId: userId(req) },
      orderBy: { achievedAt: 'desc' },
    });
    const codigos = new Set(obtidas.map((c) => c.code));

    res.json({
      obtidas,
      bloqueadas: CATALOGO_CONQUISTAS.filter((c) => !codigos.has(c.code)),
    });
  } catch (err) {
    next(err);
  }
});
