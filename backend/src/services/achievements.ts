import { prisma } from '../lib/prisma';
import { calcularStreakDias } from '../utils/calculations';

interface DefinicaoConquista {
  code: string;
  title: string;
  description: string;
  icon: string;
  atingida: (ctx: ContextoConquistas) => boolean;
}

interface ContextoConquistas {
  totalTreinos: number;
  streak: number;
  maiorCarga: number;
  maiorVolumeTreino: number;
  treinosUltimos7Dias: number;
  maiorDuracaoMin: number;
  treinoMadrugada: boolean;
  treinoNoturno: boolean;
}

const DEFINICOES: DefinicaoConquista[] = [
  { code: 'primeiro_treino', title: 'Primeiro treino', description: 'Você registrou seu primeiro treino. Começou!', icon: '🎉', atingida: (c) => c.totalTreinos >= 1 },
  { code: 'treinos_10', title: '10 treinos', description: 'Dez treinos registrados. A constância está virando hábito.', icon: '💪', atingida: (c) => c.totalTreinos >= 10 },
  { code: 'treinos_25', title: '25 treinos', description: 'Vinte e cinco treinos no histórico.', icon: '🔥', atingida: (c) => c.totalTreinos >= 25 },
  { code: 'treinos_50', title: '50 treinos', description: 'Cinquenta treinos. Isso é dedicação.', icon: '🏆', atingida: (c) => c.totalTreinos >= 50 },
  { code: 'treinos_100', title: '100 treinos', description: 'Cem treinos registrados. Nível lenda.', icon: '👑', atingida: (c) => c.totalTreinos >= 100 },
  { code: 'streak_7', title: '7 dias seguidos', description: 'Uma semana inteira sem falhar.', icon: '📅', atingida: (c) => c.streak >= 7 },
  { code: 'streak_30', title: '30 dias seguidos', description: 'Trinta dias consecutivos de treino.', icon: '🗓️', atingida: (c) => c.streak >= 30 },
  { code: 'clube_100', title: 'Clube dos 100 kg', description: 'Você levantou 100 kg ou mais em uma série.', icon: '🥇', atingida: (c) => c.maiorCarga >= 100 },
  { code: 'clube_150', title: 'Clube dos 150 kg', description: 'Você levantou 150 kg ou mais em uma série.', icon: '🦾', atingida: (c) => c.maiorCarga >= 150 },
  { code: 'volume_10t', title: '10 toneladas em um treino', description: 'Volume de 10.000 kg em uma única sessão.', icon: '🚛', atingida: (c) => c.maiorVolumeTreino >= 10000 },
  { code: 'semana_5', title: '5 treinos em uma semana', description: 'Cinco sessões nos últimos 7 dias.', icon: '⚡', atingida: (c) => c.treinosUltimos7Dias >= 5 },
  { code: 'maratonista', title: 'Maratonista', description: 'Um treino de 90 minutos ou mais.', icon: '⏱️', atingida: (c) => c.maiorDuracaoMin >= 90 },
  { code: 'madrugador', title: 'Madrugador', description: 'Treino iniciado antes das 6h da manhã.', icon: '🌅', atingida: (c) => c.treinoMadrugada },
  { code: 'coruja', title: 'Coruja', description: 'Treino iniciado depois das 22h.', icon: '🦉', atingida: (c) => c.treinoNoturno },
];

/**
 * Recalcula as conquistas do usuário e grava as novas.
 * Chamado ao finalizar um treino. Retorna apenas as conquistas inéditas.
 */
export async function verificarConquistas(userId: string) {
  const treinos = await prisma.workout.findMany({
    where: { userId, status: 'concluido' },
    select: { startedAt: true, durationSec: true, totalVolume: true },
  });

  if (treinos.length === 0) return [];

  const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const maiorCargaRecord = await prisma.personalRecord.aggregate({
    where: { userId, type: 'carga' },
    _max: { value: true },
  });

  const ctx: ContextoConquistas = {
    totalTreinos: treinos.length,
    streak: calcularStreakDias(treinos.map((t) => t.startedAt)),
    maiorCarga: maiorCargaRecord._max.value ?? 0,
    maiorVolumeTreino: Math.max(...treinos.map((t) => t.totalVolume ?? 0)),
    treinosUltimos7Dias: treinos.filter((t) => t.startedAt >= seteDiasAtras).length,
    maiorDuracaoMin: Math.max(...treinos.map((t) => (t.durationSec ?? 0) / 60)),
    treinoMadrugada: treinos.some((t) => t.startedAt.getHours() < 6),
    treinoNoturno: treinos.some((t) => t.startedAt.getHours() >= 22),
  };

  const existentes = await prisma.achievement.findMany({ where: { userId }, select: { code: true } });
  const jaTem = new Set(existentes.map((a) => a.code));

  const novas = DEFINICOES.filter((d) => !jaTem.has(d.code) && d.atingida(ctx));
  for (const nova of novas) {
    await prisma.achievement.create({
      data: {
        userId,
        code: nova.code,
        title: nova.title,
        description: nova.description,
        icon: nova.icon,
      },
    });
  }

  return novas.map((n) => ({ code: n.code, title: n.title, description: n.description, icon: n.icon }));
}

/** Catálogo completo (para mostrar conquistas bloqueadas na tela de progresso). */
export const CATALOGO_CONQUISTAS = DEFINICOES.map(({ code, title, description, icon }) => ({
  code,
  title,
  description,
  icon,
}));
