/**
 * Coração da tela de treino: mantém a sessão em andamento, grava tudo no
 * IndexedDB (o treino sobrevive a fechar o app) e replica as mudanças no
 * servidor quando há internet.
 *
 * A interface responde sempre ao estado local — nenhuma interação espera a
 * rede, o que é essencial no meio de uma série.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiDelete, apiGet, apiPatch, apiPost, ErroApi } from './api';
import {
  apagarRascunho,
  enfileirarTreino,
  idLocal,
  lerRascunho,
  salvarRascunho,
  sincronizarPendentes,
  type ExercicioSessao,
  type SerieSessao,
  type SessaoTreino,
  type TreinoParaSincronizar,
} from './offline';
import { detectarRecordes, valorDoRecorde, volumeTotal } from './calculos';
import type { MelhoresMarcasPorExercicio } from './tipos-offline';
import type { Exercicio, RecordeDoExercicio, ResumoTreino, TipoSerie, Treino } from './tipos';

const ehLocal = (id: string) => id.startsWith('local-');

/** Converte o treino vindo da API para o formato da sessão local. */
function converterTreino(treino: Treino, melhores: MelhoresMarcasPorExercicio): SessaoTreino {
  return {
    id: treino.id,
    clientId: treino.clientId ?? idLocal('cli'),
    local: false,
    routineDayId: treino.routineDayId,
    name: treino.name,
    startedAt: treino.startedAt,
    notes: treino.notes ?? '',
    rpe: treino.rpe,
    melhores,
    exercicios: treino.exercises.map((we) => ({
      id: we.id,
      exerciseId: we.exerciseId,
      exercise: we.exercise,
      notes: we.notes ?? '',
      restSec: we.restSec,
      technique: we.technique,
      groupKey: we.groupKey,
      series: we.sets.map((s) => ({
        id: s.id,
        order: s.order,
        weight: s.weight,
        reps: s.reps,
        rpe: s.rpe,
        type: s.type,
        completed: s.completed,
        prTypes: s.prTypes ?? [],
      })),
    })),
  };
}

/** Melhores marcas do usuário por exercício (base para detectar PR offline). */
async function carregarMelhores(): Promise<MelhoresMarcasPorExercicio> {
  try {
    const quadro = await apiGet<RecordeDoExercicio[]>('/progresso/recordes');
    const mapa: MelhoresMarcasPorExercicio = {};
    for (const item of quadro) {
      mapa[item.exercise.id] = {
        carga: item.recordes.carga?.value,
        reps: item.recordes.reps?.value,
        volume: item.recordes.volume?.value,
        '1rm': item.recordes['1rm']?.value,
      };
    }
    return mapa;
  } catch {
    return {};
  }
}

/**
 * Recalcula os PRs de todas as séries concluídas, em ordem cronológica.
 * Rodar sempre que algo muda mantém o indicador de recorde correto mesmo
 * quando o usuário edita ou desmarca uma série.
 */
function recalcularPrs(sessao: SessaoTreino): SessaoTreino {
  const marcas: MelhoresMarcasPorExercicio = {};

  const exercicios = sessao.exercicios.map((ex) => {
    const base = marcas[ex.exerciseId] ?? { ...(sessao.melhores[ex.exerciseId] ?? {}) };
    const series = [...ex.series]
      .sort((a, b) => a.order - b.order)
      .map((serie) => {
        const prs = detectarRecordes(serie, base);
        for (const tipo of prs) base[tipo] = valorDoRecorde(tipo, serie);
        return { ...serie, prTypes: prs };
      });
    marcas[ex.exerciseId] = base;
    return { ...ex, series };
  });

  return { ...sessao, exercicios };
}

/** Payload usado tanto na fila offline quanto no resumo local. */
function montarPayload(sessao: SessaoTreino, finishedAt: Date): TreinoParaSincronizar {
  return {
    clientId: sessao.clientId,
    routineDayId: sessao.routineDayId,
    name: sessao.name,
    startedAt: sessao.startedAt,
    finishedAt: finishedAt.toISOString(),
    notes: sessao.notes || null,
    rpe: sessao.rpe,
    exercises: sessao.exercicios
      .map((ex, ordem) => ({
        exerciseId: ex.exerciseId,
        order: ordem,
        notes: ex.notes || null,
        sets: ex.series
          .filter((s) => s.completed)
          .map((s, i) => ({
            order: i,
            weight: s.weight,
            reps: s.reps,
            rpe: s.rpe,
            type: s.type,
            completed: true,
          })),
      }))
      .filter((ex) => ex.sets.length > 0),
  };
}

/** Resumo calculado no aparelho — usado quando o treino é finalizado offline. */
function resumoLocal(sessao: SessaoTreino, finishedAt: Date): ResumoTreino {
  const series = sessao.exercicios.flatMap((e) => e.series.filter((s) => s.completed));
  const gruposMusculares: Record<string, number> = {};
  for (const ex of sessao.exercicios) {
    const validas = ex.series.filter((s) => s.completed && s.type !== 'aquecimento').length;
    if (validas) gruposMusculares[ex.exercise.muscleGroup] = (gruposMusculares[ex.exercise.muscleGroup] ?? 0) + validas;
  }

  const recordes = sessao.exercicios.flatMap((ex) =>
    ex.series
      .filter((s) => s.completed && s.prTypes.length > 0)
      .flatMap((s) =>
        s.prTypes.map((tipo) => ({
          type: tipo,
          value: valorDoRecorde(tipo, s),
          weight: s.weight,
          reps: s.reps,
          exercise: { id: ex.exerciseId, name: ex.exercise.name },
        })),
      ),
  );

  return {
    treino: {
      id: sessao.id,
      name: sessao.name,
      routineDayId: sessao.routineDayId,
      clientId: sessao.clientId,
      startedAt: sessao.startedAt,
      finishedAt: finishedAt.toISOString(),
      durationSec: Math.round((finishedAt.getTime() - new Date(sessao.startedAt).getTime()) / 1000),
      notes: sessao.notes || null,
      rpe: sessao.rpe,
      status: 'concluido',
      totalVolume: volumeTotal(series),
      totalSets: series.length,
      totalReps: series.filter((s) => s.type !== 'aquecimento').reduce((t, s) => t + s.reps, 0),
      exercises: [],
    },
    duracaoSeg: Math.round((finishedAt.getTime() - new Date(sessao.startedAt).getTime()) / 1000),
    volumeTotal: volumeTotal(series),
    seriesConcluidas: series.length,
    repeticoesTotais: series.filter((s) => s.type !== 'aquecimento').reduce((t, s) => t + s.reps, 0),
    exerciciosRealizados: sessao.exercicios.filter((e) => e.series.some((s) => s.completed)).length,
    gruposMusculares,
    recordes,
  };
}

interface Opcoes {
  /** Usuário dono do treino — separa os rascunhos no treino em dupla */
  userId: string;
  /** Id do treino já existente (retomar) */
  treinoId?: string;
  /** Dia da rotina para iniciar um treino novo */
  diaId?: string | null;
}

export function useSessaoTreino({ userId, treinoId, diaId }: Opcoes) {
  const [sessao, definirSessao] = useState<SessaoTreino | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const sessaoRef = useRef<SessaoTreino | null>(null);
  /** Marca que alguma alteração não chegou ao servidor: o treino inteiro será reenviado no fim. */
  const precisaSincronizar = useRef(false);

  /** Atualiza estado + IndexedDB de uma vez só. */
  const aplicar = useCallback((mutador: (atual: SessaoTreino) => SessaoTreino) => {
    definirSessao((atual) => {
      if (!atual) return atual;
      const nova = recalcularPrs(mutador(atual));
      sessaoRef.current = nova;
      void salvarRascunho(userId, nova);
      return nova;
    });
  }, [userId]);

  /** Chama a API sem travar a interface; falha de rede vira "sincronizar depois". */
  const noServidor = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn();
    } catch (falha) {
      if (falha instanceof ErroApi && (falha.offline || falha.status >= 500)) {
        precisaSincronizar.current = true;
        return null;
      }
      precisaSincronizar.current = true;
      return null;
    }
  }, []);

  // Carrega (ou cria) a sessão de treino
  useEffect(() => {
    let ativo = true;

    (async () => {
      setCarregando(true);
      try {
        const [rascunho, melhores] = await Promise.all([lerRascunho(userId), carregarMelhores()]);

        // 1) Rascunho local tem prioridade — é o estado mais recente do aparelho
        if (rascunho && (!treinoId || rascunho.id === treinoId) && (!diaId || rascunho.routineDayId === diaId)) {
          const atualizada = { ...rascunho, melhores: { ...melhores, ...rascunho.melhores } };
          if (!ativo) return;
          sessaoRef.current = atualizada;
          definirSessao(recalcularPrs(atualizada));
          return;
        }

        // 2) Rascunho no servidor (ex.: começou em outro aparelho)
        const existente = await apiGet<Treino | null>('/treinos/em-andamento').catch(() => null);
        if (existente && (!diaId || existente.routineDayId === diaId)) {
          const convertida = converterTreino(existente, melhores);
          if (!ativo) return;
          sessaoRef.current = convertida;
          definirSessao(recalcularPrs(convertida));
          await salvarRascunho(userId, convertida);
          return;
        }

        // 3) Começa um treino novo
        const clientId = idLocal('cli');
        const criado = await apiPost<Treino>('/treinos/iniciar', {
          routineDayId: diaId ?? null,
          clientId,
        }).catch((falha) => {
          if (falha instanceof ErroApi && falha.offline) return null;
          throw falha;
        });

        if (criado) {
          const convertida = converterTreino({ ...criado, clientId }, melhores);
          if (!ativo) return;
          sessaoRef.current = convertida;
          definirSessao(recalcularPrs(convertida));
          await salvarRascunho(userId, convertida);
          return;
        }

        // 3b) Offline: monta o treino a partir da rotina em cache (ou treino livre)
        precisaSincronizar.current = true;
        const nova = await montarSessaoOffline(diaId ?? null, clientId, melhores);
        if (!ativo) return;
        sessaoRef.current = nova;
        definirSessao(nova);
        await salvarRascunho(userId, nova);
      } catch (falha) {
        if (ativo) setErro(falha instanceof ErroApi ? falha.message : 'Não foi possível iniciar o treino');
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [userId, treinoId, diaId]);

  /* ----------------------------------------------------------------- Ações */

  const atualizarSerie = useCallback(
    (exercicioId: string, serieId: string, dados: Partial<SerieSessao>) => {
      aplicar((atual) => ({
        ...atual,
        exercicios: atual.exercicios.map((ex) =>
          ex.id !== exercicioId
            ? ex
            : { ...ex, series: ex.series.map((s) => (s.id === serieId ? { ...s, ...dados } : s)) },
        ),
      }));

      const serie = sessaoRef.current?.exercicios
        .find((e) => e.id === exercicioId)
        ?.series.find((s) => s.id === serieId);

      if (serie && !ehLocal(serieId)) {
        void noServidor(() =>
          apiPatch(`/treinos/series/${serieId}`, {
            weight: dados.weight ?? serie.weight,
            reps: dados.reps ?? serie.reps,
            rpe: dados.rpe ?? serie.rpe,
            type: dados.type ?? serie.type,
            completed: dados.completed ?? serie.completed,
          }),
        );
      } else if (serie) {
        precisaSincronizar.current = true;
      }
    },
    [aplicar, noServidor],
  );

  /** Marca/desmarca a série. Devolve os recordes batidos (para o feedback na tela). */
  const alternarConclusao = useCallback(
    (exercicioId: string, serieId: string) => {
      const antes = sessaoRef.current?.exercicios
        .find((e) => e.id === exercicioId)
        ?.series.find((s) => s.id === serieId);
      if (!antes) return [];

      const concluindo = !antes.completed;
      atualizarSerie(exercicioId, serieId, { completed: concluindo });

      if (!concluindo) return [];

      // Os PRs já foram recalculados por `aplicar`
      const depois = sessaoRef.current?.exercicios
        .find((e) => e.id === exercicioId)
        ?.series.find((s) => s.id === serieId);
      return depois?.prTypes ?? [];
    },
    [atualizarSerie],
  );

  const adicionarSerie = useCallback(
    (exercicioId: string, tipo: TipoSerie = 'normal') => {
      const ex = sessaoRef.current?.exercicios.find((e) => e.id === exercicioId);
      if (!ex) return;
      const ultima = ex.series[ex.series.length - 1];
      const provisoria: SerieSessao = {
        id: idLocal('serie'),
        order: (ultima?.order ?? -1) + 1,
        weight: ultima?.weight ?? 0,
        reps: ultima?.reps ?? 0,
        rpe: null,
        type: tipo,
        completed: false,
        prTypes: [],
      };

      aplicar((atual) => ({
        ...atual,
        exercicios: atual.exercicios.map((e) =>
          e.id === exercicioId ? { ...e, series: [...e.series, provisoria] } : e,
        ),
      }));

      if (!ehLocal(exercicioId)) {
        void noServidor(async () => {
          const criada = await apiPost<SerieSessao & { id: string }>(`/treinos/exercicios/${exercicioId}/series`, {
            weight: provisoria.weight,
            reps: provisoria.reps,
            type: tipo,
          });
          // Troca o id provisório pelo id do servidor
          aplicar((atual) => ({
            ...atual,
            exercicios: atual.exercicios.map((e) =>
              e.id !== exercicioId
                ? e
                : { ...e, series: e.series.map((s) => (s.id === provisoria.id ? { ...s, id: criada.id } : s)) },
            ),
          }));
          return criada;
        });
      }
    },
    [aplicar, noServidor],
  );

  const removerSerie = useCallback(
    (exercicioId: string, serieId: string) => {
      aplicar((atual) => ({
        ...atual,
        exercicios: atual.exercicios.map((e) =>
          e.id !== exercicioId ? e : { ...e, series: e.series.filter((s) => s.id !== serieId) },
        ),
      }));
      if (!ehLocal(serieId)) void noServidor(() => apiDelete(`/treinos/series/${serieId}`));
    },
    [aplicar, noServidor],
  );

  const adicionarExercicio = useCallback(
    (exercicio: Exercicio, quantidadeSeries = 3) => {
      const provisorio: ExercicioSessao = {
        id: idLocal('ex'),
        exerciseId: exercicio.id,
        exercise: exercicio,
        notes: '',
        restSec: null,
        technique: 'normal',
        groupKey: null,
        series: Array.from({ length: quantidadeSeries }, (_, i) => ({
          id: idLocal('serie'),
          order: i,
          weight: 0,
          reps: 0,
          rpe: null,
          type: 'normal' as TipoSerie,
          completed: false,
          prTypes: [],
        })),
      };

      aplicar((atual) => ({ ...atual, exercicios: [...atual.exercicios, provisorio] }));

      const treino = sessaoRef.current;
      if (treino && !treino.local && !ehLocal(treino.id)) {
        void noServidor(async () => {
          const criado = await apiPost<{ id: string; sets: Array<{ id: string; weight: number; reps: number }> }>(
            `/treinos/${treino.id}/exercicios`,
            { exerciseId: exercicio.id, sets: quantidadeSeries },
          );
          aplicar((atual) => ({
            ...atual,
            exercicios: atual.exercicios.map((e) =>
              e.id !== provisorio.id
                ? e
                : {
                    ...e,
                    id: criado.id,
                    series: e.series.map((s, i) =>
                      criado.sets[i]
                        ? { ...s, id: criado.sets[i].id, weight: criado.sets[i].weight, reps: criado.sets[i].reps }
                        : s,
                    ),
                  },
            ),
          }));
          return criado;
        });
      }
    },
    [aplicar, noServidor],
  );

  const removerExercicio = useCallback(
    (exercicioId: string) => {
      aplicar((atual) => ({ ...atual, exercicios: atual.exercicios.filter((e) => e.id !== exercicioId) }));
      if (!ehLocal(exercicioId)) void noServidor(() => apiDelete(`/treinos/exercicios/${exercicioId}`));
    },
    [aplicar, noServidor],
  );

  const definirNotasExercicio = useCallback(
    (exercicioId: string, notas: string) => {
      aplicar((atual) => ({
        ...atual,
        exercicios: atual.exercicios.map((e) => (e.id === exercicioId ? { ...e, notes: notas } : e)),
      }));
      if (!ehLocal(exercicioId)) void noServidor(() => apiPatch(`/treinos/exercicios/${exercicioId}`, { notes: notas }));
    },
    [aplicar, noServidor],
  );

  const definirDadosDoTreino = useCallback(
    (dados: { notes?: string; rpe?: number | null; name?: string }) => {
      aplicar((atual) => ({
        ...atual,
        notes: dados.notes ?? atual.notes,
        rpe: dados.rpe !== undefined ? dados.rpe : atual.rpe,
        name: dados.name ?? atual.name,
      }));
    },
    [aplicar],
  );

  /** Finaliza: usa o servidor quando possível, senão enfileira para sincronizar. */
  const finalizar = useCallback(async (): Promise<{ resumo: ResumoTreino; offline: boolean }> => {
    const atual = sessaoRef.current;
    if (!atual) throw new Error('Nenhum treino em andamento');

    const fim = new Date();
    const podeUsarServidor = !atual.local && !ehLocal(atual.id) && !precisaSincronizar.current && navigator.onLine;

    if (podeUsarServidor) {
      try {
        const resumo = await apiPost<ResumoTreino>(`/treinos/${atual.id}/finalizar`, {
          notes: atual.notes || null,
          rpe: atual.rpe,
        });
        await apagarRascunho(userId);
        return { resumo, offline: false };
      } catch (falha) {
        if (!(falha instanceof ErroApi && (falha.offline || falha.status >= 500))) throw falha;
      }
    }

    await enfileirarTreino(userId, montarPayload(atual, fim));
    const { enviados } = await sincronizarPendentes(userId);
    await apagarRascunho(userId);
    return { resumo: resumoLocal(atual, fim), offline: enviados === 0 };
  }, [userId]);

  const descartar = useCallback(async () => {
    const atual = sessaoRef.current;
    await apagarRascunho(userId);
    if (atual && !atual.local && !ehLocal(atual.id)) {
      await apiPost(`/treinos/${atual.id}/descartar`).catch(() => undefined);
    }
    sessaoRef.current = null;
    definirSessao(null);
  }, [userId]);

  return {
    sessao,
    carregando,
    erro,
    atualizarSerie,
    alternarConclusao,
    adicionarSerie,
    removerSerie,
    adicionarExercicio,
    removerExercicio,
    definirNotasExercicio,
    definirDadosDoTreino,
    finalizar,
    descartar,
  };
}

/** Sem internet: monta o treino a partir da rotina em cache do navegador. */
async function montarSessaoOffline(
  diaId: string | null,
  clientId: string,
  melhores: MelhoresMarcasPorExercicio,
): Promise<SessaoTreino> {
  let nome = 'Treino livre';
  let exercicios: ExercicioSessao[] = [];

  if (diaId) {
    const rotina = await apiGet<{ days: Array<{ id: string; name: string; exercises: Array<{ sets: number; repsMin: number; suggestedLoad: number | null; restSec: number; technique: string; notes: string | null; exerciseId: string; exercise: Exercicio }> }> } | null>(
      '/rotinas/ativa',
    ).catch(() => null);

    const dia = rotina?.days.find((d) => d.id === diaId);
    if (dia) {
      nome = dia.name;
      exercicios = dia.exercises.map((item) => ({
        id: idLocal('ex'),
        exerciseId: item.exerciseId,
        exercise: item.exercise,
        notes: item.notes ?? '',
        restSec: item.restSec,
        technique: item.technique,
        groupKey: null,
        series: Array.from({ length: item.sets }, (_, i) => ({
          id: idLocal('serie'),
          order: i,
          weight: item.suggestedLoad ?? 0,
          reps: item.repsMin,
          rpe: null,
          type: 'normal' as TipoSerie,
          completed: false,
          prTypes: [],
        })),
      }));
    }
  }

  return {
    id: idLocal('treino'),
    clientId,
    local: true,
    routineDayId: diaId,
    name: nome,
    startedAt: new Date().toISOString(),
    notes: '',
    rpe: null,
    melhores,
    exercicios,
  };
}
