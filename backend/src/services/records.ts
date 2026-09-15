import { prisma } from '../lib/prisma';
import { toJson } from '../lib/json';
import {
  detectarRecordes,
  valorDoRecorde,
  type MelhoresMarcas,
  type PrType,
  type SetLike,
} from '../utils/calculations';

const TIPOS: PrType[] = ['carga', 'reps', 'volume', '1rm'];

/** Melhores marcas já registradas do usuário em um exercício. */
export async function melhoresMarcas(userId: string, exerciseId: string): Promise<MelhoresMarcas> {
  const records = await prisma.personalRecord.groupBy({
    by: ['type'],
    where: { userId, exerciseId },
    _max: { value: true },
  });

  const marcas: MelhoresMarcas = {};
  for (const r of records) {
    const tipo = r.type as PrType;
    if (TIPOS.includes(tipo) && r._max.value != null) marcas[tipo] = r._max.value;
  }
  return marcas;
}

export interface RecordeRegistrado {
  type: PrType;
  value: number;
}

/**
 * Verifica, em tempo real, se a série recém-concluída é recorde.
 *
 * A checagem é *provisória*: compara com as melhores marcas já consolidadas
 * (treinos concluídos) e também com as séries anteriores do treino em
 * andamento, para que a UI mostre o "PR!" na hora. Os registros definitivos em
 * `personal_records` só são gravados ao finalizar o treino
 * (`recalcularRecordes`), evitando recordes órfãos caso o usuário edite ou
 * descarte o treino.
 */
export async function verificarRecordeProvisorio(params: {
  userId: string;
  exerciseId: string;
  workoutId: string;
  set: SetLike & { id: string };
}): Promise<RecordeRegistrado[]> {
  const { userId, exerciseId, workoutId, set } = params;

  const marcas = await melhoresMarcas(userId, exerciseId);

  // Considera também as séries já concluídas neste mesmo treino
  const seriesDoTreino = await prisma.workoutSet.findMany({
    where: {
      completed: true,
      type: { not: 'aquecimento' },
      id: { not: set.id },
      workoutExercise: { workoutId, exerciseId },
    },
    select: { weight: true, reps: true },
  });

  for (const s of seriesDoTreino) {
    for (const tipo of TIPOS) {
      const valor = valorDoRecorde(tipo, s);
      if (marcas[tipo] === undefined || valor > (marcas[tipo] as number)) marcas[tipo] = valor;
    }
  }

  const tipos = detectarRecordes(set, marcas);
  await prisma.workoutSet.update({
    where: { id: set.id },
    data: { isPr: tipos.length > 0, prTypes: toJson(tipos) },
  });

  return tipos.map((type) => ({ type, value: valorDoRecorde(type, set) }));
}

/**
 * Recalcula do zero todos os recordes de um exercício (ou de todos, se
 * `exerciseId` for omitido). Necessário depois de editar/excluir treinos, para
 * que um PR não continue valendo com base em série apagada.
 */
export async function recalcularRecordes(userId: string, exerciseId?: string) {
  const workoutExercises = await prisma.workoutExercise.findMany({
    where: {
      workout: { userId, status: 'concluido' },
      ...(exerciseId ? { exerciseId } : {}),
    },
    include: { sets: { orderBy: { order: 'asc' } }, workout: { select: { id: true, startedAt: true } } },
    orderBy: { workout: { startedAt: 'asc' } },
  });

  await prisma.personalRecord.deleteMany({
    where: { userId, ...(exerciseId ? { exerciseId } : {}) },
  });
  await prisma.workoutSet.updateMany({
    where: { workoutExercise: { workout: { userId }, ...(exerciseId ? { exerciseId } : {}) } },
    data: { isPr: false, prTypes: toJson([]) },
  });

  // Reprocessa em ordem cronológica, do jeito que aconteceu.
  const marcasPorExercicio = new Map<string, MelhoresMarcas>();
  const novos: Array<{
    userId: string;
    exerciseId: string;
    type: string;
    value: number;
    weight: number;
    reps: number;
    workoutSetId: string;
    workoutId: string;
    date: Date;
  }> = [];
  const setsComPr = new Map<string, PrType[]>();

  for (const we of workoutExercises) {
    const marcas = marcasPorExercicio.get(we.exerciseId) ?? {};
    for (const set of we.sets) {
      const tipos = detectarRecordes(set, marcas);
      if (tipos.length === 0) continue;
      for (const tipo of tipos) {
        const valor = valorDoRecorde(tipo, set);
        marcas[tipo] = valor;
        novos.push({
          userId,
          exerciseId: we.exerciseId,
          type: tipo,
          value: valor,
          weight: set.weight,
          reps: set.reps,
          workoutSetId: set.id,
          workoutId: we.workout.id,
          date: we.workout.startedAt,
        });
      }
      setsComPr.set(set.id, tipos);
    }
    marcasPorExercicio.set(we.exerciseId, marcas);
  }

  if (novos.length) await prisma.personalRecord.createMany({ data: novos });
  for (const [setId, tipos] of setsComPr) {
    await prisma.workoutSet.update({
      where: { id: setId },
      data: { isPr: true, prTypes: toJson(tipos) },
    });
  }

  return novos.length;
}
