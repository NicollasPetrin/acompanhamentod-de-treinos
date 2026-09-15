/**
 * Mesmas regras de cálculo do backend, replicadas no cliente para que o app
 * funcione offline (mostrar volume, 1RM e PR sem precisar do servidor).
 */
import type { Serie, TipoPr } from './tipos';

export const arredondar = (valor: number, casas = 2) => {
  const f = 10 ** casas;
  return Math.round((valor + Number.EPSILON) * f) / f;
};

export function estimar1RM(peso: number, reps: number, formula: 'epley' | 'brzycki' = 'epley'): number {
  if (!Number.isFinite(peso) || !Number.isFinite(reps) || peso <= 0 || reps <= 0) return 0;
  if (reps === 1) return arredondar(peso);
  if (formula === 'brzycki') {
    if (reps >= 37) return 0;
    return arredondar((peso * 36) / (37 - reps));
  }
  return arredondar(peso * (1 + reps / 30));
}

type SerieParcial = Pick<Serie, 'weight' | 'reps'> & Partial<Pick<Serie, 'type' | 'completed'>>;

export const serieConta = (serie: SerieParcial) =>
  serie.completed !== false && serie.type !== 'aquecimento';

export const volumeDaSerie = (serie: SerieParcial) =>
  serieConta(serie) ? arredondar((serie.weight || 0) * (serie.reps || 0)) : 0;

export const volumeTotal = (series: SerieParcial[]) =>
  arredondar(series.reduce((total, s) => total + volumeDaSerie(s), 0));

export interface MelhoresMarcas {
  carga?: number;
  reps?: number;
  volume?: number;
  '1rm'?: number;
}

/** Detecta recordes comparando a série com as melhores marcas conhecidas. */
export function detectarRecordes(serie: SerieParcial, melhores: MelhoresMarcas = {}): TipoPr[] {
  if (serie.completed === false || serie.type === 'aquecimento') return [];
  const peso = serie.weight || 0;
  const reps = serie.reps || 0;
  if (reps <= 0) return [];

  const prs: TipoPr[] = [];
  const volume = arredondar(peso * reps);
  const umRm = estimar1RM(peso, reps);

  if (peso > 0 && (melhores.carga === undefined || peso > melhores.carga)) prs.push('carga');
  if (melhores.reps === undefined || reps > melhores.reps) prs.push('reps');
  if (volume > 0 && (melhores.volume === undefined || volume > melhores.volume)) prs.push('volume');
  if (umRm > 0 && (melhores['1rm'] === undefined || umRm > melhores['1rm'])) prs.push('1rm');
  return prs;
}

export function valorDoRecorde(tipo: TipoPr, serie: SerieParcial): number {
  const peso = serie.weight || 0;
  const reps = serie.reps || 0;
  if (tipo === 'carga') return arredondar(peso);
  if (tipo === 'reps') return reps;
  if (tipo === 'volume') return arredondar(peso * reps);
  return estimar1RM(peso, reps);
}

export const ANILHAS_PADRAO = [25, 20, 15, 10, 5, 2.5, 1.25];

export function calcularAnilhas(pesoAlvo: number, pesoBarra = 20, anilhas: number[] = ANILHAS_PADRAO) {
  const porLado: { anilha: number; quantidade: number }[] = [];
  if (pesoAlvo < pesoBarra) {
    return { possivel: false, porLado, pesoAlcancado: pesoBarra, diferenca: arredondar(pesoBarra - pesoAlvo) };
  }

  let restante = arredondar((pesoAlvo - pesoBarra) / 2, 3);
  for (const anilha of [...anilhas].sort((a, b) => b - a)) {
    const quantidade = Math.floor(restante / anilha + 1e-9);
    if (quantidade > 0) {
      porLado.push({ anilha, quantidade });
      restante = arredondar(restante - quantidade * anilha, 3);
    }
  }

  const pesoAlcancado = arredondar(pesoBarra + porLado.reduce((t, p) => t + p.anilha * p.quantidade, 0) * 2);
  return {
    possivel: Math.abs(pesoAlcancado - pesoAlvo) < 0.001,
    porLado,
    pesoAlcancado,
    diferenca: arredondar(pesoAlvo - pesoAlcancado),
  };
}

export const KG_POR_LB = 0.45359237;
export const kgParaLb = (kg: number) => kg / KG_POR_LB;
export const lbParaKg = (lb: number) => lb * KG_POR_LB;
