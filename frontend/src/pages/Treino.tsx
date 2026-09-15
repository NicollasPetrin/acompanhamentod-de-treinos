import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Check, ChevronDown, ChevronUp, Flag, MessageSquarePlus, MoreVertical, Plus, Timer, Trash2, Trophy, Users, X,
} from 'lucide-react';
import clsx from 'clsx';
import { useSessaoTreino } from '../lib/sessaoTreino';
import { useTempoDecorrido } from '../components/CronometroDescanso';
import CronometroDescanso from '../components/CronometroDescanso';
import SeletorDeExercicio from '../components/SeletorDeExercicio';
import { useAuth, useUnidade } from '../lib/auth';
import { formatarDuracao, formatarVolume, paraKg, paraUnidade, plural } from '../lib/formato';
import { volumeTotal } from '../lib/calculos';
import { TIPOS_PR, TIPOS_SERIE, corDoGrupo } from '../lib/constantes';
import type { SerieSessao } from '../lib/offline';
import type { TipoSerie } from '../lib/tipos';
import { AreaTexto, Botao, Cartao, Carregando, ConfirmarAcao, Distintivo, Modal, Selecao, Vazio } from '../components/ui';
import { useAvisos } from '../components/Notificacoes';

export default function Treino() {
  const { id } = useParams();
  const [parametros] = useSearchParams();
  const diaId = parametros.get('dia');
  const navegar = useNavigate();
  const queryClient = useQueryClient();
  const { usuario, contas, trocarPara } = useAuth();
  const unidade = useUnidade();
  const { sucesso, avisar, erro: avisarErro } = useAvisos();

  const {
    sessao, carregando, erro,
    atualizarSerie, alternarConclusao, adicionarSerie, removerSerie,
    adicionarExercicio, removerExercicio, definirNotasExercicio, definirDadosDoTreino,
    finalizar, descartar,
  } = useSessaoTreino({ userId: usuario?.id ?? '', treinoId: id, diaId });

  const [descansoSeg, setDescansoSeg] = useState<number | null>(null);
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [finalizarAberto, setFinalizarAberto] = useState(false);
  const [descartarAberto, setDescartarAberto] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [notaEmEdicao, setNotaEmEdicao] = useState<string | null>(null);
  const [recolhidos, setRecolhidos] = useState<Record<string, boolean>>({});
  const [duplaAberta, setDuplaAberta] = useState(false);

  const decorrido = useTempoDecorrido(sessao?.startedAt ?? new Date().toISOString());

  const totais = useMemo(() => {
    const series = sessao?.exercicios.flatMap((e) => e.series) ?? [];
    const concluidas = series.filter((s) => s.completed);
    return {
      volume: volumeTotal(concluidas),
      concluidas: concluidas.length,
      total: series.length,
    };
  }, [sessao]);

  // Avisa antes de fechar a aba com treino em andamento
  useEffect(() => {
    const aoSair = (e: BeforeUnloadEvent) => {
      if (sessao && totais.concluidas > 0) e.preventDefault();
    };
    window.addEventListener('beforeunload', aoSair);
    return () => window.removeEventListener('beforeunload', aoSair);
  }, [sessao, totais.concluidas]);

  if (carregando) return <Carregando texto="Preparando seu treino…" />;

  if (erro || !sessao) {
    return (
      <Vazio
        titulo="Não foi possível abrir o treino"
        descricao={erro ?? 'Tente novamente pela tela inicial.'}
        acao={<Botao onClick={() => navegar('/app')}>Voltar para o início</Botao>}
      />
    );
  }

  const concluirSerie = (exercicioId: string, serie: SerieSessao, restSec: number | null) => {
    const prs = alternarConclusao(exercicioId, serie.id);

    if (!serie.completed) {
      // Acabou de concluir: dispara o descanso e comemora o recorde
      if (serie.type !== 'aquecimento') {
        setDescansoSeg(restSec ?? usuario?.defaultRestSec ?? 90);
      }
      navigator.vibrate?.(30);
      if (prs.length > 0) {
        sucesso(`🏆 Recorde de ${prs.map((p) => TIPOS_PR[p].toLowerCase()).join(', ')}!`);
      }
    }
  };

  const encerrar = async () => {
    setFinalizando(true);
    try {
      const { resumo, offline } = await finalizar();
      await queryClient.invalidateQueries();
      if (offline) avisar('Treino salvo no aparelho. Enviaremos quando a conexão voltar.');
      navegar(`/app/resumo/${resumo.treino.id}`, { state: { resumo, offline }, replace: true });
    } catch {
      avisarErro('Não foi possível finalizar o treino. Tente novamente.');
    } finally {
      setFinalizando(false);
    }
  };

  return (
    <div className="pb-32">
      {/* Cabeçalho fixo com cronômetro e ação de finalizar */}
      <header className="sticky top-0 z-30 -mx-4 mb-4 border-b border-borda bg-fundo/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDescartarAberto(true)}
            className="rounded-lg p-2 text-texto-suave hover:bg-superficie-2 hover:text-texto"
            aria-label="Descartar treino"
          >
            <X size={22} />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate font-semibold leading-tight">{sessao.name}</h1>
            <p className="flex items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap text-xs tabular-nums text-texto-suave">
              <Timer size={13} aria-hidden />
              {formatarDuracao(decorrido)}
              <span aria-hidden>·</span>
              {totais.concluidas}/{totais.total} séries
              <span aria-hidden>·</span>
              {formatarVolume(totais.volume, unidade)}
            </p>
          </div>

          <button
            onClick={() => setDuplaAberta(true)}
            className="rounded-lg p-2 text-texto-suave hover:bg-superficie-2 hover:text-texto"
            aria-label="Treino em dupla: trocar de conta"
          >
            <Users size={20} />
          </button>

          <Botao tamanho="sm" onClick={() => setFinalizarAberto(true)} icone={<Flag size={16} />}>
            Finalizar
          </Botao>
        </div>
      </header>

      {sessao.exercicios.length === 0 ? (
        <Vazio
          titulo="Treino livre"
          descricao="Adicione o primeiro exercício para começar a registrar suas séries."
          acao={
            <Botao icone={<Plus size={18} />} onClick={() => setSeletorAberto(true)}>
              Adicionar exercício
            </Botao>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {sessao.exercicios.map((exercicio, indice) => {
            const recolhido = recolhidos[exercicio.id];
            const feitas = exercicio.series.filter((s) => s.completed).length;
            const todasFeitas = feitas === exercicio.series.length && feitas > 0;

            return (
              <Cartao key={exercicio.id} className="p-0 overflow-hidden">
                <div className="flex items-start gap-3 p-3.5">
                  <span
                    className="mt-1 h-10 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: corDoGrupo(exercicio.exercise.muscleGroup) }}
                    aria-hidden
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="line-clamp-2 font-semibold leading-tight">{exercicio.exercise.name}</h2>
                      {todasFeitas && <Check size={16} className="shrink-0 text-primaria" aria-label="Exercício concluído" />}
                    </div>
                    <p className="text-sm text-texto-suave">
                      {feitas}/{exercicio.series.length} séries
                      {exercicio.technique !== 'normal' && ` · ${exercicio.technique}`}
                      {exercicio.restSec ? ` · descanso ${formatarDuracao(exercicio.restSec)}` : ''}
                    </p>
                    {exercicio.notes && (
                      <p className="mt-1.5 rounded-lg bg-superficie-2 px-2.5 py-1.5 text-sm text-texto-suave">
                        {exercicio.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => setNotaEmEdicao(exercicio.id)}
                      className="rounded-lg p-2 text-texto-suave hover:bg-superficie-2 hover:text-texto"
                      aria-label={`Anotação em ${exercicio.exercise.name}`}
                    >
                      <MessageSquarePlus size={18} />
                    </button>
                    <button
                      onClick={() => setRecolhidos((r) => ({ ...r, [exercicio.id]: !recolhido }))}
                      className="rounded-lg p-2 text-texto-suave hover:bg-superficie-2 hover:text-texto"
                      aria-label={recolhido ? 'Expandir exercício' : 'Recolher exercício'}
                      aria-expanded={!recolhido}
                    >
                      {recolhido ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                    </button>
                    <MenuDoExercicio
                      aoRemover={() => removerExercicio(exercicio.id)}
                      nome={exercicio.exercise.name}
                      posicao={indice}
                    />
                  </div>
                </div>

                {!recolhido && (
                  <div className="border-t border-borda">
                    <div className="grid grid-cols-[2.5rem_1fr_1fr_3rem] items-center gap-2 px-3.5 py-2 text-xs font-medium uppercase tracking-wide text-texto-suave">
                      <span>Série</span>
                      <span>{unidade === 'kg' ? 'Peso (kg)' : 'Peso (lb)'}</span>
                      <span>Reps</span>
                      <span className="text-center">Feita</span>
                    </div>

                    {exercicio.series.map((serie, i) => (
                      <LinhaDaSerie
                        key={serie.id}
                        serie={serie}
                        numero={i + 1}
                        unidade={unidade}
                        aoMudar={(dados) => atualizarSerie(exercicio.id, serie.id, dados)}
                        aoConcluir={() => concluirSerie(exercicio.id, serie, exercicio.restSec)}
                        aoRemover={() => removerSerie(exercicio.id, serie.id)}
                      />
                    ))}

                    <div className="flex gap-2 p-3">
                      <Botao
                        variante="secundario"
                        tamanho="sm"
                        icone={<Plus size={16} />}
                        onClick={() => adicionarSerie(exercicio.id)}
                      >
                        Série
                      </Botao>
                      <Botao
                        variante="fantasma"
                        tamanho="sm"
                        onClick={() => adicionarSerie(exercicio.id, 'aquecimento')}
                      >
                        + Aquecimento
                      </Botao>
                      <Botao variante="fantasma" tamanho="sm" onClick={() => adicionarSerie(exercicio.id, 'drop')}>
                        + Drop
                      </Botao>
                    </div>
                  </div>
                )}
              </Cartao>
            );
          })}

          <Botao variante="secundario" larguraTotal icone={<Plus size={18} />} onClick={() => setSeletorAberto(true)}>
            Adicionar exercício
          </Botao>
        </div>
      )}

      {descansoSeg !== null && (
        <CronometroDescanso segundos={descansoSeg} aoFechar={() => setDescansoSeg(null)} />
      )}

      <SeletorDeExercicio
        aberto={seletorAberto}
        aoFechar={() => setSeletorAberto(false)}
        aoEscolher={(exercicio) => adicionarExercicio(exercicio)}
        titulo="Adicionar ao treino"
      />

      {/* Anotação por exercício */}
      <Modal
        aberto={notaEmEdicao !== null}
        aoFechar={() => setNotaEmEdicao(null)}
        titulo="Anotação do exercício"
        rodape={
          <Botao larguraTotal onClick={() => setNotaEmEdicao(null)}>
            Salvar
          </Botao>
        }
      >
        <AreaTexto
          autoFocus
          placeholder="Ex.: senti dor no ombro, aumentar carga na próxima…"
          value={sessao.exercicios.find((e) => e.id === notaEmEdicao)?.notes ?? ''}
          onChange={(e) => notaEmEdicao && definirNotasExercicio(notaEmEdicao, e.target.value)}
        />
      </Modal>

      {/* Finalização */}
      <Modal
        aberto={finalizarAberto}
        aoFechar={() => setFinalizarAberto(false)}
        titulo="Finalizar treino"
        rodape={
          <div className="flex gap-2">
            <Botao variante="secundario" larguraTotal onClick={() => setFinalizarAberto(false)}>
              Continuar treinando
            </Botao>
            <Botao larguraTotal carregando={finalizando} onClick={encerrar} icone={<Flag size={18} />}>
              Finalizar
            </Botao>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-superficie-2 p-3">
              <p className="text-xl font-bold">{formatarDuracao(decorrido)}</p>
              <p className="text-xs text-texto-suave">duração</p>
            </div>
            <div className="rounded-xl bg-superficie-2 p-3">
              <p className="text-xl font-bold">{totais.concluidas}</p>
              <p className="text-xs text-texto-suave">séries</p>
            </div>
            <div className="rounded-xl bg-superficie-2 p-3">
              <p className="text-xl font-bold">{formatarVolume(totais.volume, unidade)}</p>
              <p className="text-xs text-texto-suave">volume</p>
            </div>
          </div>

          {totais.concluidas < totais.total && (
            <p className="rounded-xl border border-alerta/40 bg-alerta/10 px-3 py-2 text-sm text-alerta">
              {plural(totais.total - totais.concluidas, 'série não concluída será descartada', 'séries não concluídas serão descartadas')}.
            </p>
          )}

          <Selecao
            rotulo="Esforço percebido do treino (RPE)"
            value={sessao.rpe ?? ''}
            onChange={(e) => definirDadosDoTreino({ rpe: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Não informar</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n} value={n}>
                {n} — {n <= 3 ? 'muito leve' : n <= 5 ? 'leve' : n <= 7 ? 'moderado' : n <= 9 ? 'pesado' : 'máximo'}
              </option>
            ))}
          </Selecao>

          <AreaTexto
            rotulo="Anotações do treino"
            placeholder="Como foi o treino?"
            value={sessao.notes}
            onChange={(e) => definirDadosDoTreino({ notes: e.target.value })}
          />
        </div>
      </Modal>

      {/* Treino em dupla: cada pessoa registra na própria conta, no mesmo aparelho */}
      <Modal aberto={duplaAberta} aoFechar={() => setDuplaAberta(false)} titulo="Treino em dupla">
        <p className="mb-3 text-sm text-texto-suave">
          Treinando acompanhado? Troque de conta sem perder o treino em andamento — cada pessoa registra
          as próprias séries e o rascunho de cada uma fica salvo neste aparelho.
        </p>

        <div className="flex flex-col gap-1.5">
          {contas.map((conta) => (
            <button
              key={conta.id}
              onClick={() => (conta.id === usuario?.id ? setDuplaAberta(false) : trocarPara(conta.id))}
              className={clsx(
                'flex items-center gap-3 rounded-xl border px-3 py-3 text-left',
                conta.id === usuario?.id ? 'border-primaria bg-primaria/10' : 'border-borda hover:bg-superficie-2',
              )}
            >
              <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-superficie-2 font-semibold">
                {conta.photoUrl ? (
                  <img src={conta.photoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  conta.name.charAt(0).toUpperCase()
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{conta.name}</span>
                <span className="block truncate text-sm text-texto-suave">{conta.email}</span>
              </span>
              {conta.id === usuario?.id && <Check size={18} className="text-primaria" aria-label="Conta atual" />}
            </button>
          ))}
        </div>

        <Botao
          variante="secundario"
          larguraTotal
          className="mt-3"
          icone={<Users size={18} />}
          onClick={() => navegar('/entrar?adicionar=1')}
        >
          Entrar com outra conta
        </Botao>
      </Modal>

      <ConfirmarAcao
        aberto={descartarAberto}
        titulo="Descartar treino?"
        mensagem="Tudo que você registrou nesta sessão será perdido. Essa ação não pode ser desfeita."
        textoConfirmar="Descartar"
        perigoso
        aoCancelar={() => setDescartarAberto(false)}
        aoConfirmar={async () => {
          await descartar();
          setDescartarAberto(false);
          navegar('/app', { replace: true });
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

interface LinhaProps {
  serie: SerieSessao;
  numero: number;
  unidade: 'kg' | 'lb';
  aoMudar: (dados: Partial<SerieSessao>) => void;
  aoConcluir: () => void;
  aoRemover: () => void;
}

/** Uma linha da tabela de séries: edição inline e um toque para concluir. */
function LinhaDaSerie({ serie, numero, unidade, aoMudar, aoConcluir, aoRemover }: LinhaProps) {
  const [peso, setPeso] = useState(() => (serie.weight ? String(paraUnidade(serie.weight, unidade)) : ''));
  const [reps, setReps] = useState(() => (serie.reps ? String(serie.reps) : ''));
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    setPeso(serie.weight ? String(Math.round(paraUnidade(serie.weight, unidade) * 100) / 100) : '');
    setReps(serie.reps ? String(serie.reps) : '');
  }, [serie.weight, serie.reps, unidade]);

  const info = TIPOS_SERIE[serie.type] ?? TIPOS_SERIE.normal;

  return (
    <>
      <div
        className={clsx(
          'grid grid-cols-[2.5rem_1fr_1fr_3rem] items-center gap-2 border-t border-borda/60 px-3.5 py-2',
          serie.completed && 'bg-primaria/5',
        )}
      >
        <button
          type="button"
          onClick={() => setMenuAberto(true)}
          className="flex items-center gap-1 text-left"
          aria-label={`Opções da série ${numero}`}
        >
          <span className={clsx('text-sm font-semibold tabular-nums', serie.completed && 'text-primaria')}>
            {numero}
          </span>
          {info.sigla && <span className={clsx('text-[10px] font-bold', info.cor)}>{info.sigla}</span>}
          {serie.prTypes.length > 0 && <Trophy size={12} className="text-alerta" aria-label="Recorde pessoal" />}
        </button>

        <input
          type="number"
          inputMode="decimal"
          step="0.5"
          min="0"
          value={peso}
          onChange={(e) => setPeso(e.target.value)}
          onBlur={() => aoMudar({ weight: paraKg(Number(peso.replace(',', '.')) || 0, unidade) })}
          placeholder="0"
          aria-label={`Peso da série ${numero}`}
          className="min-h-[44px] w-full rounded-lg border border-borda bg-superficie-2 px-2 text-center text-lg font-semibold tabular-nums focus:border-primaria focus:outline-none"
        />

        <input
          type="number"
          inputMode="numeric"
          min="0"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          onBlur={() => aoMudar({ reps: Number(reps) || 0 })}
          placeholder="0"
          aria-label={`Repetições da série ${numero}`}
          className="min-h-[44px] w-full rounded-lg border border-borda bg-superficie-2 px-2 text-center text-lg font-semibold tabular-nums focus:border-primaria focus:outline-none"
        />

        <button
          type="button"
          onClick={aoConcluir}
          aria-pressed={serie.completed}
          aria-label={serie.completed ? `Desmarcar série ${numero}` : `Concluir série ${numero}`}
          className={clsx(
            'mx-auto flex h-11 w-11 items-center justify-center rounded-xl border transition-all active:scale-95',
            serie.completed
              ? 'border-primaria bg-primaria text-[#04140a]'
              : 'border-borda bg-superficie-2 text-texto-suave',
          )}
        >
          <Check size={22} strokeWidth={3} />
        </button>
      </div>

      <Modal aberto={menuAberto} aoFechar={() => setMenuAberto(false)} titulo={`Série ${numero}`}>
        <div className="flex flex-col gap-4">
          <Selecao
            rotulo="Tipo da série"
            value={serie.type}
            onChange={(e) => aoMudar({ type: e.target.value as TipoSerie })}
          >
            {Object.entries(TIPOS_SERIE).map(([valor, dados]) => (
              <option key={valor} value={valor}>
                {dados.rotulo}
              </option>
            ))}
          </Selecao>

          <Selecao
            rotulo="Esforço percebido (RPE)"
            value={serie.rpe ?? ''}
            onChange={(e) => aoMudar({ rpe: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Não informar</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n} value={n}>
                {n} — {n <= 3 ? 'muito leve' : n <= 5 ? 'leve' : n <= 7 ? 'moderado' : n <= 9 ? 'perto da falha' : 'falha'}
              </option>
            ))}
          </Selecao>

          {serie.prTypes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {serie.prTypes.map((pr) => (
                <Distintivo key={pr} cor="alerta">
                  <Trophy size={12} /> Recorde de {TIPOS_PR[pr].toLowerCase()}
                </Distintivo>
              ))}
            </div>
          )}

          <Botao
            variante="perigo"
            larguraTotal
            icone={<Trash2 size={18} />}
            onClick={() => {
              aoRemover();
              setMenuAberto(false);
            }}
          >
            Remover série
          </Botao>
        </div>
      </Modal>
    </>
  );
}

function MenuDoExercicio({ aoRemover, nome }: { aoRemover: () => void; nome: string; posicao: number }) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="rounded-lg p-2 text-texto-suave hover:bg-superficie-2 hover:text-texto"
        aria-label={`Opções de ${nome}`}
      >
        <MoreVertical size={18} />
      </button>

      <Modal aberto={aberto} aoFechar={() => setAberto(false)} titulo={nome}>
        <Botao
          variante="perigo"
          larguraTotal
          icone={<Trash2 size={18} />}
          onClick={() => {
            aoRemover();
            setAberto(false);
          }}
        >
          Remover do treino
        </Botao>
      </Modal>
    </>
  );
}
