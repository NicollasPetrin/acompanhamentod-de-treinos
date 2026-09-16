/**
 * Regras de cálculo do app (1RM, volume, recordes, conversões e anilhas).
 * Funções puras — cobertas por testes automatizados em `tests/`.
 */

export type PrType = 'carga' | 'reps' | 'volume' | '1rm';
export type SetType = 'normal' | 'aquecimento' | 'drop' | 'rest_pause' | 'falha';

export interface SetLike {
  weight: number;
  reps: number;
  type?: SetType | string;
  completed?: boolean;
}

export const KG_POR_LB = 0.45359237;

export const lbParaKg = (lb: number) => lb * KG_POR_LB;
export const kgParaLb = (kg: number) => kg / KG_POR_LB;

/** Arredonda para N casas evitando ruído de ponto flutuante (0.1+0.2). */
export const arredondar = (valor: number, casas = 2) => {
  const f = 10 ** casas;
  return Math.round((valor + Number.EPSILON) * f) / f;
};

/**
 * 1RM estimado.
 * - Epley (padrão): carga × (1 + reps/30)
 * - Brzycki: carga × 36 / (37 − reps) — indefinida a partir de 37 reps
 * Com 1 repetição, as duas devolvem a própria carga.
 */
export function estimar1RM(weight: number, reps: number, formula: 'epley' | 'brzycki' = 'epley'): number {
  if (!Number.isFinite(weight) || !Number.isFinite(reps)) return 0;
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return arredondar(weight);

  if (formula === 'brzycki') {
    if (reps >= 37) return 0; // fórmula perde o sentido nessa faixa
    return arredondar((weight * 36) / (37 - reps));
  }
  return arredondar(weight * (1 + reps / 30));
}

/** Quantas repetições são esperadas com determinada carga, dado um 1RM (Epley invertida). */
export function repsEstimadas(oneRm: number, weight: number): number {
  if (oneRm <= 0 || weight <= 0 || weight > oneRm) return 0;
  return Math.max(1, Math.round((oneRm / weight - 1) * 30));
}

/** Uma série conta para o volume se foi concluída e não é aquecimento. */
export function serieContaParaVolume(set: SetLike): boolean {
  if (set.completed === false) return false;
  return set.type !== 'aquecimento';
}

/** Volume de uma série: carga × repetições (0 para aquecimento/não concluída). */
export function volumeDaSerie(set: SetLike): number {
  if (!serieContaParaVolume(set)) return 0;
  const w = Number(set.weight) || 0;
  const r = Number(set.reps) || 0;
  if (w <= 0 || r <= 0) return 0;
  return arredondar(w * r);
}

/** Volume total (kg levantados) de uma lista de séries. */
export function volumeTotal(sets: SetLike[]): number {
  return arredondar(sets.reduce((acc, s) => acc + volumeDaSerie(s), 0));
}

export interface ResumoSeries {
  volume: number;
  seriesConcluidas: number;
  repeticoes: number;
  cargaMaxima: number;
}

/** Resumo agregado usado no fim do treino e nas listagens de histórico. */
export function resumirSeries(sets: SetLike[]): ResumoSeries {
  let volume = 0;
  let seriesConcluidas = 0;
  let repeticoes = 0;
  let cargaMaxima = 0;

  for (const s of sets) {
    if (s.completed === false) continue;
    seriesConcluidas++;
    if (s.type === 'aquecimento') continue;
    repeticoes += Number(s.reps) || 0;
    volume += volumeDaSerie(s);
    if ((Number(s.weight) || 0) > cargaMaxima) cargaMaxima = Number(s.weight) || 0;
  }

  return {
    volume: arredondar(volume),
    seriesConcluidas,
    repeticoes,
    cargaMaxima: arredondar(cargaMaxima),
  };
}

export interface MelhoresMarcas {
  carga?: number;
  reps?: number;
  volume?: number;
  '1rm'?: number;
}

/**
 * Detecta quais recordes pessoais uma série bateu, comparando com as melhores
 * marcas anteriores do usuário naquele exercício.
 *
 * Regras:
 * - séries de aquecimento e séries não concluídas nunca geram PR;
 * - o valor precisa ser **estritamente maior** que a marca anterior;
 * - sem marca anterior, a primeira série válida já é recorde.
 */
export function detectarRecordes(set: SetLike, melhores: MelhoresMarcas = {}): PrType[] {
  if (set.completed === false) return [];
  if (set.type === 'aquecimento') return [];

  const weight = Number(set.weight) || 0;
  const reps = Number(set.reps) || 0;
  if (reps <= 0) return [];

  const prs: PrType[] = [];
  const volume = arredondar(weight * reps);
  const umRm = estimar1RM(weight, reps);

  if (weight > 0 && (melhores.carga === undefined || weight > melhores.carga)) prs.push('carga');
  if (melhores.reps === undefined || reps > melhores.reps) prs.push('reps');
  if (volume > 0 && (melhores.volume === undefined || volume > melhores.volume)) prs.push('volume');
  if (umRm > 0 && (melhores['1rm'] === undefined || umRm > melhores['1rm'])) prs.push('1rm');

  return prs;
}

/** Valor do recorde correspondente a cada tipo. */
export function valorDoRecorde(tipo: PrType, set: SetLike): number {
  const weight = Number(set.weight) || 0;
  const reps = Number(set.reps) || 0;
  switch (tipo) {
    case 'carga':
      return arredondar(weight);
    case 'reps':
      return reps;
    case 'volume':
      return arredondar(weight * reps);
    case '1rm':
      return estimar1RM(weight, reps);
  }
}

export const ANILHAS_PADRAO_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

export interface ResultadoAnilhas {
  possivel: boolean;
  porLado: { anilha: number; quantidade: number }[];
  pesoAlcancado: number;
  diferenca: number;
}

/**
 * Calculadora de anilhas: quanto colocar de cada lado da barra.
 * Usa abordagem gulosa (da anilha mais pesada para a mais leve), que é ótima
 * para os conjuntos usuais de academia.
 */
export function calcularAnilhas(
  pesoAlvo: number,
  pesoBarra = 20,
  anilhas: number[] = ANILHAS_PADRAO_KG,
  paresDisponiveis = Infinity,
): ResultadoAnilhas {
  const porLado: { anilha: number; quantidade: number }[] = [];
  if (pesoAlvo < pesoBarra) {
    return { possivel: false, porLado, pesoAlcancado: pesoBarra, diferenca: arredondar(pesoBarra - pesoAlvo) };
  }

  let restantePorLado = arredondar((pesoAlvo - pesoBarra) / 2, 3);
  const ordenadas = [...anilhas].sort((a, b) => b - a);

  for (const anilha of ordenadas) {
    const quantidade = Math.min(Math.floor(restantePorLado / anilha + 1e-9), paresDisponiveis);
    if (quantidade > 0) {
      porLado.push({ anilha, quantidade });
      restantePorLado = arredondar(restantePorLado - quantidade * anilha, 3);
    }
  }

  const pesoAlcancado = arredondar(
    pesoBarra + porLado.reduce((acc, p) => acc + p.anilha * p.quantidade, 0) * 2,
  );

  return {
    possivel: Math.abs(pesoAlcancado - pesoAlvo) < 0.001,
    porLado,
    pesoAlcancado,
    diferenca: arredondar(pesoAlvo - pesoAlcancado),
  };
}

/** Sequência (streak) de dias/semanas — usada no dashboard. */
export function calcularStreakDias(datasTreino: Date[], hoje = new Date()): number {
  if (datasTreino.length === 0) return 0;
  const dias = new Set(datasTreino.map((d) => d.toISOString().slice(0, 10)));
  let streak = 0;
  const cursor = new Date(hoje);
  // Se ainda não treinou hoje, a sequência pode continuar valendo até ontem.
  if (!dias.has(cursor.toISOString().slice(0, 10))) cursor.setDate(cursor.getDate() - 1);
  while (dias.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Progresso de uma meta em % (0 a 100). */
export function progressoMeta(atual: number, alvo: number, inicial = 0): number {
  if (alvo === inicial) return atual >= alvo ? 100 : 0;
  const pct = ((atual - inicial) / (alvo - inicial)) * 100;
  return Math.max(0, Math.min(100, arredondar(pct, 1)));
}
