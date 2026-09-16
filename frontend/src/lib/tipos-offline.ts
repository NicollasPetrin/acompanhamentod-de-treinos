/** Tipos auxiliares usados pela camada offline. */
export type { Exercicio } from './tipos';
import type { TipoPr } from './tipos';

export type MelhoresMarcas = Partial<Record<TipoPr, number>>;
export type MelhoresMarcasPorExercicio = Record<string, MelhoresMarcas>;
