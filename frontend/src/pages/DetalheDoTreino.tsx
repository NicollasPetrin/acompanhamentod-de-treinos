import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Timer, Trash2, TrendingUp, Trophy } from 'lucide-react';
import { apiDelete, apiGet, apiPatch } from '../lib/api';
import { useUnidade } from '../lib/auth';
import { formatarData, formatarDuracao, formatarHora, formatarPeso, formatarVolume, plural } from '../lib/formato';
import { TIPOS_SERIE, corDoGrupo } from '../lib/constantes';
import type { Treino } from '../lib/tipos';
import { AreaTexto, Botao, Campo, Cartao, Carregando, ConfirmarAcao, Distintivo, Modal } from '../components/ui';
import { useAvisos } from '../components/Notificacoes';

export default function DetalheDoTreino() {
  const { id } = useParams();
  const navegar = useNavigate();
  const unidade = useUnidade();
  const queryClient = useQueryClient();
  const { sucesso } = useAvisos();

  const [editando, setEditando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [rascunho, setRascunho] = useState({ name: '', notes: '' });

  const { data: treino, isLoading } = useQuery({
    queryKey: ['treino', id],
    queryFn: () => apiGet<Treino>(`/treinos/${id}`),
  });

  const salvar = useMutation({
    mutationFn: () => apiPatch<Treino>(`/treinos/${id}`, { name: rascunho.name, notes: rascunho.notes || null }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['treino', id] });
      await queryClient.invalidateQueries({ queryKey: ['historico'] });
      setEditando(false);
      sucesso('Treino atualizado');
    },
  });

  const excluir = useMutation({
    mutationFn: () => apiDelete(`/treinos/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      sucesso('Treino excluído');
      navegar('/app/historico', { replace: true });
    },
  });

  if (isLoading) return <Carregando />;
  if (!treino) return null;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start gap-2">
        <button
          onClick={() => navegar(-1)}
          className="rounded-lg p-2 text-texto-suave hover:bg-superficie-2 hover:text-texto"
          aria-label="Voltar"
        >
          <ArrowLeft size={22} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold">{treino.name}</h1>
          <p className="text-sm text-texto-suave">
            {formatarData(treino.startedAt)} às {formatarHora(treino.startedAt)}
          </p>
        </div>
        <button
          onClick={() => {
            setRascunho({ name: treino.name, notes: treino.notes ?? '' });
            setEditando(true);
          }}
          className="rounded-lg p-2 text-texto-suave hover:bg-superficie-2 hover:text-texto"
          aria-label="Editar treino"
        >
          <Pencil size={20} />
        </button>
        <button
          onClick={() => setExcluindo(true)}
          className="rounded-lg p-2 text-texto-suave hover:bg-perigo/10 hover:text-perigo"
          aria-label="Excluir treino"
        >
          <Trash2 size={20} />
        </button>
      </header>

      <section className="grid grid-cols-3 gap-2 text-center">
        <Cartao className="p-3">
          <Timer size={16} className="mx-auto text-texto-suave" aria-hidden />
          <p className="mt-1 text-lg font-bold">{formatarDuracao(treino.durationSec ?? 0)}</p>
          <p className="text-xs text-texto-suave">duração</p>
        </Cartao>
        <Cartao className="p-3">
          <TrendingUp size={16} className="mx-auto text-texto-suave" aria-hidden />
          <p className="mt-1 text-lg font-bold">{formatarVolume(treino.totalVolume, unidade)}</p>
          <p className="text-xs text-texto-suave">volume</p>
        </Cartao>
        <Cartao className="p-3">
          <p className="mt-1 text-lg font-bold">{treino.totalSets}</p>
          <p className="text-xs text-texto-suave">séries</p>
        </Cartao>
      </section>

      {treino.notes && (
        <Cartao className="text-sm text-texto-suave">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide">Anotações</p>
          {treino.notes}
        </Cartao>
      )}

      <section className="flex flex-col gap-3">
        {treino.exercises.map((item) => (
          <Cartao key={item.id} className="p-0 overflow-hidden">
            <div className="flex items-start gap-3 p-3.5">
              <span
                className="mt-1 h-8 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: corDoGrupo(item.exercise.muscleGroup) }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-semibold">{item.exercise.name}</h2>
                <p className="text-sm text-texto-suave">{plural(item.sets.length, 'série')}</p>
                {item.notes && <p className="mt-1 text-sm text-texto-suave">{item.notes}</p>}
              </div>
            </div>

            <table className="w-full border-t border-borda text-sm">
              <caption className="sr-only">Séries de {item.exercise.name}</caption>
              <thead>
                <tr className="text-xs uppercase tracking-wide text-texto-suave">
                  <th scope="col" className="px-3.5 py-2 text-left font-medium">Série</th>
                  <th scope="col" className="py-2 text-left font-medium">Peso</th>
                  <th scope="col" className="py-2 text-left font-medium">Reps</th>
                  <th scope="col" className="px-3.5 py-2 text-right font-medium">RPE</th>
                </tr>
              </thead>
              <tbody>
                {item.sets.map((serie, i) => (
                  <tr key={serie.id} className="border-t border-borda/60">
                    <td className="px-3.5 py-2">
                      <span className="tabular-nums">{i + 1}</span>
                      {TIPOS_SERIE[serie.type]?.sigla && (
                        <span className={`ml-1 text-[10px] font-bold ${TIPOS_SERIE[serie.type].cor}`}>
                          {TIPOS_SERIE[serie.type].sigla}
                        </span>
                      )}
                      {serie.isPr && <Trophy size={12} className="ml-1 inline text-alerta" aria-label="Recorde" />}
                    </td>
                    <td className="py-2 tabular-nums">{formatarPeso(serie.weight, unidade)}</td>
                    <td className="py-2 tabular-nums">{serie.reps}</td>
                    <td className="px-3.5 py-2 text-right tabular-nums text-texto-suave">{serie.rpe ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Cartao>
        ))}
      </section>

      {treino.rpe && (
        <Distintivo cor="info" className="self-start">
          Esforço do treino: {treino.rpe}/10
        </Distintivo>
      )}

      <Modal
        aberto={editando}
        aoFechar={() => setEditando(false)}
        titulo="Editar treino"
        rodape={
          <div className="flex gap-2">
            <Botao variante="secundario" larguraTotal onClick={() => setEditando(false)}>
              Cancelar
            </Botao>
            <Botao larguraTotal carregando={salvar.isPending} onClick={() => salvar.mutate()}>
              Salvar
            </Botao>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Campo
            rotulo="Nome do treino"
            value={rascunho.name}
            onChange={(e) => setRascunho((r) => ({ ...r, name: e.target.value }))}
          />
          <AreaTexto
            rotulo="Anotações"
            value={rascunho.notes}
            onChange={(e) => setRascunho((r) => ({ ...r, notes: e.target.value }))}
          />
        </div>
      </Modal>

      <ConfirmarAcao
        aberto={excluindo}
        titulo="Excluir treino?"
        mensagem="O treino sai do histórico e os recordes são recalculados. Não dá para desfazer."
        textoConfirmar="Excluir"
        perigoso
        carregando={excluir.isPending}
        aoCancelar={() => setExcluindo(false)}
        aoConfirmar={() => excluir.mutate()}
      />
    </div>
  );
}
