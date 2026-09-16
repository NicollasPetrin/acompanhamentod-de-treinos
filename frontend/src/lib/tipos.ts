/** Tipos compartilhados com a API (espelham os modelos do Prisma). */

export type Unidade = 'kg' | 'lb';
export type Tema = 'dark' | 'light';

export interface Usuario {
  id: string;
  name: string;
  email: string;
  photoUrl: string | null;
  birthDate: string | null;
  sex: 'masculino' | 'feminino' | 'outro' | null;
  heightCm: number | null;
  weightKg: number | null;
  goal: 'hipertrofia' | 'emagrecimento' | 'forca' | 'condicionamento' | null;
  level: 'iniciante' | 'intermediario' | 'avancado' | null;
  weightUnit: Unidade;
  theme: Tema;
  trainingDays: string[];
  defaultRestSec: number;
  remindersOn: boolean;
  reminderTime: string | null;
  createdAt: string;
}

export interface Sessao {
  usuario: Usuario;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface Exercicio {
  id: string;
  name: string;
  muscleGroup: string;
  secondaryMuscles: string[];
  equipment: string;
  type: 'forca' | 'cardio' | 'alongamento' | 'mobilidade';
  instructions: string;
  imageUrl: string;
  videoUrl: string | null;
  isUnilateral: boolean;
  createdById: string | null;
  favorito?: boolean;
  personalizado?: boolean;
}

export type TipoSerie = 'normal' | 'aquecimento' | 'drop' | 'rest_pause' | 'falha';
export type TipoPr = 'carga' | 'reps' | 'volume' | '1rm';

export interface Serie {
  id: string;
  order: number;
  weight: number;
  reps: number;
  rpe: number | null;
  type: TipoSerie;
  completed: boolean;
  isPr: boolean;
  prTypes: TipoPr[];
  completedAt?: string | null;
}

export interface ExercicioDoTreino {
  id: string;
  order: number;
  notes: string | null;
  restSec: number | null;
  technique: string;
  groupKey: string | null;
  exerciseId: string;
  exercise: Exercicio;
  sets: Serie[];
}

export interface Treino {
  id: string;
  name: string;
  routineDayId: string | null;
  clientId: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationSec: number | null;
  notes: string | null;
  rpe: number | null;
  status: 'em_andamento' | 'concluido';
  totalVolume: number;
  totalSets: number;
  totalReps: number;
  exercises: ExercicioDoTreino[];
}

export interface ExercicioDaRotina {
  id: string;
  order: number;
  sets: number;
  repsMin: number;
  repsMax: number;
  suggestedLoad: number | null;
  restSec: number;
  technique: 'normal' | 'superset' | 'biset' | 'dropset' | 'rest_pause' | 'aquecimento';
  groupKey: string | null;
  notes: string | null;
  exerciseId: string;
  exercise: Exercicio;
}

export interface DiaDaRotina {
  id: string;
  name: string;
  order: number;
  notes: string | null;
  exercises: ExercicioDaRotina[];
}

export interface Rotina {
  id: string;
  name: string;
  description: string | null;
  goal: string | null;
  isActive: boolean;
  archived: boolean;
  shareSlug: string | null;
  createdAt: string;
  updatedAt: string;
  days: DiaDaRotina[];
  autor?: string;
}

export interface Medida {
  id: string;
  date: string;
  weightKg: number | null;
  bodyFatPct: number | null;
  measures: Record<string, number>;
  photos: string[];
  notes: string | null;
}

export interface Meta {
  id: string;
  title: string;
  type: 'carga' | '1rm' | 'reps' | 'peso_corporal' | 'frequencia' | 'volume';
  exerciseId: string | null;
  exercise?: { id: string; name: string } | null;
  targetValue: number;
  startValue: number | null;
  deadline: string | null;
  completed: boolean;
  completedAt: string | null;
  currentValue: number;
  progress: number;
}

export interface Conquista {
  id?: string;
  code: string;
  title: string;
  description: string;
  icon: string;
  achievedAt?: string;
}

export interface ResumoTreino {
  treino: Treino;
  duracaoSeg: number;
  volumeTotal: number;
  seriesConcluidas: number;
  repeticoesTotais: number;
  exerciciosRealizados: number;
  gruposMusculares: Record<string, number>;
  recordes: Array<{
    type: TipoPr;
    value: number;
    weight: number | null;
    reps: number | null;
    exercise: { id: string; name: string };
  }>;
  conquistas?: Conquista[];
}

export interface ResumoHome {
  usuario: { nome: string };
  streak: number;
  totalTreinos: number;
  treinoEmAndamento: { id: string; name: string; startedAt: string } | null;
  semana: { inicio: string; treinos: number; volume: number; series: number; minutos: number };
  rotinaAtiva: { id: string; name: string; dias: Array<{ id: string; name: string; exercicios: number; grupos: string[] }> } | null;
  proximoTreino: { id: string; name: string; exercicios: number } | null;
  ultimosTreinos: Array<{ id: string; name: string; startedAt: string; durationSec: number | null; totalVolume: number; totalSets: number }>;
}

export interface RecordeDoExercicio {
  exercise: { id: string; name: string; muscleGroup: string };
  recordes: Partial<Record<TipoPr, { value: number; weight: number | null; reps: number | null; date: string }>>;
}
