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

// As chaves levam o id do usuário: no "treino em dupla" duas pessoas usam o
// mesmo aparelho e cada uma tem seu próprio rascunho e sua própria fila.
const chaveRascunho = (userId: string) => `treinos.rascunho:${userId}`;
const chaveFila = (userId: string) => `treinos.fila:${userId}`;

export const lerRascunho = (userId: string) => get<SessaoTreino>(chaveRascunho(userId));
export const salvarRascunho = (userId: string, sessao: SessaoTreino) => set(chaveRascunho(userId), sessao);
export const apagarRascunho = (userId: string) => del(chaveRascunho(userId));

export const lerFila = async (userId: string) =>
  (await get<TreinoParaSincronizar[]>(chaveFila(userId))) ?? [];

/** Coloca um treino finalizado na fila de sincronização. */
export async function enfileirarTreino(userId: string, treino: TreinoParaSincronizar) {
  const fila = await lerFila(userId);
  const semDuplicata = fila.filter((t) => t.clientId !== treino.clientId);
  semDuplicata.push(treino);
  await set(chaveFila(userId), semDuplicata);
  notificarFila(semDuplicata.length);
}

/**
 * Envia tudo o que está na fila. Como o endpoint é idempotente por clientId,
 * reenviar não duplica nada — então é seguro chamar sempre que a conexão volta.
 */
export async function sincronizarPendentes(userId: string): Promise<{ enviados: number; restantes: number }> {
  const fila = await lerFila(userId);
  if (fila.length === 0) return { enviados: 0, restantes: 0 };

  try {
    const resposta = await apiPost<{ resultados: Array<{ clientId: string; status: string }> }>(
      '/treinos/sincronizar',
      { treinos: fila },
    );
    const sincronizados = new Set(resposta.resultados.map((r) => r.clientId));
    const restantes = fila.filter((t) => !sincronizados.has(t.clientId));
    await set(chaveFila(userId), restantes);
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
export function useStatusOffline(userId: string | undefined) {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [pendentes, setPendentes] = useState(0);

  useEffect(() => {
    if (!userId) return;
    void lerFila(userId).then((fila) => setPendentes(fila.length));

    const aoConectar = () => {
      setOnline(true);
      void sincronizarPendentes(userId);
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
  }, [userId]);

  return { online, pendentes };
}

/**
 * Apaga o cache HTTP das respostas da API (service worker).
 *
 * É chamado ao entrar, sair e trocar de conta: sem isso, no "treino em dupla"
 * uma pessoa poderia ver, offline, os dados que ficaram em cache da outra.
 */
export async function limparCacheDaApi() {
  try {
    if ('caches' in window) await caches.delete('api-treinos');
  } catch {
    /* navegador sem Cache API: nada a limpar */
  }
}

export const idLocal = (prefixo = 'local') =>
  `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
