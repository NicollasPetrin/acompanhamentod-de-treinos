/**
 * Camada offline do PWA.
 *
 * - O treino em andamento fica salvo no IndexedDB (rascunho) e sobrevive ao
 *   fechamento do app.
 * - Treinos finalizados sem internet entram numa fila e são enviados ao
 *   servidor assim que a conexão volta, pelo endpoint idempotente
 *   POST /api/treinos/sincronizar.
 */
import { get, set, del } from 'idb-keyval';
import { useEffect, useState } from 'react';
import { apiPost } from './api';
import type { Exercicio, MelhoresMarcasPorExercicio } from './tipos-offline';
import type { TipoPr, TipoSerie } from './tipos';

export interface SerieSessao {
  id: string;
  order: number;
  weight: number;
  reps: number;
  rpe: number | null;
  type: TipoSerie;
  completed: boolean;
  prTypes: TipoPr[];
}

export interface ExercicioSessao {
  id: string;
  exerciseId: string;
  exercise: Exercicio;
  notes: string;
  restSec: number | null;
  technique: string;
  groupKey: string | null;
  series: SerieSessao[];
}

export interface SessaoTreino {
  /** Id no servidor, ou `local-*` quando o treino nasceu offline. */
  id: string;
  clientId: string;
  local: boolean;
  routineDayId: string | null;
  name: string;
  startedAt: string;
  notes: string;
  rpe: number | null;
  exercicios: ExercicioSessao[];
  /** Melhores marcas por exercício — permite detectar PR sem internet. */
  melhores: MelhoresMarcasPorExercicio;
}

export interface TreinoParaSincronizar {
  clientId: string;
  routineDayId: string | null;
  name: string;
  startedAt: string;
  finishedAt: string;
  notes: string | null;
  rpe: number | null;
  exercises: Array<{
    exerciseId: string;
    order: number;
    notes: string | null;
    sets: Array<{ order: number; weight: number; reps: number; rpe: number | null; type: TipoSerie; completed: boolean }>;
  }>;
}

const CHAVE_RASCUNHO = 'treinos.rascunho';
const CHAVE_FILA = 'treinos.fila-sincronizacao';

export const lerRascunho = () => get<SessaoTreino>(CHAVE_RASCUNHO);
export const salvarRascunho = (sessao: SessaoTreino) => set(CHAVE_RASCUNHO, sessao);
export const apagarRascunho = () => del(CHAVE_RASCUNHO);

export const lerFila = async () => (await get<TreinoParaSincronizar[]>(CHAVE_FILA)) ?? [];

/** Coloca um treino finalizado na fila de sincronização. */
export async function enfileirarTreino(treino: TreinoParaSincronizar) {
  const fila = await lerFila();
  const semDuplicata = fila.filter((t) => t.clientId !== treino.clientId);
  semDuplicata.push(treino);
  await set(CHAVE_FILA, semDuplicata);
  notificarFila(semDuplicata.length);
}

/**
 * Envia tudo o que está na fila. Como o endpoint é idempotente por clientId,
 * reenviar não duplica nada — então é seguro chamar sempre que a conexão volta.
 */
export async function sincronizarPendentes(): Promise<{ enviados: number; restantes: number }> {
  const fila = await lerFila();
  if (fila.length === 0) return { enviados: 0, restantes: 0 };

  try {
    const resposta = await apiPost<{ resultados: Array<{ clientId: string; status: string }> }>(
      '/treinos/sincronizar',
      { treinos: fila },
    );
    const sincronizados = new Set(resposta.resultados.map((r) => r.clientId));
    const restantes = fila.filter((t) => !sincronizados.has(t.clientId));
    await set(CHAVE_FILA, restantes);
    notificarFila(restantes.length);
    return { enviados: sincronizados.size, restantes: restantes.length };
  } catch {
    // Continua offline: tentamos de novo na próxima reconexão
    return { enviados: 0, restantes: fila.length };
  }
}

type OuvinteFila = (quantidade: number) => void;
const ouvintesFila = new Set<OuvinteFila>();
const notificarFila = (quantidade: number) => ouvintesFila.forEach((fn) => fn(quantidade));

/** Estado da conexão + quantidade de treinos aguardando sincronização. */
export function useStatusOffline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [pendentes, setPendentes] = useState(0);

  useEffect(() => {
    void lerFila().then((fila) => setPendentes(fila.length));

    const aoConectar = () => {
      setOnline(true);
      void sincronizarPendentes();
    };
    const aoDesconectar = () => setOnline(false);

    ouvintesFila.add(setPendentes);
    window.addEventListener('online', aoConectar);
    window.addEventListener('offline', aoDesconectar);

    return () => {
      ouvintesFila.delete(setPendentes);
      window.removeEventListener('online', aoConectar);
      window.removeEventListener('offline', aoDesconectar);
    };
  }, []);

  return { online, pendentes };
}

export const idLocal = (prefixo = 'local') =>
  `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
