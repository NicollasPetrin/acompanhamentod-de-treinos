import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, LogIn, Plus, UserPlus, Users } from 'lucide-react';
import { apiGet, apiPost, ErroApi } from '../lib/api';
import { formatarDataRelativa, plural } from '../lib/formato';
import type { GrupoResumido } from '../lib/tipos';
import { AreaTexto, Botao, Campo, Cartao, Carregando, Distintivo, Modal, TituloSecao, Vazio } from '../components/ui';
import { useAvisos } from '../components/Notificacoes';

export default function Grupos() {
  const queryClient = useQueryClient();
  const navegar = useNavigate();
  const { sucesso, erro: avisarErro } = useAvisos();

  const [criando, setCriando] = useState(false);
  const [entrando, setEntrando] = useState(false);
  const [novo, setNovo] = useState({ name: '', description: '' });
  const [codigo, setCodigo] = useState('');

  const { data: grupos, isLoading } = useQuery({
    queryKey: ['grupos'],
    queryFn: () => apiGet<GrupoResumido[]>('/grupos'),
  });

  const criar = useMutation({
    mutationFn: () =>
      apiPost<{ id: string }>('/grupos', {
        name: novo.name.trim(),
        description: novo.description.trim() || null,
      }),
    onSuccess: async (grupo) => {
      await queryClient.invalidateQueries({ queryKey: ['grupos'] });
      setCriando(false);
      setNovo({ name: '', description: '' });
      sucesso('Grupo criado! Agora chame a galera com o código de convite.');
      navegar(`/app/grupos/${grupo.id}`);
    },
    onError: (e) => avisarErro(e instanceof ErroApi ? e.message : 'Não foi possível criar o grupo'),
  });

  const entrar = useMutation({
    mutationFn: () => apiPost<{ id: string; name: string }>('/grupos/entrar', { codigo: codigo.trim() }),
    onSuccess: async (grupo) => {
      await queryClient.invalidateQueries({ queryKey: ['grupos'] });
      setEntrando(false);
      setCodigo('');
      sucesso(`Você entrou em "${grupo.name}"`);
      navegar(`/app/grupos/${grupo.id}`);
    },
    onError: (e) => avisarErro(e instanceof ErroApi ? e.message : 'Não foi possível entrar no grupo'),
  });

  const aceitarConvite = useMutation({
    mutationFn: (id: string) => apiPost(`/grupos/${id}/aceitar`),
    onSuccess: async (_dados, id) => {
      await queryClient.invalidateQueries({ queryKey: ['grupos'] });
      sucesso('Pronto! Seus treinos agora aparecem para o grupo.');
      navegar(`/app/grupos/${id}`);
    },
  });

  if (isLoading) return <Carregando texto="Carregando seus grupos…" />;

  const convites = grupos?.filter((g) => g.status === 'convidado') ?? [];
  const meus = grupos?.filter((g) => g.status === 'ativo') ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Grupos de treino</h1>
          <p className="mt-1 text-sm text-texto-suave">
            Quando alguém do grupo termina um treino, ele aparece no mural sozinho.
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Botao icone={<Plus size={18} />} onClick={() => setCriando(true)} className="flex-1">
          Criar grupo
        </Botao>
        <Botao variante="secundario" icone={<LogIn size={18} />} onClick={() => setEntrando(true)} className="flex-1">
          Entrar com código
        </Botao>
      </div>

      {convites.length > 0 && (
        <section>
          <TituloSecao titulo="Convites" descricao="Você foi chamado para treinar junto." />
          <div className="flex flex-col gap-2">
            {convites.map((grupo) => (
              <Cartao key={grupo.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{grupo.name}</p>
                  <p className="text-sm text-texto-suave">
                    de {grupo.dono.name} · {plural(grupo.membros, 'pessoa', 'pessoas')}
                  </p>
                </div>
                <Botao
                  tamanho="sm"
                  icone={<Check size={16} />}
                  onClick={() => aceitarConvite.mutate(grupo.id)}
                  carregando={aceitarConvite.isPending && aceitarConvite.variables === grupo.id}
                >
                  Entrar
                </Botao>
              </Cartao>
            ))}
          </div>
        </section>
      )}

      {meus.length === 0 ? (
        <Vazio
          icone={<Users size={32} />}
          titulo="Você ainda não está em nenhum grupo"
          descricao="Crie um grupo e mande o código para a galera, ou entre com o código que te passaram."
          acao={
            <Link to="/app/amigos" className="text-sm font-medium text-primaria">
              Adicionar amigos primeiro
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {meus.map((grupo) => (
            <Link key={grupo.id} to={`/app/grupos/${grupo.id}`} className="block">
              <Cartao className="flex items-center gap-3 transition-colors hover:border-primaria/50">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate font-semibold">{grupo.name}</h2>
                    {grupo.papel === 'dono' && <Distintivo cor="primaria">Seu grupo</Distintivo>}
                  </div>
                  <p className="mt-0.5 text-sm text-texto-suave">
                    {plural(grupo.membros, 'pessoa', 'pessoas')} ·{' '}
                    {grupo.treinosNaSemana === 0
                      ? 'nenhum treino esta semana'
                      : `${plural(grupo.treinosNaSemana, 'treino')} esta semana`}
                  </p>
                  {grupo.ultimoTreino && (
                    <p className="mt-1 truncate text-xs text-texto-suave">
                      Último: {grupo.ultimoTreino.pessoa} — {grupo.ultimoTreino.nome},{' '}
                      {formatarDataRelativa(grupo.ultimoTreino.data)}
                    </p>
                  )}
                </div>
                <ArrowRight size={18} className="shrink-0 text-texto-suave" aria-hidden />
              </Cartao>
            </Link>
          ))}
        </div>
      )}

      <Cartao className="flex items-start gap-3 text-sm text-texto-suave">
        <UserPlus size={18} className="mt-0.5 shrink-0 text-primaria" aria-hidden />
        <p>
          Para convidar direto pelo app, a pessoa precisa ser sua amiga em{' '}
          <Link to="/app/amigos" className="font-medium text-primaria">
            Amigos
          </Link>
          . O código de convite funciona para qualquer pessoa.
        </p>
      </Cartao>

      <Modal
        aberto={criando}
        aoFechar={() => setCriando(false)}
        titulo="Criar grupo"
        rodape={
          <Botao
            larguraTotal
            onClick={() => criar.mutate()}
            carregando={criar.isPending}
            disabled={novo.name.trim().length < 2}
          >
            Criar grupo
          </Botao>
        }
      >
        <div className="flex flex-col gap-3">
          <Campo
            rotulo="Nome do grupo"
            name="nome-do-grupo"
            placeholder="Galera da academia"
            value={novo.name}
            onChange={(e) => setNovo({ ...novo, name: e.target.value })}
            autoFocus
          />
          <AreaTexto
            rotulo="Descrição (opcional)"
            name="descricao-do-grupo"
            rows={2}
            placeholder="Treino de segunda a sexta, 19h"
            value={novo.description}
            onChange={(e) => setNovo({ ...novo, description: e.target.value })}
          />
          <p className="text-sm text-texto-suave">
            Depois de criar, você recebe um código de 6 letras para passar para a galera.
          </p>
        </div>
      </Modal>

      <Modal
        aberto={entrando}
        aoFechar={() => setEntrando(false)}
        titulo="Entrar em um grupo"
        rodape={
          <Botao larguraTotal onClick={() => entrar.mutate()} carregando={entrar.isPending} disabled={codigo.trim().length < 4}>
            Entrar
          </Botao>
        }
      >
        <Campo
          rotulo="Código do convite"
          name="codigo-do-convite"
          placeholder="ABC123"
          autoCapitalize="characters"
          autoComplete="off"
          className="text-center text-lg font-semibold tracking-[0.3em] uppercase"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          dica="Peça o código para quem criou o grupo."
          autoFocus
        />
      </Modal>
    </div>
  );
}
