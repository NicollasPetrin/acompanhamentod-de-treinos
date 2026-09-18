import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive, ArchiveRestore, Check, Copy, Link2, ListChecks, MoreVertical, Pencil, Share2, Trash2, Wand2,
} from 'lucide-react';
import { apiDelete, apiGet, apiPost } from '../lib/api';
import { OBJETIVOS } from '../lib/constantes';
import { plural } from '../lib/formato';
import type { Rotina } from '../lib/tipos';
import { Abas, Botao, Cartao, Carregando, ConfirmarAcao, Distintivo, Modal, Vazio } from '../components/ui';
import { useAvisos } from '../components/Notificacoes';

interface Template {
  slug: string;
  nome: string;
  descricao: string;
  objetivo: string;
  nivel: string;
  diasPorSemana: number;
  dias: Array<{ nome: string; exercicios: string[] }>;
}

export default function Rotinas() {
  const queryClient = useQueryClient();
  const { sucesso } = useAvisos();

  const [aba, setAba] = useState<'ativas' | 'arquivadas' | 'modelos'>('ativas');
  const [excluindo, setExcluindo] = useState<Rotina | null>(null);

  const { data: rotinas, isLoading } = useQuery({
    queryKey: ['rotinas', aba === 'arquivadas'],
    queryFn: () => apiGet<Rotina[]>(`/rotinas?arquivadas=${aba === 'arquivadas'}`),
    enabled: aba !== 'modelos',
  });

  const { data: templates } = useQuery({
    queryKey: ['templates'],
    queryFn: () => apiGet<Template[]>('/rotinas/templates'),
    enabled: aba === 'modelos',
  });

  const atualizarTudo = () => queryClient.invalidateQueries();

  const aplicarTemplate = useMutation({
    mutationFn: (slug: string) => apiPost<Rotina>(`/rotinas/templates/${slug}/aplicar`),
    onSuccess: async () => {
      await atualizarTudo();
      setAba('ativas');
      sucesso('Rotina criada a partir do modelo!');
    },
  });

  const ativar = useMutation({
    mutationFn: (id: string) => apiPost(`/rotinas/${id}/ativar`),
    onSuccess: async () => {
      await atualizarTudo();
      sucesso('Rotina ativada — ela aparece na tela inicial');
    },
  });

  const duplicar = useMutation({
    mutationFn: (id: string) => apiPost(`/rotinas/${id}/duplicar`),
    onSuccess: async () => {
      await atualizarTudo();
      sucesso('Rotina duplicada');
    },
  });

  const arquivar = useMutation({
    mutationFn: (id: string) => apiPost(`/rotinas/${id}/arquivar`),
    onSuccess: atualizarTudo,
  });

  const excluir = useMutation({
    mutationFn: (id: string) => apiDelete(`/rotinas/${id}`),
    onSuccess: async () => {
      await atualizarTudo();
      setExcluindo(null);
      sucesso('Rotina excluída');
    },
  });

  const compartilhar = useMutation({
    mutationFn: (id: string) => apiPost<{ shareSlug: string; caminho: string }>(`/rotinas/${id}/compartilhar`),
    onSuccess: async (dados) => {
      const url = `${window.location.origin}${dados.caminho}`;
      try {
        if (navigator.share) await navigator.share({ title: 'Minha rotina de treino', url });
        else {
          await navigator.clipboard.writeText(url);
          sucesso('Link copiado para a área de transferência');
        }
      } catch {
        sucesso(`Link: ${url}`);
      }
      await atualizarTudo();
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Rotinas</h1>
        <Link to="/app/rotinas/nova">
          <Botao icone={<Wand2 size={18} />}>Criar rotina</Botao>
        </Link>
      </div>

      <Abas
        abas={[
          { valor: 'ativas', rotulo: 'Minhas rotinas' },
          { valor: 'arquivadas', rotulo: 'Arquivadas' },
          { valor: 'modelos', rotulo: 'Modelos prontos' },
        ]}
        ativa={aba}
        aoTrocar={setAba}
      />

      {aba === 'modelos' ? (
        <section className="flex flex-col gap-3">
          <p className="text-sm text-texto-suave">
            Comece rápido com uma divisão clássica — depois é só ajustar exercícios e cargas do seu jeito.
          </p>
          {templates?.map((template) => (
            <Cartao key={template.slug}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold">{template.nome}</h2>
                  <p className="mt-1 text-sm text-texto-suave">{template.descricao}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Distintivo>{OBJETIVOS[template.objetivo] ?? template.objetivo}</Distintivo>
                    <Distintivo>{template.diasPorSemana}x por semana</Distintivo>
                    <Distintivo>{plural(template.dias.length, 'treino')}</Distintivo>
                  </div>
                </div>
                <Botao
                  tamanho="sm"
                  carregando={aplicarTemplate.isPending && aplicarTemplate.variables === template.slug}
                  onClick={() => aplicarTemplate.mutate(template.slug)}
                >
                  Usar
                </Botao>
              </div>

              <ul className="mt-3 flex flex-col gap-1 border-t border-borda pt-3 text-sm text-texto-suave">
                {template.dias.map((dia) => (
                  <li key={dia.nome}>
                    <strong className="text-texto">{dia.nome}:</strong> {dia.exercicios.slice(0, 4).join(', ')}
                    {dia.exercicios.length > 4 && ` +${dia.exercicios.length - 4}`}
                  </li>
                ))}
              </ul>
            </Cartao>
          ))}
        </section>
      ) : isLoading ? (
        <Carregando />
      ) : rotinas?.length ? (
        <section className="flex flex-col gap-3">
          {rotinas.map((rotina) => (
            <Cartao key={rotina.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate font-semibold">{rotina.name}</h2>
                    {rotina.isActive && <Distintivo cor="primaria">Ativa</Distintivo>}
                    {rotina.shareSlug && (
                      <Distintivo cor="info">
                        <Link2 size={11} /> compartilhada
                      </Distintivo>
                    )}
                  </div>
                  {rotina.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-texto-suave">{rotina.description}</p>
                  )}
                  <p className="mt-1.5 text-sm text-texto-suave">
                    {plural(rotina.days.length, 'dia de treino', 'dias de treino')} ·{' '}
                    {plural(rotina.days.reduce((t, d) => t + d.exercises.length, 0), 'exercício')}
                  </p>
                </div>

                <MenuDaRotina
                  rotina={rotina}
                  aoAtivar={() => ativar.mutate(rotina.id)}
                  aoDuplicar={() => duplicar.mutate(rotina.id)}
                  aoArquivar={() => arquivar.mutate(rotina.id)}
                  aoCompartilhar={() => compartilhar.mutate(rotina.id)}
                  aoExcluir={() => setExcluindo(rotina)}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {rotina.days.map((dia) => (
                  <span key={dia.id} className="rounded-lg bg-superficie-2 px-2.5 py-1 text-xs text-texto-suave">
                    {dia.name}
                  </span>
                ))}
              </div>

              <div className="mt-3 flex gap-2 border-t border-borda pt-3">
                <Link to={`/app/rotinas/${rotina.id}`} className="flex-1">
                  <Botao variante="secundario" tamanho="sm" larguraTotal icone={<Pencil size={16} />}>
                    Editar
                  </Botao>
                </Link>
                {!rotina.isActive && !rotina.archived && (
                  <Botao
                    tamanho="sm"
                    className="flex-1"
                    icone={<Check size={16} />}
                    onClick={() => ativar.mutate(rotina.id)}
                  >
                    Tornar ativa
                  </Botao>
                )}
              </div>
            </Cartao>
          ))}
        </section>
      ) : (
        <Vazio
          icone={<ListChecks size={32} />}
          titulo={aba === 'arquivadas' ? 'Nenhuma rotina arquivada' : 'Você ainda não tem rotinas'}
          descricao={
            aba === 'arquivadas'
              ? 'Rotinas arquivadas ficam guardadas aqui, sem sumir do histórico.'
              : 'Crie uma do zero ou comece por um modelo pronto.'
          }
          acao={
            aba !== 'arquivadas' ? (
              <div className="flex gap-2">
                <Link to="/app/rotinas/nova">
                  <Botao icone={<Wand2 size={18} />}>Criar com o assistente</Botao>
                </Link>
                <Botao variante="secundario" onClick={() => setAba('modelos')}>
                  Ver modelos
                </Botao>
              </div>
            ) : undefined
          }
        />
      )}

      <ConfirmarAcao
        aberto={excluindo !== null}
        titulo="Excluir rotina?"
        mensagem={`"${excluindo?.name}" será excluída junto com seus dias e exercícios. Os treinos já registrados continuam no histórico.`}
        textoConfirmar="Excluir"
        perigoso
        carregando={excluir.isPending}
        aoCancelar={() => setExcluindo(null)}
        aoConfirmar={() => excluindo && excluir.mutate(excluindo.id)}
      />
    </div>
  );
}

function MenuDaRotina({
  rotina,
  aoAtivar,
  aoDuplicar,
  aoArquivar,
  aoCompartilhar,
  aoExcluir,
}: {
  rotina: Rotina;
  aoAtivar: () => void;
  aoDuplicar: () => void;
  aoArquivar: () => void;
  aoCompartilhar: () => void;
  aoExcluir: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const fechar = (acao: () => void) => () => {
    acao();
    setAberto(false);
  };

  const itens = [
    ...(rotina.isActive || rotina.archived ? [] : [{ rotulo: 'Tornar ativa', icone: Check, acao: aoAtivar }]),
    { rotulo: 'Duplicar', icone: Copy, acao: aoDuplicar },
    { rotulo: 'Compartilhar por link', icone: Share2, acao: aoCompartilhar },
    {
      rotulo: rotina.archived ? 'Desarquivar' : 'Arquivar',
      icone: rotina.archived ? ArchiveRestore : Archive,
      acao: aoArquivar,
    },
  ];

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="shrink-0 rounded-lg p-2 text-texto-suave hover:bg-superficie-2 hover:text-texto"
        aria-label={`Opções de ${rotina.name}`}
      >
        <MoreVertical size={20} />
      </button>

      <Modal aberto={aberto} aoFechar={() => setAberto(false)} titulo={rotina.name}>
        <div className="flex flex-col gap-1">
          {itens.map((item) => (
            <button
              key={item.rotulo}
              onClick={fechar(item.acao)}
              className="flex items-center gap-3 rounded-xl px-3 py-3.5 text-left text-[15px] hover:bg-superficie-2"
            >
              <item.icone size={19} className="text-primaria" aria-hidden />
              {item.rotulo}
            </button>
          ))}
          <button
            onClick={fechar(aoExcluir)}
            className="flex items-center gap-3 rounded-xl px-3 py-3.5 text-left text-[15px] text-perigo hover:bg-perigo/10"
          >
            <Trash2 size={19} aria-hidden />
            Excluir rotina
          </button>
        </div>
      </Modal>
    </>
  );
}
