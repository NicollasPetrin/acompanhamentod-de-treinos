/**
 * Templates de rotina prontos. Ao aplicar um template criamos uma rotina real
 * do usuário, resolvendo cada exercício pelo nome na biblioteca global.
 */
export interface TemplateExercicio {
  exercicio: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSec: number;
  technique?: string;
  groupKey?: string;
  notes?: string;
}

export interface TemplateDia {
  nome: string;
  exercicios: TemplateExercicio[];
}

export interface TemplateRotina {
  slug: string;
  nome: string;
  descricao: string;
  objetivo: string;
  nivel: string;
  diasPorSemana: number;
  dias: TemplateDia[];
}

const e = (
  exercicio: string,
  sets: number,
  repsMin: number,
  repsMax: number,
  restSec = 90,
  extras: Partial<TemplateExercicio> = {},
): TemplateExercicio => ({ exercicio, sets, repsMin, repsMax, restSec, ...extras });

export const TEMPLATES: TemplateRotina[] = [
  {
    slug: 'abc',
    nome: 'ABC clássico',
    descricao: 'Divisão em três treinos: peito/tríceps, costas/bíceps e pernas. Simples e eficiente para quem treina de 3 a 6 vezes por semana.',
    objetivo: 'hipertrofia',
    nivel: 'iniciante',
    diasPorSemana: 3,
    dias: [
      {
        nome: 'Treino A — Peito e Tríceps',
        exercicios: [
          e('Supino reto com barra', 4, 8, 12, 120),
          e('Supino inclinado com halteres', 3, 8, 12, 90),
          e('Crucifixo reto com halteres', 3, 10, 15, 60),
          e('Mergulho em paralelas (tríceps)', 3, 8, 12, 90),
          e('Tríceps na polia com corda', 3, 10, 15, 60),
          e('Tríceps testa com barra W', 3, 10, 12, 60),
        ],
      },
      {
        nome: 'Treino B — Costas e Bíceps',
        exercicios: [
          e('Barra fixa (pegada pronada)', 4, 6, 10, 120),
          e('Remada curvada com barra', 4, 8, 12, 120),
          e('Puxada frente na polia', 3, 10, 12, 90),
          e('Remada sentada na polia', 3, 10, 12, 90),
          e('Rosca direta com barra', 3, 8, 12, 60),
          e('Rosca martelo', 3, 10, 12, 60),
        ],
      },
      {
        nome: 'Treino C — Pernas e Ombros',
        exercicios: [
          e('Agachamento livre com barra', 4, 6, 10, 150),
          e('Leg press 45°', 3, 10, 15, 120),
          e('Cadeira extensora', 3, 12, 15, 60),
          e('Mesa flexora', 3, 10, 15, 60),
          e('Panturrilha em pé na máquina', 4, 12, 20, 45),
          e('Desenvolvimento com halteres', 3, 8, 12, 90),
          e('Elevação lateral com halteres', 3, 12, 15, 45),
        ],
      },
    ],
  },
  {
    slug: 'abcd',
    nome: 'ABCD',
    descricao: 'Quatro treinos por semana com mais volume por grupo muscular. Indicado para quem já treina há alguns meses.',
    objetivo: 'hipertrofia',
    nivel: 'intermediario',
    diasPorSemana: 4,
    dias: [
      {
        nome: 'Treino A — Peito e Abdômen',
        exercicios: [
          e('Supino reto com barra', 4, 6, 10, 120),
          e('Supino inclinado com halteres', 4, 8, 12, 90),
          e('Crossover no cabo', 3, 12, 15, 60),
          e('Voador (peck deck)', 3, 12, 15, 60),
          e('Abdominal na polia (crunch ajoelhado)', 3, 12, 15, 45),
          e('Prancha isométrica', 3, 30, 60, 45, { notes: 'Repetições = segundos de isometria' }),
        ],
      },
      {
        nome: 'Treino B — Costas e Lombar',
        exercicios: [
          e('Levantamento terra convencional', 4, 5, 8, 180),
          e('Barra fixa (pegada pronada)', 3, 6, 10, 120),
          e('Remada curvada supinada', 4, 8, 12, 90),
          e('Puxada triângulo (neutra)', 3, 10, 12, 90),
          e('Face pull', 3, 15, 20, 45),
        ],
      },
      {
        nome: 'Treino C — Pernas',
        exercicios: [
          e('Agachamento livre com barra', 4, 6, 10, 180),
          e('Levantamento terra romeno', 4, 8, 12, 120),
          e('Leg press 45°', 3, 10, 15, 120),
          e('Cadeira extensora', 3, 12, 15, 60),
          e('Cadeira flexora sentada', 3, 12, 15, 60),
          e('Panturrilha sentado', 4, 15, 20, 45),
        ],
      },
      {
        nome: 'Treino D — Ombros e Braços',
        exercicios: [
          e('Desenvolvimento militar com barra', 4, 6, 10, 120),
          e('Elevação lateral com halteres', 4, 12, 15, 45),
          e('Crucifixo inverso na máquina', 3, 12, 15, 45),
          e('Rosca direta com barra W', 3, 8, 12, 60, { technique: 'superset', groupKey: 'bracos' }),
          e('Tríceps na polia com barra', 3, 10, 12, 60, { technique: 'superset', groupKey: 'bracos' }),
          e('Rosca martelo', 3, 10, 12, 60, { technique: 'superset', groupKey: 'bracos2' }),
          e('Tríceps francês com barra', 3, 10, 12, 60, { technique: 'superset', groupKey: 'bracos2' }),
        ],
      },
    ],
  },
  {
    slug: 'push-pull-legs',
    nome: 'Push / Pull / Legs',
    descricao: 'Empurrar, puxar e pernas. Pode ser feito 3x ou 6x por semana (repetindo o ciclo).',
    objetivo: 'hipertrofia',
    nivel: 'intermediario',
    diasPorSemana: 6,
    dias: [
      {
        nome: 'Push — Peito, Ombros e Tríceps',
        exercicios: [
          e('Supino reto com barra', 4, 6, 10, 120),
          e('Desenvolvimento com halteres', 3, 8, 12, 90),
          e('Supino inclinado com halteres', 3, 8, 12, 90),
          e('Elevação lateral com halteres', 4, 12, 15, 45),
          e('Tríceps na polia com corda', 3, 10, 15, 60),
          e('Tríceps francês unilateral', 3, 10, 12, 60),
        ],
      },
      {
        nome: 'Pull — Costas e Bíceps',
        exercicios: [
          e('Barra fixa (pegada pronada)', 4, 6, 10, 120),
          e('Remada curvada com barra', 4, 8, 12, 120),
          e('Puxada frente na polia', 3, 10, 12, 90),
          e('Face pull', 3, 15, 20, 45),
          e('Rosca direta com barra', 3, 8, 12, 60),
          e('Rosca inclinada com halteres', 3, 10, 12, 60),
        ],
      },
      {
        nome: 'Legs — Pernas completas',
        exercicios: [
          e('Agachamento livre com barra', 4, 6, 10, 180),
          e('Levantamento terra romeno', 3, 8, 12, 120),
          e('Leg press 45°', 3, 10, 15, 120),
          e('Mesa flexora', 3, 12, 15, 60),
          e('Elevação pélvica (hip thrust)', 3, 10, 15, 90),
          e('Panturrilha em pé na máquina', 4, 12, 20, 45),
        ],
      },
    ],
  },
  {
    slug: 'upper-lower',
    nome: 'Upper / Lower',
    descricao: 'Alterna treinos de membros superiores e inferiores. Quatro sessões por semana com boa recuperação.',
    objetivo: 'forca',
    nivel: 'intermediario',
    diasPorSemana: 4,
    dias: [
      {
        nome: 'Upper A — Superiores (força)',
        exercicios: [
          e('Supino reto com barra', 4, 4, 6, 180),
          e('Remada curvada com barra', 4, 6, 8, 150),
          e('Desenvolvimento militar com barra', 3, 6, 8, 120),
          e('Puxada frente na polia', 3, 8, 12, 90),
          e('Rosca direta com barra', 3, 8, 10, 60),
          e('Tríceps na polia com barra', 3, 8, 12, 60),
        ],
      },
      {
        nome: 'Lower A — Inferiores (força)',
        exercicios: [
          e('Agachamento livre com barra', 4, 4, 6, 210),
          e('Levantamento terra romeno', 3, 6, 8, 150),
          e('Leg press 45°', 3, 8, 12, 120),
          e('Cadeira flexora sentada', 3, 10, 12, 60),
          e('Panturrilha em pé na máquina', 4, 10, 15, 45),
          e('Prancha isométrica', 3, 30, 60, 45, { notes: 'Repetições = segundos' }),
        ],
      },
      {
        nome: 'Upper B — Superiores (volume)',
        exercicios: [
          e('Supino inclinado com halteres', 4, 8, 12, 90),
          e('Remada sentada na polia', 4, 10, 12, 90),
          e('Desenvolvimento na máquina', 3, 10, 12, 75),
          e('Crucifixo inverso com halteres', 3, 12, 15, 45),
          e('Rosca martelo', 3, 10, 12, 60),
          e('Tríceps banco', 3, 10, 15, 60),
        ],
      },
      {
        nome: 'Lower B — Inferiores (volume)',
        exercicios: [
          e('Agachamento frontal', 4, 8, 10, 150),
          e('Agachamento búlgaro', 3, 10, 12, 90),
          e('Mesa flexora', 4, 10, 15, 60),
          e('Elevação pélvica (hip thrust)', 4, 10, 15, 90),
          e('Panturrilha sentado', 4, 15, 20, 45),
        ],
      },
    ],
  },
  {
    slug: 'full-body',
    nome: 'Full Body',
    descricao: 'Corpo inteiro em cada sessão, 3x por semana. Excelente para iniciantes e para quem tem pouco tempo.',
    objetivo: 'condicionamento',
    nivel: 'iniciante',
    diasPorSemana: 3,
    dias: [
      {
        nome: 'Full Body A',
        exercicios: [
          e('Agachamento livre com barra', 3, 8, 12, 120),
          e('Supino reto com barra', 3, 8, 12, 120),
          e('Remada curvada com barra', 3, 8, 12, 90),
          e('Desenvolvimento com halteres', 3, 10, 12, 75),
          e('Prancha isométrica', 3, 30, 45, 45, { notes: 'Repetições = segundos' }),
        ],
      },
      {
        nome: 'Full Body B',
        exercicios: [
          e('Levantamento terra romeno', 3, 8, 10, 120),
          e('Leg press 45°', 3, 10, 15, 90),
          e('Puxada frente na polia', 3, 10, 12, 90),
          e('Supino inclinado com halteres', 3, 10, 12, 90),
          e('Elevação lateral com halteres', 3, 12, 15, 45),
        ],
      },
      {
        nome: 'Full Body C',
        exercicios: [
          e('Agachamento goblet', 3, 10, 15, 90),
          e('Flexão de braço', 3, 8, 15, 60),
          e('Remada unilateral com halter', 3, 10, 12, 60),
          e('Elevação pélvica (hip thrust)', 3, 12, 15, 75),
          e('Abdominal bicicleta', 3, 15, 20, 45),
        ],
      },
    ],
  },
];

export const getTemplate = (slug: string) => TEMPLATES.find((t) => t.slug === slug);
