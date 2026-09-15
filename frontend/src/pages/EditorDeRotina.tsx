import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, Copy, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';
import { useUnidade } from '../lib/auth';
import { TECNICAS, corDoGrupo } from '../lib/constantes';
import { formatarDuracao, paraKg, paraUnidade } from '../lib/formato';
import type { DiaDaRotina, ExercicioDaRotina, Rotina } from '../lib/tipos';
import SeletorDeExercicio from '../components/SeletorDeExercicio';
import { AreaTexto, Botao, Campo, Cartao, Carregando, ConfirmarAcao, Distintivo, Modal, Selecao, Vazio } from '../components/ui';
import { useAvisos } from '../components/Notificacoes';

export default function EditorDeRotina() {
  const { id } = useParams();
  const navegar = useNavigate();
  const queryClient = useQueryClient();
  const unidade = useUnidade();
  const { sucesso } = useAvisos();

  const [editandoRotina, setEditandoRotina] = useState(false);
  const [dadosRotina, setDadosRotina] = useState({ name: '', description: '' });
  const [novoDia, setNovoDia] = useState<string | null>(null);
  const [seletorParaDia, setSeletorParaDia] = useState<string | null>(null);
  const [itemEmEdicao, setItemEmEdicao] = useState<ExercicioDaRotina | null>(null);
  const [diaParaExcluir, setDiaParaExcluir] = useState<DiaDaRotina | null>(null);

  const { data: rotina, isLoading } = useQuery({
    queryKey: ['rotina', id],
    queryFn: () => apiGet<Rotina>(`/rotinas/${id}`),
  });

  const recarregar = () => queryClient.invalidateQueries({ queryKey: ['rotina', id] });

  const salvarRotina = useMutation({
    mutationFn: () => apiPatch(`/rotinas/${id}`, dadosRotina),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      setEditandoRotina(false);
      sucesso('Rotina atualizada');
    },
  });

  const criarDia = useMutation({
    mutationFn: (nome: string) => apiPost(`/rotinas/${id}/dias`, { name: nome }),
    onSuccess: async () => {
      await recarregar();
      setNovoDia(null);
    },
  });

  const duplicarDia = useMutation({
    mutationFn: (diaId: string) => apiPost(`/rotinas/dias/${diaId}/duplicar`),
    onSuccess: recarregar,
  });

  const excluirDia = useMutation({
    mutationFn: (diaId: string) => apiDelete(`/rotinas/dias/${diaId}`),
    onSuccess: async () => {
      await recarregar();
      setDiaParaExcluir(null);
    },
  });

  const adicionarExercicio = useMutation({
    mutationFn: ({ diaId, exerciseId }: { diaId: string; exerciseId: string }) =>
      apiPost(`/rotinas/dias/${diaId}/exercicios`, { exerciseId }),
    onSuccess: recarregar,
  });

  const salvarExercicio = useMutation({
    mutationFn: ({ itemId, dados }: { itemId: string; dados: Record<string, unknown> }) =>
      apiPatch(`/rotinas/exercicios/${itemId}`, dados),
    onSuccess: async () => {
      await recarregar();
      setItemEmEdicao(null);
    },
  });

  const removerExercicio = useMutation({
    mutationFn: (itemId: string) => apiDelete(`/rotinas/exercicios/${itemId}`),
    onSuccess: async () => {
      await recarregar();
      setItemEmEdicao(null);
    },
  });

  const reordenar = useMutation({
    mutationFn: ({ diaId, ordem }: { diaId: string; ordem: string[] }) =>
      apiPatch(`/rotinas/dias/${diaId}/exercicios/reordenar`, { ordem }),
    onSuccess: recarregar,
  });

  const sensores = useSensors(
    // Um pequeno arrasto evita que o toque para abrir vire "arrastar"
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (isLoading) return <Carregando />;
  if (!rotina) return null;

  const aoSoltar = (diaId: string, exercicios: ExercicioDaRotina[]) => (evento: DragEndEvent) => {
    const { active, over } = evento;
    if (!over || active.id === over.id) return;

    const ids = exercicios.map((e) => e.id);
    const de = ids.indexOf(String(active.id));
    const para = ids.indexOf(String(over.id));
    const nova = [...ids];
    nova.splice(para, 0, ...nova.splice(de, 1));

    reordenar.mutate({ diaId, ordem: nova });
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start gap-2">
        <button
          onClick={() => navegar('/app/rotinas')}
          className="rounded-lg p-2 text-texto-suave hover:bg-superficie-2 hover:text-texto"
          aria-label="Voltar para rotinas"
        >
          <ArrowLeft size={22} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-bold">{rotina.name}</h1>
            {rotina.isActive && <Distintivo cor="primaria">Ativa</Distintivo>}
          </div>
          {rotina.description && <p className="mt-0.5 text-sm text-texto-suave">{rotina.description}</p>}
        </div>
        <button
          onClick={() => {
            setDadosRotina({ name: rotina.name, description: rotina.description ?? '' });
            setEditandoRotina(true);
          }}
          className="rounded-lg p-2 text-texto-suave hover:bg-superficie-2 hover:text-texto"
          aria-label="Editar nome e descrição"
        >
          <Pencil size={20} />
        </button>
      </header>

      {rotina.days.length === 0 ? (
        <Vazio
          titulo="Nenhum dia de treino"
          descricao="Adicione os dias da sua divisão: Treino A, Treino B, Push, Pull…"
          acao={
            <Botao icone={<Plus size={18} />} onClick={() => setNovoDia('')}>
              Adicionar dia
            </Botao>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {rotina.days.map((dia) => (
            <Cartao key={dia.id} className="p-0 overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-borda p-3.5">
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">{dia.name}</h2>
                  <p className="text-sm text-texto-suave">
                    {dia.exercises.length === 0
                      ? 'Sem exercícios'
                      : `${dia.exercises.length} exercício${dia.exercises.length > 1 ? 's' : ''} · ${dia.exercises.reduce((t, e) => t + e.sets, 0)} séries`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => duplicarDia.mutate(dia.id)}
                    className="rounded-lg p-2 text-texto-suave hover:bg-superficie-2 hover:text-texto"
                    aria-label={`Duplicar ${dia.name}`}
                  >
                    <Copy size={18} />
                  </button>
                  <button
                    onClick={() => setDiaParaExcluir(dia)}
                    className="rounded-lg p-2 text-texto-suave hover:bg-perigo/10 hover:text-perigo"
                    aria-label={`Excluir ${dia.name}`}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {dia.exercises.length > 0 && (
                <DndContext
                  sensors={sensores}
                  collisionDetection={closestCenter}
                  modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                  onDragEnd={aoSoltar(dia.id, dia.exercises)}
                >
                  <SortableContext items={dia.exercises.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                    <ul>
                      {dia.exercises.map((item) => (
                        <ItemArrastavel key={item.id} item={item} unidade={unidade} aoEditar={() => setItemEmEdicao(item)} />
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
              )}

              <div className="p-3">
                <Botao
                  variante="secundario"
                  tamanho="sm"
                  larguraTotal
                  icone={<Plus size={16} />}
                  onClick={() => setSeletorParaDia(dia.id)}
                >
                  Adicionar exercício
                </Botao>
              </div>
            </Cartao>
          ))}

          <Botao variante="secundario" larguraTotal icone={<Plus size={18} />} onClick={() => setNovoDia('')}>
            Adicionar dia de treino
          </Botao>
        </div>
      )}

      {/* Nome do novo dia */}
      <Modal
        aberto={novoDia !== null}
        aoFechar={() => setNovoDia(null)}
        titulo="Novo dia de treino"
        rodape={
          <Botao
            larguraTotal
            carregando={criarDia.isPending}
            disabled={!novoDia?.trim()}
            onClick={() => novoDia && criarDia.mutate(novoDia.trim())}
          >
            Adicionar
          </Botao>
        }
      >
        <Campo
          autoFocus
          rotulo="Nome do dia"
          placeholder="Ex.: Treino A — Peito e Tríceps"
          value={novoDia ?? ''}
          onChange={(e) => setNovoDia(e.target.value)}
        />
      </Modal>

      <SeletorDeExercicio
        aberto={seletorParaDia !== null}
        aoFechar={() => setSeletorParaDia(null)}
        aoEscolher={(exercicio) =>
          seletorParaDia && adicionarExercicio.mutate({ diaId: seletorParaDia, exerciseId: exercicio.id })
        }
      />

      {itemEmEdicao && (
        <EdicaoDoExercicio
          item={itemEmEdicao}
          unidade={unidade}
          aoFechar={() => setItemEmEdicao(null)}
          aoSalvar={(dados) => salvarExercicio.mutate({ itemId: itemEmEdicao.id, dados })}
          aoRemover={() => removerExercicio.mutate(itemEmEdicao.id)}
          salvando={salvarExercicio.isPending}
        />
      )}

      <Modal
        aberto={editandoRotina}
        aoFechar={() => setEditandoRotina(false)}
        titulo="Editar rotina"
        rodape={
          <div className="flex gap-2">
            <Botao variante="secundario" larguraTotal onClick={() => setEditandoRotina(false)}>
              Cancelar
            </Botao>
            <Botao larguraTotal carregando={salvarRotina.isPending} onClick={() => salvarRotina.mutate()}>
              Salvar
            </Botao>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Campo
            rotulo="Nome"
            value={dadosRotina.name}
            onChange={(e) => setDadosRotina((d) => ({ ...d, name: e.target.value }))}
          />
          <AreaTexto
            rotulo="Descrição"
            value={dadosRotina.description}
            onChange={(e) => setDadosRotina((d) => ({ ...d, description: e.target.value }))}
          />
        </div>
      </Modal>

      <ConfirmarAcao
        aberto={diaParaExcluir !== null}
        titulo="Excluir dia?"
        mensagem={`"${diaParaExcluir?.name}" e seus exercícios serão removidos da rotina.`}
        textoConfirmar="Excluir"
        perigoso
        carregando={excluirDia.isPending}
        aoCancelar={() => setDiaParaExcluir(null)}
        aoConfirmar={() => diaParaExcluir && excluirDia.mutate(diaParaExcluir.id)}
      />
    </div>
  );
}

/** Linha de exercício com alça de arrastar (mouse, toque e teclado). */
function ItemArrastavel({
  item,
  unidade,
  aoEditar,
}: {
  item: ExercicioDaRotina;
  unidade: 'kg' | 'lb';
  aoEditar: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 border-t border-borda/60 px-2 py-2.5 ${isDragging ? 'opacity-60 bg-superficie-2' : ''}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none rounded-lg p-2 text-texto-suave hover:text-texto active:cursor-grabbing"
        aria-label={`Reordenar ${item.exercise.name}`}
      >
        <GripVertical size={18} />
      </button>

      <span
        className="h-8 w-1 shrink-0 rounded-full"
        style={{ backgroundColor: corDoGrupo(item.exercise.muscleGroup) }}
        aria-hidden
      />

      <button onClick={aoEditar} className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-medium">{item.exercise.name}</span>
          {item.technique !== 'normal' && <Distintivo cor="info">{TECNICAS[item.technique]}</Distintivo>}
        </span>
        <span className="block truncate text-sm text-texto-suave">
          {item.sets} × {item.repsMin === item.repsMax ? item.repsMin : `${item.repsMin}–${item.repsMax}`}
          {item.suggestedLoad ? ` · ${Math.round(paraUnidade(item.suggestedLoad, unidade) * 10) / 10} ${unidade}` : ''}
          {` · descanso ${formatarDuracao(item.restSec)}`}
          {item.notes ? ` · ${item.notes}` : ''}
        </span>
      </button>

      <button
        onClick={aoEditar}
        className="rounded-lg p-2 text-texto-suave hover:bg-superficie-2 hover:text-texto"
        aria-label={`Editar ${item.exercise.name}`}
      >
        <Pencil size={16} />
      </button>
    </li>
  );
}

/** Ajuste fino de séries, repetições, carga, descanso e técnica. */
function EdicaoDoExercicio({
  item,
  unidade,
  aoFechar,
  aoSalvar,
  aoRemover,
  salvando,
}: {
  item: ExercicioDaRotina;
  unidade: 'kg' | 'lb';
  aoFechar: () => void;
  aoSalvar: (dados: Record<string, unknown>) => void;
  aoRemover: () => void;
  salvando: boolean;
}) {
  const [dados, setDados] = useState({
    sets: item.sets,
    repsMin: item.repsMin,
    repsMax: item.repsMax,
    suggestedLoad: item.suggestedLoad ? Math.round(paraUnidade(item.suggestedLoad, unidade) * 10) / 10 : '',
    restSec: item.restSec,
    technique: item.technique,
    notes: item.notes ?? '',
  });

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={item.exercise.name}
      rodape={
        <div className="flex gap-2">
          <Botao variante="secundario" larguraTotal onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao
            larguraTotal
            carregando={salvando}
            onClick={() =>
              aoSalvar({
                sets: Number(dados.sets),
                repsMin: Number(dados.repsMin),
                repsMax: Math.max(Number(dados.repsMin), Number(dados.repsMax)),
                suggestedLoad: dados.suggestedLoad === '' ? null : paraKg(Number(dados.suggestedLoad), unidade),
                restSec: Number(dados.restSec),
                technique: dados.technique,
                notes: dados.notes || null,
              })
            }
          >
            Salvar
          </Botao>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2">
          <Campo
            rotulo="Séries"
            type="number"
            inputMode="numeric"
            min={1}
            max={20}
            value={dados.sets}
            onChange={(e) => setDados((d) => ({ ...d, sets: Number(e.target.value) }))}
          />
          <Campo
            rotulo="Reps mín."
            type="number"
            inputMode="numeric"
            min={1}
            value={dados.repsMin}
            onChange={(e) => setDados((d) => ({ ...d, repsMin: Number(e.target.value) }))}
          />
          <Campo
            rotulo="Reps máx."
            type="number"
            inputMode="numeric"
            min={1}
            value={dados.repsMax}
            onChange={(e) => setDados((d) => ({ ...d, repsMax: Number(e.target.value) }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Campo
            rotulo={`Carga sugerida (${unidade})`}
            type="number"
            inputMode="decimal"
            step="0.5"
            placeholder="opcional"
            value={dados.suggestedLoad}
            onChange={(e) => setDados((d) => ({ ...d, suggestedLoad: e.target.value }))}
          />
          <Selecao
            rotulo="Descanso"
            value={dados.restSec}
            onChange={(e) => setDados((d) => ({ ...d, restSec: Number(e.target.value) }))}
          >
            {[30, 45, 60, 75, 90, 120, 150, 180, 240, 300].map((segundos) => (
              <option key={segundos} value={segundos}>
                {formatarDuracao(segundos)}
              </option>
            ))}
          </Selecao>
        </div>

        <Selecao
          rotulo="Técnica"
          value={dados.technique}
          onChange={(e) => setDados((d) => ({ ...d, technique: e.target.value as ExercicioDaRotina['technique'] }))}
        >
          {Object.entries(TECNICAS).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </Selecao>

        <AreaTexto
          rotulo="Observações"
          placeholder="Ex.: pegada fechada, cadência 3-1-1…"
          value={dados.notes}
          onChange={(e) => setDados((d) => ({ ...d, notes: e.target.value }))}
        />

        <Botao variante="perigo" larguraTotal icone={<Trash2 size={18} />} onClick={aoRemover}>
          Remover da rotina
        </Botao>
      </div>
    </Modal>
  );
}
