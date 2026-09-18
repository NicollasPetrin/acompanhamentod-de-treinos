import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Copy, EyeOff, LogOut, Medal, Pencil, RefreshCw, Share2, Trash2, UserMinus, UserPlus, Users,
} from 'lucide-react';
import { apiDelete, apiGet, apiPatch, apiPost, ErroApi } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatarVolume, plural } from '../lib/formato';
import type { Amizade, Grupo as GrupoDetalhe, ListaDeAmigos, TreinoDoMural } from '../lib/tipos';
import {
  Abas, AreaTexto, Botao, Campo, Cartao, Carregando, ConfirmarAcao, Distintivo, Modal, TituloSecao, Vazio,
} from '../components/ui';
import { Avatar, TreinoNoMural } from '../components/Social';
import { useAvisos } from '../components/Notificacoes';

const POR_PAGINA = 20;

export default function Grupo() {
  const { id = '' } = useParams();
  const navegar = useNavigate();
  const queryClient = useQueryClient();
  const { usuario } = useAuth();
  const { sucesso, erro: avisarErro } = useAvisos();
  const unidade = usuario?.weightUnit ?? 'kg';

  const [aba, setAba] = useState<'mural' | 'ranking'>('mural');
  const [editando, setEditando] = useState(false);
  const [convidando, setConvidando] = useState(false);
  const [edicao, setEdicao] = useState({ name: '', description: '' });
  const [saindo, setSaindo] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [removendo, setRemovendo] = useState<{ id: string; name: string } | null>(null);

  const { data: grupo, isLoading } = useQuery({
    queryKey: ['grupo', id],
    queryFn: () => apiGet<GrupoDetalhe>(`/grupos/${id}`),
  });

  const ativo = grupo?.status === 'ativo';

  const mural = useInfiniteQuery({
    queryKey: ['grupo-mural', id],
    enabled: ativo,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      apiGet<TreinoDoMural[]>(
        `/grupos/${id}/mural?limite=${POR_PAGINA}${pageParam ? `&antesDe=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    getNextPageParam: (ultima) =>
      ultima.length < POR_PAGINA ? undefined : ultima[ultima.length - 1]?.data,
  });

  const { data: amigos } = useQuery({
    queryKey: ['amigos'],
    queryFn: () => apiGet<ListaDeAmigos>('/amigos'),
    enabled: convidando,
  });

  const recarregar = async () => {
    await queryClient.invalidateQueries({ queryKey: ['grupo', id] });
    await queryClient.invalidateQueries({ queryKey: ['grupos'] });
  };

  const salvar = useMutation({
    mutationFn: () =>
      apiPatch(`/grupos/${id}`, { name: edicao.name.trim(), description: edicao.description.trim() || null }),
    onSuccess: async () => {
      await recarregar();
      setEditando(false);
      sucesso('Grupo atualizado');
    },
    onError: (e) => avisarErro(e instanceof ErroApi ? e.message : 'Não foi possível salvar'),
  });

  const novoCodigo = useMutation({
    mutationFn: () => apiPost<{ inviteCode: string }>(`/grupos/${id}/codigo`),
    onSuccess: async () => {
      await recarregar();
      sucesso('Código novo gerado — o anterior parou de funcionar');
    },
  });

  const convidar = useMutation({
    mutationFn: (userId: string) => apiPost(`/grupos/${id}/convidar`, { userId }),
    onSuccess: async () => {
      await recarregar();
      sucesso('Convite enviado');
    },
    onError: (e) => avisarErro(e instanceof ErroApi ? e.message : 'Não foi possível convidar'),
  });

  const sair = useMutation({
    mutationFn: (userId: string) => apiDelete(`/grupos/${id}/membros/${userId}`),
    onSuccess: async (_dados, userId) => {
      await queryClient.invalidateQueries({ queryKey: ['grupos'] });
      setSaindo(false);
      setRemovendo(null);
      if (userId === usuario?.id) navegar('/app/grupos');
      else await recarregar();
    },
    onError: (e) => avisarErro(e instanceof ErroApi ? e.message : 'Não foi possível remover'),
  });

  const excluir = useMutation({
    mutationFn: () => apiDelete(`/grupos/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['grupos'] });
      navegar('/app/grupos');
    },
  });

  if (isLoading) return <Carregando texto="Carregando o grupo…" />;
  if (!grupo) {
    return (
      <Vazio
        icone={<Users size={32} />}
        titulo="Grupo não encontrado"
        descricao="Ele pode ter sido excluído, ou você saiu dele."
        acao={
          <Link to="/app/grupos" className="text-sm font-medium text-primaria">
            Ver meus grupos
          </Link>
        }
      />
    );
  }

  const eDono = grupo.papel === 'dono';
  const treinos = mural.data?.pages.flat() ?? [];
  const jaNoGrupo = new Set([...grupo.ranking.map((l) => l.pessoa.id), ...grupo.convidados.map((p) => p.id)]);
  const convidaveis = (amigos?.amigos ?? []).filter((a: Amizade) => !jaNoGrupo.has(a.pessoa.id));

  const copiarCodigo = async () => {
    if (!grupo.inviteCode) return;
    try {
      await navigator.clipboard.writeText(grupo.inviteCode);
      sucesso('Código copiado — é só colar no grupo do zap');
    } catch {
      avisarErro('Copie o código manualmente: ' + grupo.inviteCode);
    }
  };

  const compartilhar = async () => {
    if (!grupo.inviteCode) return;
    const texto = `Bora treinar junto? Entra no grupo "${grupo.name}" no app com o código ${grupo.inviteCode}`;
    if (navigator.share) {
      try {
        await navigator.share({ text: texto });
        return;
      } catch {
        /* usuário cancelou o compartilhamento */
      }
    }
    void copiarCodigo();
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-2">
        <Link to="/app/grupos" className="mt-1 text-texto-suave hover:text-texto" aria-label="Voltar para os grupos">
          <ArrowLeft size={22} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{grupo.name}</h1>
          <p className="mt-0.5 text-sm text-texto-suave">
            {grupo.description || `Criado por ${grupo.dono.name}`}
          </p>
        </div>
        {eDono && (
          <button
            onClick={() => {
              setEdicao({ name: grupo.name, description: grupo.description ?? '' });
              setEditando(true);
            }}
            className="mt-1 text-texto-suave hover:text-texto"
            aria-label="Editar grupo"
          >
            <Pencil size={18} />
          </button>
        )}
      </div>

      {grupo.status === 'convidado' ? (
        <Cartao className="flex flex-col gap-3">
          <p className="text-sm">
            Você foi convidado para este grupo. Ao entrar, os treinos que você concluir passam a aparecer
            aqui para os outros.
          </p>
          <Botao
            larguraTotal
            onClick={async () => {
              await apiPost(`/grupos/${id}/aceitar`);
              await recarregar();
              await mural.refetch();
            }}
          >
            Entrar no grupo
          </Botao>
        </Cartao>
      ) : (
        <>
          {grupo.inviteCode && (
            <Cartao className="flex flex-col gap-3">
              <div>
                <h2 className="font-semibold">Chamar a galera</h2>
                <p className="mt-0.5 text-sm text-texto-suave">Quem tiver este código entra no grupo.</p>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-xl border border-borda bg-superficie-2 px-4 py-3 text-center text-xl font-bold tracking-[0.3em]">
                  {grupo.inviteCode}
                </code>
                <Botao variante="secundario" icone={<Copy size={18} />} onClick={copiarCodigo} aria-label="Copiar código" />
                <Botao variante="secundario" icone={<Share2 size={18} />} onClick={compartilhar} aria-label="Compartilhar código" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Botao tamanho="sm" variante="secundario" icone={<UserPlus size={16} />} onClick={() => setConvidando(true)}>
                  Convidar um amigo
                </Botao>
                <Botao
                  tamanho="sm"
                  variante="fantasma"
                  icone={<RefreshCw size={16} />}
                  onClick={() => novoCodigo.mutate()}
                  carregando={novoCodigo.isPending}
                >
                  Gerar código novo
                </Botao>
              </div>
            </Cartao>
          )}

          <Abas
            abas={[
              { valor: 'mural', rotulo: 'Mural' },
              { valor: 'ranking', rotulo: 'Ranking da semana', contador: grupo.ranking.length },
            ]}
            ativa={aba}
            aoTrocar={setAba}
          />

          {aba === 'mural' ? (
            <section className="flex flex-col gap-2">
              {mural.isLoading ? (
                <Carregando texto="Carregando o mural…" />
              ) : treinos.length === 0 ? (
                <Vazio
                  icone={<Users size={32} />}
                  titulo="Nenhum treino no mural ainda"
                  descricao="Assim que alguém do grupo terminar um treino, ele aparece aqui automaticamente."
                  acao={
                    <Link to="/app/treino" className="text-sm font-medium text-primaria">
                      Começar o seu
                    </Link>
                  }
                />
              ) : (
                <>
                  {treinos.map((treino) => (
                    <TreinoNoMural key={treino.id} treino={treino} unidade={unidade} />
                  ))}
                  {mural.hasNextPage && (
                    <Botao
                      variante="secundario"
                      larguraTotal
                      onClick={() => mural.fetchNextPage()}
                      carregando={mural.isFetchingNextPage}
                    >
                      Ver treinos mais antigos
                    </Botao>
                  )}
                </>
              )}
            </section>
          ) : (
            <section className="flex flex-col gap-2">
              <TituloSecao
                titulo="Esta semana"
                descricao="Ordenado por número de treinos — e, no empate, pelo volume."
              />
              {grupo.ranking.map((linha, indice) => (
                <Cartao key={linha.pessoa.id} className="flex items-center gap-3">
                  <span className="w-5 shrink-0 text-center text-sm font-semibold text-texto-suave">
                    {indice === 0 && linha.treinos > 0 ? <Medal size={18} className="mx-auto text-alerta" /> : indice + 1}
                  </span>
                  <Avatar pessoa={linha.pessoa} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold">
                        {linha.pessoa.id === usuario?.id ? 'Você' : linha.pessoa.name}
                      </p>
                      {linha.papel === 'dono' && <Distintivo>dono</Distintivo>}
                      {!linha.compartilhando && (
                        <Distintivo cor="neutro">
                          <EyeOff size={11} aria-hidden />
                          privado
                        </Distintivo>
                      )}
                    </div>
                    <p className="text-sm text-texto-suave">
                      {linha.treinos === 0 ? 'nenhum treino ainda' : plural(linha.treinos, 'treino')}
                      {linha.volume > 0 && ` · ${formatarVolume(linha.volume, unidade)}`}
                    </p>
                  </div>
                  {eDono && linha.pessoa.id !== usuario?.id && (
                    <button
                      onClick={() => setRemovendo({ id: linha.pessoa.id, name: linha.pessoa.name })}
                      className="rounded-lg p-2 text-texto-suave hover:text-perigo"
                      aria-label={`Remover ${linha.pessoa.name} do grupo`}
                    >
                      <UserMinus size={18} />
                    </button>
                  )}
                </Cartao>
              ))}

              {grupo.convidados.length > 0 && (
                <>
                  <TituloSecao titulo="Convites pendentes" />
                  {grupo.convidados.map((pessoa) => (
                    <Cartao key={pessoa.id} className="flex items-center gap-3">
                      <Avatar pessoa={pessoa} tamanho="sm" />
                      <p className="min-w-0 flex-1 truncate text-sm text-texto-suave">
                        {pessoa.name} — aguardando aceitar
                      </p>
                    </Cartao>
                  ))}
                </>
              )}
            </section>
          )}

          <div className="mt-2 flex flex-wrap gap-2">
            {eDono ? (
              <Botao variante="perigo" icone={<Trash2 size={18} />} onClick={() => setExcluindo(true)}>
                Excluir grupo
              </Botao>
            ) : (
              <Botao variante="perigo" icone={<LogOut size={18} />} onClick={() => setSaindo(true)}>
                Sair do grupo
              </Botao>
            )}
          </div>

          <p className="text-xs text-texto-suave">
            O mural mostra os treinos a partir do dia em que cada pessoa entrou no grupo. Para pausar o
            compartilhamento sem sair, desligue a opção em Perfil e configurações.
          </p>
        </>
      )}

      <Modal
        aberto={editando}
        aoFechar={() => setEditando(false)}
        titulo="Editar grupo"
        rodape={
          <Botao larguraTotal onClick={() => salvar.mutate()} carregando={salvar.isPending} disabled={edicao.name.trim().length < 2}>
            Salvar
          </Botao>
        }
      >
        <div className="flex flex-col gap-3">
          <Campo
            rotulo="Nome do grupo"
            name="nome-do-grupo"
            value={edicao.name}
            onChange={(e) => setEdicao({ ...edicao, name: e.target.value })}
          />
          <AreaTexto
            rotulo="Descrição"
            name="descricao-do-grupo"
            rows={2}
            value={edicao.description}
            onChange={(e) => setEdicao({ ...edicao, description: e.target.value })}
          />
        </div>
      </Modal>

      <Modal aberto={convidando} aoFechar={() => setConvidando(false)} titulo="Convidar um amigo">
        {convidaveis.length === 0 ? (
          <Vazio
            icone={<UserPlus size={28} />}
            titulo="Nenhum amigo para convidar"
            descricao="Todos os seus amigos já estão no grupo ou foram convidados. Você também pode passar o código."
            acao={
              <Link to="/app/amigos" className="text-sm font-medium text-primaria" onClick={() => setConvidando(false)}>
                Adicionar amigos
              </Link>
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {convidaveis.map((amigo) => (
              <div key={amigo.id} className="flex items-center gap-3 rounded-xl border border-borda p-3">
                <Avatar pessoa={amigo.pessoa} tamanho="sm" />
                <p className="min-w-0 flex-1 truncate font-medium">{amigo.pessoa.name}</p>
                <Botao
                  tamanho="sm"
                  onClick={() => convidar.mutate(amigo.pessoa.id)}
                  carregando={convidar.isPending && convidar.variables === amigo.pessoa.id}
                >
                  Convidar
                </Botao>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <ConfirmarAcao
        aberto={saindo}
        titulo="Sair do grupo?"
        mensagem="Seus treinos deixam de aparecer no mural. Você pode voltar depois com o código."
        textoConfirmar="Sair"
        perigoso
        carregando={sair.isPending}
        aoConfirmar={() => usuario && sair.mutate(usuario.id)}
        aoCancelar={() => setSaindo(false)}
      />

      <ConfirmarAcao
        aberto={removendo !== null}
        titulo="Remover do grupo?"
        mensagem={`${removendo?.name ?? ''} sai do grupo e some do mural. Os treinos dessa pessoa continuam no histórico dela.`}
        textoConfirmar="Remover"
        perigoso
        carregando={sair.isPending}
        aoConfirmar={() => removendo && sair.mutate(removendo.id)}
        aoCancelar={() => setRemovendo(null)}
      />

      <ConfirmarAcao
        aberto={excluindo}
        titulo="Excluir o grupo?"
        mensagem="O grupo some para todo mundo. Os treinos de cada um continuam intactos no histórico."
        textoConfirmar="Excluir"
        perigoso
        carregando={excluir.isPending}
        aoConfirmar={() => excluir.mutate()}
        aoCancelar={() => setExcluindo(false)}
      />
    </div>
  );
}
