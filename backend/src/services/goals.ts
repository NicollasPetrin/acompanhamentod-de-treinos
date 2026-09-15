import { prisma } from '../lib/prisma';
import { estimar1RM, progressoMeta } from '../utils/calculations';

export interface MetaComProgresso {
  id: string;
  title: string;
  type: string;
  exerciseId: string | null;
  exercise?: { id: string; name: string } | null;
  targetValue: number;
  startValue: number | null;
  deadline: Date | null;
  completed: boolean;
  completedAt: Date | null;
  currentValue: number;
  progress: number;
  createdAt: Date;
}

/** Valor atual de uma meta, calculado a partir dos registros do usuário. */
async function valorAtual(userId: string, tipo: string, exerciseId: string | null): Promise<number> {
  switch (tipo) {
    case 'carga': {
      if (!exerciseId) return 0;
      const r = await prisma.personalRecord.aggregate({
        where: { userId, exerciseId, type: 'carga' },
        _max: { value: true },
      });
      return r._max.value ?? 0;
    }
    case 'reps': {
      if (!exerciseId) return 0;
      const r = await prisma.personalRecord.aggregate({
        where: { userId, exerciseId, type: 'reps' },
        _max: { value: true },
      });
      return r._max.value ?? 0;
    }
    case '1rm': {
      if (!exerciseId) return 0;
      const sets = await prisma.workoutSet.findMany({
        where: {
          completed: true,
          type: { not: 'aquecimento' },
          workoutExercise: { exerciseId, workout: { userId, status: 'concluido' } },
        },
        select: { weight: true, reps: true },
      });
      return sets.reduce((max, s) => Math.max(max, estimar1RM(s.weight, s.reps)), 0);
    }
    case 'peso_corporal': {
      const m = await prisma.bodyMeasurement.findFirst({
        where: { userId, weightKg: { not: null } },
        orderBy: { date: 'desc' },
        select: { weightKg: true },
      });
      if (m?.weightKg != null) return m.weightKg;
      const u = await prisma.user.findUnique({ where: { id: userId }, select: { weightKg: true } });
      return u?.weightKg ?? 0;
    }
    case 'frequencia': {
      // Treinos concluídos nos últimos 7 dias
      const inicio = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return prisma.workout.count({
        where: { userId, status: 'concluido', startedAt: { gte: inicio } },
      });
    }
    case 'volume': {
      // Volume total da semana corrente (segunda a domingo)
      const agora = new Date();
      const diaSemana = (agora.getDay() + 6) % 7; // segunda = 0
      const inicio = new Date(agora);
      inicio.setDate(agora.getDate() - diaSemana);
      inicio.setHours(0, 0, 0, 0);
      const r = await prisma.workout.aggregate({
        where: { userId, status: 'concluido', startedAt: { gte: inicio } },
        _sum: { totalVolume: true },
      });
      return r._sum.totalVolume ?? 0;
    }
    default:
      return 0;
  }
}

/**
 * Carrega as metas do usuário já com valor atual, progresso em % e marcando
 * como concluídas as que atingiram o alvo.
 */
export async function metasComProgresso(userId: string, apenasAbertas = false) {
  const metas = await prisma.goal.findMany({
    where: { userId, ...(apenasAbertas ? { completed: false } : {}) },
    include: { exercise: { select: { id: true, name: true } } },
    orderBy: [{ completed: 'asc' }, { createdAt: 'desc' }],
  });

  const resultado: MetaComProgresso[] = [];
  for (const meta of metas) {
    const atual = await valorAtual(userId, meta.type, meta.exerciseId);
    const progresso = progressoMeta(atual, meta.targetValue, meta.startValue ?? 0);
    let { completed, completedAt } = meta;

    // Metas de emagrecimento: alvo abaixo do valor inicial
    const alvoAtingido =
      meta.startValue != null && meta.targetValue < meta.startValue
        ? atual > 0 && atual <= meta.targetValue
        : atual >= meta.targetValue;

    if (!completed && alvoAtingido) {
      const atualizada = await prisma.goal.update({
        where: { id: meta.id },
        data: { completed: true, completedAt: new Date() },
      });
      completed = atualizada.completed;
      completedAt = atualizada.completedAt;
    }

    // Quem pediu só as metas abertas não deve receber a que acabou de fechar
    if (apenasAbertas && completed) continue;

    resultado.push({
      id: meta.id,
      title: meta.title,
      type: meta.type,
      exerciseId: meta.exerciseId,
      exercise: meta.exercise,
      targetValue: meta.targetValue,
      startValue: meta.startValue,
      deadline: meta.deadline,
      completed,
      completedAt,
      currentValue: atual,
      progress: alvoAtingido ? 100 : progresso,
      createdAt: meta.createdAt,
    });
  }

  return resultado;
}
