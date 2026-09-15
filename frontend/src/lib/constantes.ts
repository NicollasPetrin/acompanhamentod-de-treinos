/** Rótulos e opções em português usados nos filtros e formulários. */

export const GRUPOS_MUSCULARES: Record<string, string> = {
  peito: 'Peito',
  costas: 'Costas',
  ombros: 'Ombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  antebraco: 'Antebraço',
  quadriceps: 'Quadríceps',
  posterior: 'Posterior de coxa',
  gluteos: 'Glúteos',
  panturrilha: 'Panturrilha',
  abdomen: 'Abdômen',
  corpo_todo: 'Corpo todo',
  cardio: 'Cardio',
};

export const EQUIPAMENTOS: Record<string, string> = {
  barra: 'Barra',
  halter: 'Halter',
  maquina: 'Máquina',
  cabo: 'Cabo/Polia',
  peso_corporal: 'Peso corporal',
  kettlebell: 'Kettlebell',
  elastico: 'Elástico',
  outro: 'Outro',
};

export const TIPOS_EXERCICIO: Record<string, string> = {
  forca: 'Força',
  cardio: 'Cardio',
  alongamento: 'Alongamento',
  mobilidade: 'Mobilidade',
};

export const TECNICAS: Record<string, string> = {
  normal: 'Normal',
  superset: 'Superset',
  biset: 'Bi-set',
  dropset: 'Drop set',
  rest_pause: 'Rest-pause',
  aquecimento: 'Aquecimento',
};

export const TIPOS_SERIE: Record<string, { rotulo: string; sigla: string; cor: string }> = {
  normal: { rotulo: 'Normal', sigla: '', cor: 'text-texto' },
  aquecimento: { rotulo: 'Aquecimento', sigla: 'A', cor: 'text-alerta' },
  drop: { rotulo: 'Drop set', sigla: 'D', cor: 'text-info' },
  rest_pause: { rotulo: 'Rest-pause', sigla: 'RP', cor: 'text-info' },
  falha: { rotulo: 'Até a falha', sigla: 'F', cor: 'text-perigo' },
};

export const TIPOS_PR: Record<string, string> = {
  carga: 'Carga',
  reps: 'Repetições',
  volume: 'Volume',
  '1rm': '1RM',
};

export const OBJETIVOS: Record<string, string> = {
  hipertrofia: 'Hipertrofia',
  emagrecimento: 'Emagrecimento',
  forca: 'Força',
  condicionamento: 'Condicionamento',
};

export const NIVEIS: Record<string, string> = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
};

export const SEXOS: Record<string, string> = {
  masculino: 'Masculino',
  feminino: 'Feminino',
  outro: 'Outro / prefiro não informar',
};

export const DIAS_SEMANA = [
  { valor: 'seg', rotulo: 'Seg' },
  { valor: 'ter', rotulo: 'Ter' },
  { valor: 'qua', rotulo: 'Qua' },
  { valor: 'qui', rotulo: 'Qui' },
  { valor: 'sex', rotulo: 'Sex' },
  { valor: 'sab', rotulo: 'Sáb' },
  { valor: 'dom', rotulo: 'Dom' },
];

export const MEDIDAS_CORPORAIS = [
  { chave: 'braco', rotulo: 'Braço' },
  { chave: 'antebraco', rotulo: 'Antebraço' },
  { chave: 'peito', rotulo: 'Peito' },
  { chave: 'ombros', rotulo: 'Ombros' },
  { chave: 'cintura', rotulo: 'Cintura' },
  { chave: 'quadril', rotulo: 'Quadril' },
  { chave: 'coxa', rotulo: 'Coxa' },
  { chave: 'panturrilha', rotulo: 'Panturrilha' },
  { chave: 'pescoco', rotulo: 'Pescoço' },
];

export const TIPOS_META: Record<string, { rotulo: string; unidade: string; precisaExercicio: boolean }> = {
  carga: { rotulo: 'Carga em um exercício', unidade: 'kg', precisaExercicio: true },
  '1rm': { rotulo: '1RM estimado', unidade: 'kg', precisaExercicio: true },
  reps: { rotulo: 'Repetições em uma série', unidade: 'reps', precisaExercicio: true },
  peso_corporal: { rotulo: 'Peso corporal', unidade: 'kg', precisaExercicio: false },
  frequencia: { rotulo: 'Treinos por semana', unidade: 'treinos', precisaExercicio: false },
  volume: { rotulo: 'Volume semanal', unidade: 'kg', precisaExercicio: false },
};

/** Cores por grupo muscular usadas nos gráficos (contraste conferido nos dois temas). */
export const CORES_GRUPOS: Record<string, string> = {
  peito: '#22c55e',
  costas: '#3b82f6',
  ombros: '#f59e0b',
  biceps: '#a855f7',
  triceps: '#ec4899',
  antebraco: '#14b8a6',
  quadriceps: '#ef4444',
  posterior: '#8b5cf6',
  gluteos: '#f97316',
  panturrilha: '#06b6d4',
  abdomen: '#eab308',
  corpo_todo: '#64748b',
  cardio: '#10b981',
};

export const corDoGrupo = (grupo: string) => CORES_GRUPOS[grupo] ?? '#64748b';
