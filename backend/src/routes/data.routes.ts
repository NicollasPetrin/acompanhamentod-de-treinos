import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, userId } from '../middleware/auth';
import { getQuery, validate } from '../middleware/validate';
import { parseCsv, toCsv, normalizarNome } from '../lib/csv';
import { parseJson, toJson } from '../lib/json';
import { badRequest } from '../lib/errors';
import { resumirSeries } from '../utils/calculations';
import { recalcularRecordes } from '../services/records';

export const dataRouter = Router();
dataRouter.use(requireAuth);

/**
 * GET /api/dados/exportar?formato=json|csv
 * Exporta todos os dados do usuário (LGPD-friendly e útil para backup).
 */
dataRouter.get(
  '/exportar',
  validate(z.object({ formato: z.enum(['json', 'csv']).default('json') }), 'query'),
  async (req, res, next) => {
    try {
      const uid = userId(req);
      const { formato } = getQuery<{ formato: 'json' | 'csv' }>(req);

      const [usuario, rotinas, treinos, medidas, metas, recordes, conquistas, exerciciosProprios] =
        await Promise.all([
          prisma.user.findUniqueOrThrow({ where: { id: uid } }),
          prisma.routine.findMany({
            where: { userId: uid },
            include: { days: { include: { exercises: { include: { exercise: true } } } } },
          }),
          prisma.workout.findMany({
            where: { userId: uid },
            include: { exercises: { include: { exercise: true, sets: true } } },
            orderBy: { startedAt: 'asc' },
          }),
          prisma.bodyMeasurement.findMany({ where: { userId: uid }, orderBy: { date: 'asc' } }),
          prisma.goal.findMany({ where: { userId: uid } }),
          prisma.personalRecord.findMany({ where: { userId: uid }, include: { exercise: true } }),
          prisma.achievement.findMany({ where: { userId: uid } }),
          prisma.exercise.findMany({ where: { createdById: uid } }),
        ]);

      if (formato === 'csv') {
        // CSV no formato "uma linha por série" — compatível com planilhas
        const linhas = treinos.flatMap((t) =>
          t.exercises.flatMap((we) =>
            we.sets.map((s) => ({
              data: t.startedAt.toISOString(),
              treino: t.name,
              duracao_min: Math.round((t.durationSec ?? 0) / 60),
              exercicio: we.exercise.name,
              grupo_muscular: we.exercise.muscleGroup,
              serie: s.order + 1,
              tipo: s.type,
              peso_kg: s.weight,
              reps: s.reps,
              rpe: s.rpe ?? '',
              concluida: s.completed ? 'sim' : 'nao',
              pr: s.isPr ? 'sim' : 'nao',
              notas_exercicio: we.notes ?? '',
              notas_treino: t.notes ?? '',
            })),
          ),
        );

        res.type('text/csv; charset=utf-8')
          .set('Content-Disposition', `attachment; filename="treinos-${Date.now()}.csv"`)
          .send(toCsv(linhas));
        return;
      }

      const { passwordHash: _ignorado, ...perfil } = usuario;
      res.type('application/json')
        .set('Content-Disposition', `attachment; filename="treinos-${Date.now()}.json"`)
        .send(
          JSON.stringify(
            {
              versao: 1,
              exportadoEm: new Date().toISOString(),
              usuario: { ...perfil, trainingDays: parseJson<string[]>(usuario.trainingDays, []) },
              exerciciosPersonalizados: exerciciosProprios,
              rotinas,
              treinos,
              medidas,
              metas,
              recordes,
              conquistas,
            },
            null,
            2,
          ),
        );
    } catch (err) {
      next(err);
    }
  },
);

/** Dicionário de apelidos para casar nomes em inglês (Strong/Hevy) com a biblioteca. */
const ALIASES: Record<string, string> = {
  'bench press barbell': 'Supino reto com barra',
  'bench press': 'Supino reto com barra',
  'incline bench press barbell': 'Supino inclinado com barra',
  'incline bench press dumbbell': 'Supino inclinado com halteres',
  'bench press dumbbell': 'Supino reto com halteres',
  'squat barbell': 'Agachamento livre com barra',
  'back squat': 'Agachamento livre com barra',
  'front squat': 'Agachamento frontal',
  'deadlift barbell': 'Levantamento terra convencional',
  'deadlift': 'Levantamento terra convencional',
  'romanian deadlift barbell': 'Levantamento terra romeno',
  'romanian deadlift': 'Levantamento terra romeno',
  'overhead press barbell': 'Desenvolvimento militar com barra',
  'overhead press': 'Desenvolvimento militar com barra',
  'shoulder press dumbbell': 'Desenvolvimento com halteres',
  'lat pulldown cable': 'Puxada frente na polia',
  'lat pulldown': 'Puxada frente na polia',
  'pull up': 'Barra fixa (pegada pronada)',
  'chin up': 'Barra fixa (pegada supinada)',
  'barbell row': 'Remada curvada com barra',
  'bent over row barbell': 'Remada curvada com barra',
  'seated cable row': 'Remada sentada na polia',
  'leg press': 'Leg press 45°',
  'leg extension': 'Cadeira extensora',
  'lying leg curl': 'Mesa flexora',
  'seated leg curl': 'Cadeira flexora sentada',
  'lateral raise dumbbell': 'Elevação lateral com halteres',
  'lateral raise': 'Elevação lateral com halteres',
  'bicep curl barbell': 'Rosca direta com barra',
  'bicep curl dumbbell': 'Rosca alternada com halteres',
  'hammer curl dumbbell': 'Rosca martelo',
  'triceps pushdown cable': 'Tríceps na polia com barra',
  'triceps rope pushdown cable': 'Tríceps na polia com corda',
  'hip thrust barbell': 'Elevação pélvica (hip thrust)',
  'standing calf raise': 'Panturrilha em pé na máquina',
  'seated calf raise': 'Panturrilha sentado',
  'plank': 'Prancha isométrica',
};

interface LinhaImportada {
  workoutKey: string;
  workoutName: string;
  startedAt: Date;
  finishedAt: Date | null;
  exercicio: string;
  setIndex: number;
  weight: number;
  reps: number;
  rpe: number | null;
  tipo: string;
  notes: string;
}

const num = (v: string | undefined) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

/** Converte o CSV do Strong ou do Hevy num formato interno comum. */
function normalizarLinhas(registros: Record<string, string>[], origem: 'strong' | 'hevy' | 'auto'): LinhaImportada[] {
  if (registros.length === 0) return [];
  const colunas = Object.keys(registros[0]).map((c) => c.toLowerCase());
  const detectado =
    origem !== 'auto' ? origem : colunas.includes('exercise_title') || colunas.includes('start_time') ? 'hevy' : 'strong';

  return registros.flatMap((r) => {
    const get = (...chaves: string[]) => {
      for (const chave of chaves) {
        const encontrada = Object.keys(r).find((k) => k.toLowerCase() === chave);
        if (encontrada && r[encontrada] !== '') return r[encontrada];
      }
      return '';
    };

    const exercicio = detectado === 'hevy' ? get('exercise_title') : get('exercise name', 'exercise');
    if (!exercicio) return [];

    const inicioTexto = detectado === 'hevy' ? get('start_time') : get('date');
    const inicio = new Date(inicioTexto);
    if (Number.isNaN(inicio.getTime())) return [];

    const fimTexto = detectado === 'hevy' ? get('end_time') : '';
    const fim = fimTexto ? new Date(fimTexto) : null;

    const nomeTreino = (detectado === 'hevy' ? get('title') : get('workout name')) || 'Treino importado';
    const tipoSerie = (detectado === 'hevy' ? get('set_type') : get('set order')).toLowerCase();

    return [
      {
        workoutKey: `${nomeTreino}|${inicioTexto}`,
        workoutName: nomeTreino,
        startedAt: inicio,
        finishedAt: fim && !Number.isNaN(fim.getTime()) ? fim : null,
        exercicio,
        setIndex: Math.max(0, num(detectado === 'hevy' ? get('set_index') : get('set order'))),
        weight: num(detectado === 'hevy' ? get('weight_kg', 'weight') : get('weight')),
        reps: Math.round(num(get('reps'))),
        rpe: get('rpe') ? Math.round(num(get('rpe'))) : null,
        tipo: tipoSerie.includes('warm') ? 'aquecimento' : tipoSerie.includes('drop') ? 'drop' : 'normal',
        notes: detectado === 'hevy' ? get('exercise_notes') : get('notes'),
      },
    ];
  });
}

/**
 * POST /api/dados/importar
 * Importa treinos a partir de um CSV exportado do Strong ou do Hevy.
 * Exercícios que não existem na biblioteca viram exercícios personalizados.
 */
dataRouter.post(
  '/importar',
  validate(
    z.object({
      csv: z.string().min(10),
      origem: z.enum(['strong', 'hevy', 'auto']).default('auto'),
    }),
  ),
  async (req, res, next) => {
    try {
      const uid = userId(req);
      const { csv, origem } = req.body as { csv: string; origem: 'strong' | 'hevy' | 'auto' };

      const registros = parseCsv(csv);
      if (registros.length === 0) throw badRequest('CSV vazio ou em formato não reconhecido');

      const linhas = normalizarLinhas(registros, origem);
      if (linhas.length === 0) throw badRequest('Nenhuma série encontrada no arquivo');

      // Resolve cada nome de exercício (biblioteca → alias → cria personalizado)
      const disponiveis = await prisma.exercise.findMany({
        where: { OR: [{ createdById: null }, { createdById: uid }] },
        select: { id: true, name: true },
      });
      const porNome = new Map(disponiveis.map((e) => [normalizarNome(e.name), e.id]));
      const aliases = new Map(Object.entries(ALIASES).map(([k, v]) => [normalizarNome(k), normalizarNome(v)]));

      const idPorNomeOriginal = new Map<string, string>();
      let criados = 0;
      for (const nome of new Set(linhas.map((l) => l.exercicio))) {
        const normalizado = normalizarNome(nome);
        let id = porNome.get(normalizado) ?? porNome.get(aliases.get(normalizado) ?? '');
        if (!id) {
          const novo = await prisma.exercise.create({
            data: {
              name: nome,
              muscleGroup: 'corpo_todo',
              secondaryMuscles: toJson([]),
              equipment: 'outro',
              type: 'forca',
              instructions: 'Exercício importado de outro aplicativo.',
              createdById: uid,
            },
          });
          id = novo.id;
          porNome.set(normalizado, id);
          criados++;
        }
        idPorNomeOriginal.set(nome, id);
      }

      // Agrupa as linhas em treinos
      const porTreino = new Map<string, LinhaImportada[]>();
      for (const linha of linhas) {
        const lista = porTreino.get(linha.workoutKey) ?? [];
        lista.push(linha);
        porTreino.set(linha.workoutKey, lista);
      }

      let importados = 0;
      let ignorados = 0;
      const exerciciosAfetados = new Set<string>();

      for (const [chave, itens] of porTreino) {
        const clientId = `import:${chave}`.slice(0, 60);
        const existente = await prisma.workout.findFirst({ where: { userId: uid, clientId } });
        if (existente) {
          ignorados++;
          continue;
        }

        const inicio = itens[0].startedAt;
        const fim = itens[0].finishedAt ?? new Date(inicio.getTime() + 60 * 60 * 1000);

        const porExercicio = new Map<string, LinhaImportada[]>();
        for (const item of itens) {
          const id = idPorNomeOriginal.get(item.exercicio)!;
          exerciciosAfetados.add(id);
          const lista = porExercicio.get(id) ?? [];
          lista.push(item);
          porExercicio.set(id, lista);
        }

        const series = itens.map((i) => ({ weight: i.weight, reps: i.reps, type: i.tipo, completed: true }));
        const resumo = resumirSeries(series);

        await prisma.workout.create({
          data: {
            userId: uid,
            clientId,
            name: itens[0].workoutName,
            startedAt: inicio,
            finishedAt: fim,
            durationSec: Math.max(0, Math.round((fim.getTime() - inicio.getTime()) / 1000)),
            status: 'concluido',
            totalVolume: resumo.volume,
            totalSets: resumo.seriesConcluidas,
            totalReps: resumo.repeticoes,
            exercises: {
              create: [...porExercicio.entries()].map(([exerciseId, linhasDoExercicio], ordem) => ({
                exerciseId,
                order: ordem,
                notes: linhasDoExercicio.find((l) => l.notes)?.notes || null,
                sets: {
                  create: linhasDoExercicio
                    .sort((a, b) => a.setIndex - b.setIndex)
                    .map((l, i) => ({
                      order: i,
                      weight: l.weight,
                      reps: l.reps,
                      rpe: l.rpe,
                      type: l.tipo,
                      completed: true,
                      completedAt: inicio,
                    })),
                },
              })),
            },
          },
        });
        importados++;
      }

      for (const exerciseId of exerciciosAfetados) {
        await recalcularRecordes(uid, exerciseId);
      }

      res.json({
        mensagem: `${importados} treino(s) importado(s)`,
        importados,
        ignorados,
        exerciciosCriados: criados,
      });
    } catch (err) {
      next(err);
    }
  },
);
