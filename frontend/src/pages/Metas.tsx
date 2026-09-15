import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Plus, Target, Trash2 } from 'lucide-react';
import { apiDelete, apiGet, apiPost } from '../lib/api';
import { TIPOS_META } from '../lib/constantes';
import { formatarData, formatarNumero } from '../lib/formato';
import type { Exercicio, Meta } from '../lib/tipos';
import { BarraProgresso, Botao, Campo, Cartao, Carregando, ConfirmarAcao, Distintivo, Modal, Selecao, TituloSecao, Vazio } from '../components/ui';
import SeletorDeExercicio from '../components/SeletorDeExercicio';
import { useAvisos } from '../components/Notificacoes';

export default function Metas() {
  const queryClient = useQueryClient();
  const { sucesso, erro: avisarErro } = useAvisos();

  const [criando, setCriando] = useState(false);
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [excluindo, setExcluindo] = useState<Meta | null>(null);
  const [nova, setNova] = useState<{
    title: string;
    type: Meta['type'];
    exercicio: Exercicio | null;
    targetValue: string;
    startValue: string;
    deadline: string;
  }>({ title: '', type: 'carga', exercicio: null, targetValue: '', startValue: '', deadline: '' });

  const { data: metas, isLoading } = useQuery({
    queryKey: ['metas'],
    queryFn: () => apiGet<Meta[]>('/metas'),
  });

  const criar = useMutation({
    mutationFn: () =>
      apiPost<Meta>('/metas', {
        title: nova.title.trim(),
        type: nova.type,
        exerciseId: nova.exercicio?.id ?? null,
        targetValue: Number(nova.targetValue.replace(',', '.')),
        startValue: nova.startValue ? Number(nova.startValue.replace(',', '.')) : null,
        deadline: nova.deadline ? new Date(`${nova.deadline}T12:00:00`).toISOString() : null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      setCriando(false);
      setNova({ title: '', type: 'carga', exercicio: null, targetValue: '', startValue: '', deadline: '' });
      sucesso('Meta criada! O progresso atualiza sozinho conforme você treina.');
    },
    onError: () => avisarErro('Não foi possível criar a meta'),
  });

  const excluir = useMutation({
    mutationFn: (id: string) => apiDelete(`/metas/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['metas'] });
      setExcluindo(null);
    },
  });

  const abertas = metas?.filter((m) => !m.completed) ?? [];
  const concluidas = metas?.filter((m) => m.completed) ?? [];
  const configuracaoTipo = TIPOS_META[nova.type];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Metas</h1>
        <Botao icone={<Plus size={18} />} onClick={() => setCriando(true)}>
          Nova meta
        </Botao>
      </div>

      {isLoading ? (
        <Carregando />
      ) : metas?.length ? (
        <>
          {abertas.length > 0 && (
            <section className="flex flex-col gap-3">
              {abertas.map((meta) => (
                <CartaoDaMeta key={meta.id} meta={meta} aoExcluir={() => setExcluindo(meta)} />
              ))}
            </section>
          )}

          {concluidas.length > 0 && (
            <section>
              <TituloSecao titulo="Metas alcançadas 🎉" />
              <div className="flex flex-col gap-3">
                {concluidas.map((meta) => (
                  <CartaoDaMeta key={meta.id} meta={meta} aoExcluir={() => setExcluindo(meta)} />
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <Vazio
          icone={<Target size={32} />}
          titulo="Nenhuma meta definida"
          descricao='Exemplos: "Supino 100 kg até dezembro", "Treinar 4x por semana", "Chegar a 80 kg".'
          acao={
            <Botao icone={<Plus size={18} />} onClick={() => setCriando(true)}>
              Criar meta
            </Botao>
          }
        />
      )}

      <Modal
        aberto={criando}
        aoFechar={() => setCriando(false)}
        titulo="Nova meta"
        rodape={
          <div className="flex gap-2">
            <Botao variante="secundario" larguraTotal onClick={() => setCriando(false)}>
              Cancelar
            </Botao>
            <Botao
              larguraTotal
              carregando={criar.isPending}
              disabled={
                nova.title.trim().length < 3 ||
                !nova.targetValue ||
                (configuracaoTipo.precisaExercicio && !nova.exercicio)
              }
              onClick={() => criar.mutate()}
            >
              Criar
            </Botao>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Campo
            rotulo="Título"
            autoFocus
            placeholder="Ex.: Supino 100 kg até dezembro"
            value={nova.title}
            onChange={(e) => setNova((n) => ({ ...n, title: e.target.value }))}
          />

          <Selecao
            rotulo="Tipo de meta"
            value={nova.type}
            onChange={(e) => setNova((n) => ({ ...n, type: e.target.value as Meta['type'] }))}
          >
            {Object.entries(TIPOS_META).map(([valor, dados]) => (
              <option key={valor} value={valor}>
                {dados.rotulo}
              </option>
            ))}
          </Selecao>

          {configuracaoTipo.precisaExercicio && (
            <div>
              <p className="rotulo">Exercício</p>
              <Botao variante="secundario" larguraTotal onClick={() => setSeletorAberto(true)}>
                {nova.exercicio?.name ?? 'Escolher exercício'}
              </Botao>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Campo
              rotulo={`Valor alvo (${configuracaoTipo.unidade})`}
              type="number"
              inputMode="decimal"
              step="0.5"
              value={nova.targetValue}
              onChange={(e) => setNova((n) => ({ ...n, targetValue: e.target.value }))}
            />
            <Campo
              rotulo="Valor inicial"
              type="number"
              inputMode="decimal"
              step="0.5"
              placeholder="opcional"
              value={nova.startValue}
              onChange={(e) => setNova((n) => ({ ...n, startValue: e.target.value }))}
              dica="Usado para calcular a barra de progresso"
            />
          </div>

          <Campo
            rotulo="Prazo (opcional)"
            type="date"
            value={nova.deadline}
            onChange={(e) => setNova((n) => ({ ...n, deadline: e.target.value }))}
          />
        </div>
      </Modal>

      <SeletorDeExercicio
        aberto={seletorAberto}
        aoFechar={() => setSeletorAberto(false)}
        aoEscolher={(exercicio) => setNova((n) => ({ ...n, exercicio }))}
      />

      <ConfirmarAcao
        aberto={excluindo !== null}
        titulo="Excluir meta?"
        mensagem={`"${excluindo?.title}" será removida.`}
        textoConfirmar="Excluir"
        perigoso
        carregando={excluir.isPending}
        aoCancelar={() => setExcluindo(null)}
        aoConfirmar={() => excluindo && excluir.mutate(excluindo.id)}
      />
    </div>
  );
}

function CartaoDaMeta({ meta, aoExcluir }: { meta: Meta; aoExcluir: () => void }) {
  const unidade = TIPOS_META[meta.type]?.unidade ?? '';
  const prazoVencido = meta.deadline && !meta.completed && new Date(meta.deadline) < new Date();

  return (
    <Cartao className={meta.completed ? 'border-primaria/40' : undefined}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {meta.completed && <CheckCircle2 size={18} className="shrink-0 text-primaria" aria-hidden />}
            <h2 className="truncate font-semibold">{meta.title}</h2>
          </div>
          <p className="mt-0.5 text-sm text-texto-suave">
            {formatarNumero(meta.currentValue)} de {formatarNumero(meta.targetValue)} {unidade}
            {meta.exercise ? ` · ${meta.exercise.name}` : ''}
          </p>
        </div>
        <button
          onClick={aoExcluir}
          className="shrink-0 rounded-lg p-2 text-texto-suave hover:bg-perigo/10 hover:text-perigo"
          aria-label={`Excluir meta ${meta.title}`}
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div className="mt-3">
        <BarraProgresso valor={meta.progress} rotulo={meta.title} />
        <div className="mt-1.5 flex items-center justify-between text-xs text-texto-suave">
          <span>{Math.round(meta.progress)}% concluído</span>
          {meta.deadline && (
            <span className={prazoVencido ? 'text-perigo' : undefined}>
              {prazoVencido ? 'prazo vencido em ' : 'até '}
              {formatarData(meta.deadline)}
            </span>
          )}
        </div>
      </div>

      {meta.completed && (
        <Distintivo cor="primaria" className="mt-3">
          Meta alcançada{meta.completedAt ? ` em ${formatarData(meta.completedAt)}` : ''}
        </Distintivo>
      )}
    </Cartao>
  );
}
