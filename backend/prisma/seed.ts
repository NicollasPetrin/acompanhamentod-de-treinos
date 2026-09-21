/**
 * Seed do banco:
 *  1. biblioteca global de exercícios (178 itens);
 *  2. usuário de demonstração com rotina ativa, 8 semanas de histórico,
 *     medidas corporais, metas, recordes e conquistas.
 *
 * Rode com: npm run seed
 */
import { PrismaClient } from '@prisma/client';
import { EXERCICIOS_SEED } from '../src/data/exercises';
import { TEMPLATES } from '../src/data/templates';
import { hashPassword } from '../src/lib/password';
import { toJson } from '../src/lib/json';
import { resumirSeries } from '../src/utils/calculations';
import { recalcularRecordes } from '../src/services/records';
import { verificarConquistas } from '../src/services/achievements';

const prisma = new PrismaClient();

const EMAIL_DEMO = 'demo@treinos.app';
const SENHA_DEMO = 'Demo1234';

/** Cargas iniciais (kg) usadas para gerar um histórico realista. */
const CARGA_INICIAL: Record<string, number> = {
  'Supino reto com barra': 50,
  'Supino inclinado com halteres': 18,
  'Crucifixo reto com halteres': 12,
  'Mergulho em paralelas (tríceps)': 0,
  'Tríceps na polia com corda': 20,
  'Tríceps testa com barra W': 20,
  'Barra fixa (pegada pronada)': 0,
  'Remada curvada com barra': 40,
  'Puxada frente na polia': 45,
  'Remada sentada na polia': 45,
  'Rosca direta com barra': 20,
  'Rosca martelo': 12,
  'Agachamento livre com barra': 60,
  'Leg press 45°': 120,
  'Cadeira extensora': 40,
  'Mesa flexora': 35,
  'Panturrilha em pé na máquina': 60,
  'Desenvolvimento com halteres': 14,
  'Elevação lateral com halteres': 8,
};

const aleatorio = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

async function semearExercicios() {
  const existentes = await prisma.exercise.findMany({
    where: { createdById: null },
    select: { name: true },
  });
  const jaCadastrados = new Set(existentes.map((e) => e.name));

  const novos = EXERCICIOS_SEED.filter((e) => !jaCadastrados.has(e.name)).map((e) => ({
    name: e.name,
    muscleGroup: e.muscleGroup,
    secondaryMuscles: toJson(e.secondaryMuscles),
    equipment: e.equipment,
    type: e.type,
    instructions: e.instructions,
    isUnilateral: e.isUnilateral,
    createdById: null,
  }));

  if (novos.length) await prisma.exercise.createMany({ data: novos });
  console.info(`✅ Exercícios: ${jaCadastrados.size} já existiam, ${novos.length} criados.`);
}

async function semearUsuarioDemo() {
  const jaExiste = await prisma.user.findUnique({ where: { email: EMAIL_DEMO } });
  if (jaExiste) {
    // Em produção o seed roda a cada deploy: não apagamos nada sem ser mandado.
    if (process.env.RECRIAR_DEMO !== 'true') {
      console.info('ℹ️  Usuário de demonstração já existe — nada a fazer.');
      console.info('   (use RECRIAR_DEMO=true npm run seed para recriar do zero)');
      return;
    }
    console.info('ℹ️  RECRIAR_DEMO=true — recriando o usuário de demonstração do zero.');
    await prisma.user.delete({ where: { id: jaExiste.id } });
  }

  const user = await prisma.user.create({
    data: {
      name: 'Alex Demonstração',
      email: EMAIL_DEMO,
      username: 'alexdemo',
      passwordHash: await hashPassword(SENHA_DEMO),
      birthDate: new Date('1996-04-12'),
      sex: 'outro',
      heightCm: 175,
      weightKg: 78.4,
      goal: 'hipertrofia',
      level: 'intermediario',
      weightUnit: 'kg',
      theme: 'dark',
      trainingDays: toJson(['seg', 'qua', 'sex']),
      defaultRestSec: 90,
    },
  });

  // -------------------------------------------------- Rotina ativa (ABC)
  const template = TEMPLATES.find((t) => t.slug === 'abc')!;
  const nomes = [...new Set(template.dias.flatMap((d) => d.exercicios.map((e) => e.exercicio)))];
  const exercicios = await prisma.exercise.findMany({ where: { name: { in: nomes }, createdById: null } });
  const idPorNome = new Map(exercicios.map((e) => [e.name, e.id]));

  const rotina = await prisma.routine.create({
    data: {
      userId: user.id,
      name: template.nome,
      description: template.descricao,
      goal: 'hipertrofia',
      isActive: true,
      days: {
        create: template.dias.map((dia, i) => ({
          name: dia.nome,
          order: i,
          exercises: {
            create: dia.exercicios
              .filter((e) => idPorNome.has(e.exercicio))
              .map((e, j) => ({
                exerciseId: idPorNome.get(e.exercicio)!,
                order: j,
                sets: e.sets,
                repsMin: e.repsMin,
                repsMax: e.repsMax,
                restSec: e.restSec,
                technique: e.technique ?? 'normal',
                suggestedLoad: CARGA_INICIAL[e.exercicio] ?? null,
              })),
          },
        })),
      },
    },
    include: {
      days: {
        orderBy: { order: 'asc' },
        include: { exercises: { orderBy: { order: 'asc' }, include: { exercise: true } } },
      },
    },
  });

  // Uma segunda rotina, arquivada, para demonstrar a tela de rotinas
  await prisma.routine.create({
    data: {
      userId: user.id,
      name: 'Full Body (fase anterior)',
      description: 'Rotina usada nos primeiros meses de treino.',
      goal: 'condicionamento',
      archived: true,
      days: {
        create: [
          {
            name: 'Full Body A',
            order: 0,
            exercises: {
              create: ['Agachamento livre com barra', 'Supino reto com barra', 'Remada curvada com barra']
                .filter((n) => idPorNome.has(n))
                .map((n, i) => ({ exerciseId: idPorNome.get(n)!, order: i, sets: 3, repsMin: 8, repsMax: 12 })),
            },
          },
        ],
      },
    },
  });

  // ------------------------------------------- Histórico: 8 semanas de treino
  const hoje = new Date();
  hoje.setHours(19, 0, 0, 0);
  let contadorTreinos = 0;

  for (let semana = 7; semana >= 0; semana--) {
    for (const [indice, diaSemana] of [1, 3, 5].entries()) {
      const dia = rotina.days[(contadorTreinos + indice) % rotina.days.length];
      const data = new Date(hoje);
      data.setDate(hoje.getDate() - semana * 7);
      // Aproxima para o dia da semana desejado (segunda, quarta, sexta)
      data.setDate(data.getDate() - ((data.getDay() - diaSemana + 7) % 7));
      if (data > hoje) continue;

      const duracaoMin = aleatorio(48, 78);
      const finalizado = new Date(data.getTime() + duracaoMin * 60 * 1000);

      const seriesDoTreino: { weight: number; reps: number; type: string; completed: boolean }[] = [];
      const exerciciosDoTreino = dia.exercises.map((re, ordem) => {
        const base = CARGA_INICIAL[re.exercise.name] ?? 20;
        // Progressão: ~2,5% por semana + variação natural
        const progressao = 1 + (7 - semana) * 0.025;
        const carga = base === 0 ? 0 : Math.round(base * progressao * 2) / 2;

        const sets = Array.from({ length: re.sets }, (_, i) => {
          const peso = carga === 0 ? 0 : Math.max(0, carga - i * (carga > 40 ? 2.5 : 1));
          const reps = aleatorio(re.repsMin, re.repsMax);
          const serie = { weight: peso, reps, type: 'normal', completed: true };
          seriesDoTreino.push(serie);
          return { ...serie, order: i, completedAt: finalizado };
        });

        return { exerciseId: re.exerciseId, order: ordem, sets };
      });

      const resumo = resumirSeries(seriesDoTreino);

      await prisma.workout.create({
        data: {
          userId: user.id,
          routineDayId: dia.id,
          name: dia.name,
          startedAt: data,
          finishedAt: finalizado,
          durationSec: duracaoMin * 60,
          status: 'concluido',
          rpe: aleatorio(6, 9),
          notes: semana === 0 && indice === 0 ? 'Ótima sessão, aumentar carga no supino na próxima.' : null,
          totalVolume: resumo.volume,
          totalSets: resumo.seriesConcluidas,
          totalReps: resumo.repeticoes,
          exercises: {
            create: exerciciosDoTreino.map((e) => ({
              exerciseId: e.exerciseId,
              order: e.order,
              sets: { create: e.sets },
            })),
          },
        },
      });

      contadorTreinos++;
    }
  }

  // ------------------------------------------------------ Medidas corporais
  const medidas = Array.from({ length: 8 }, (_, i) => {
    const data = new Date(hoje);
    data.setDate(hoje.getDate() - (7 - i) * 7);
    return {
      userId: user.id,
      date: data,
      weightKg: Math.round((76 + i * 0.35) * 10) / 10,
      bodyFatPct: Math.round((18.5 - i * 0.2) * 10) / 10,
      measures: toJson({
        braco: Math.round((36 + i * 0.15) * 10) / 10,
        peito: Math.round((99 + i * 0.25) * 10) / 10,
        cintura: Math.round((82 - i * 0.15) * 10) / 10,
        quadril: Math.round((98 + i * 0.05) * 10) / 10,
        coxa: Math.round((57 + i * 0.2) * 10) / 10,
        panturrilha: Math.round((37 + i * 0.08) * 10) / 10,
      }),
      photos: toJson([]),
    };
  });
  await prisma.bodyMeasurement.createMany({ data: medidas });

  // ------------------------------------------------------------------ Metas
  const supino = idPorNome.get('Supino reto com barra');
  const agachamento = idPorNome.get('Agachamento livre com barra');
  await prisma.goal.createMany({
    data: [
      {
        userId: user.id,
        title: 'Supino reto 100 kg',
        type: 'carga',
        exerciseId: supino ?? null,
        targetValue: 100,
        startValue: 50,
        deadline: new Date(hoje.getFullYear(), 11, 31),
      },
      {
        userId: user.id,
        title: 'Agachamento 120 kg',
        type: 'carga',
        exerciseId: agachamento ?? null,
        targetValue: 120,
        startValue: 60,
        deadline: new Date(hoje.getFullYear(), 11, 31),
      },
      { userId: user.id, title: 'Treinar 4x por semana', type: 'frequencia', targetValue: 4, startValue: 0 },
      { userId: user.id, title: 'Chegar a 80 kg de peso corporal', type: 'peso_corporal', targetValue: 80, startValue: 76 },
    ],
  });

  // Consolida recordes e conquistas com base no histórico gerado
  await recalcularRecordes(user.id);
  const conquistas = await verificarConquistas(user.id);

  console.info(`✅ Usuário de demonstração criado: ${EMAIL_DEMO} / ${SENHA_DEMO}`);
  console.info(`   ${contadorTreinos} treinos, ${medidas.length} medições, 4 metas, ${conquistas.length} conquistas.`);
}

async function main() {
  console.info('🌱 Populando o banco...\n');
  await semearExercicios();
  await semearUsuarioDemo();
  console.info('\n🎉 Seed concluído!\n');
}

main()
  .catch((err) => {
    console.error('❌ Erro no seed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
