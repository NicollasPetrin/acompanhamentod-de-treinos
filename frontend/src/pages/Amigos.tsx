import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Check, Copy, Share2, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { apiDelete, apiGet, apiPost, ErroApi } from '../lib/api';
import { formatarDataRelativa } from '../lib/formato';
import type { Amizade, ListaDeAmigos } from '../lib/tipos';
import { Botao, Campo, Cartao, Carregando, ConfirmarAcao, TituloSecao, Vazio } from '../components/ui';
import { Avatar } from '../components/Social';
import { useAvisos } from '../components/Notificacoes';
import { useAuth } from '../lib/auth';

export default function Amigos() {
  const queryClient = useQueryClient();
  const { usuario } = useAuth();
  const { sucesso, erro: avisarErro } = useAvisos();

  const [apelido, setApelido] = useState('');
  const [removendo, setRemovendo] = useState<Amizade | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['amigos'],
    queryFn: () => apiGet<ListaDeAmigos>('/amigos'),
  });

  const atualizar = () => queryClient.invalidateQueries({ queryKey: ['amigos'] });

  const convidar = useMutation({
    mutationFn: () => apiPost<{ status: string }>('/amigos', { username: apelido.trim() }),
    onSuccess: async (resposta) => {
      await atualizar();
      setApelido('');
      sucesso(
        resposta.status === 'aceita'
          ? 'Vocês já são amigos! A pessoa também tinha te convidado.'
          : 'Convite enviado — falta a outra pessoa aceitar.',
      );
    },
    onError: (e) => avisarErro(e instanceof ErroApi ? e.message : 'Não foi possível enviar o convite'),
  });

  const aceitar = useMutation({
    mutationFn: (id: string) => apiPost(`/amigos/${id}/aceitar`),
    onSuccess: async () => {
      await atualizar();
      sucesso('Agora vocês são amigos no app');
    },
  });

  const remover = useMutation({
    mutationFn: (id: string) => apiDelete(`/amigos/${id}`),
    onSuccess: async () => {
      await atualizar();
      setRemovendo(null);
    },
  });

  const copiar = async () => {
    if (!usuario?.username) return;
    try {
      await navigator.clipboard.writeText(`@${usuario.username}`);
      sucesso('Nome de usuário copiado');
    } catch {
      avisarErro(`Copie manualmente: @${usuario.username}`);
    }
  };

  const compartilhar = async () => {
    if (!usuario?.username) return;
    const texto = `Me adiciona no app de treinos: @${usuario.username}`;
    if (navigator.share) {
      try {
        await navigator.share({ text: texto });
        return;
      } catch {
        /* a pessoa cancelou */
      }
    }
    void copiar();
  };

  if (isLoading) return <Carregando texto="Carregando seus amigos…" />;

  const { amigos = [], recebidos = [], enviados = [] } = data ?? {};

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">Amigos</h1>
        <p className="mt-1 text-sm text-texto-suave">
          Adicione quem treina com você para montarem grupos e acompanharem os treinos uns dos outros.
        </p>
      </div>

      <Cartao className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold">Seu nome de usuário</h2>
            <p className="mt-0.5 text-sm text-texto-suave">É isso que você passa para a galera te achar.</p>
          </div>
          <Link to="/app/configuracoes" className="shrink-0 text-sm font-medium text-primaria">
            Mudar
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-xl border border-borda bg-superficie-2 px-4 py-3 text-lg font-bold">
            @{usuario?.username ?? '…'}
          </code>
          <Botao variante="secundario" icone={<Copy size={18} />} onClick={copiar} aria-label="Copiar seu nome de usuário" />
          <Botao variante="secundario" icone={<Share2 size={18} />} onClick={compartilhar} aria-label="Compartilhar seu nome de usuário" />
        </div>
      </Cartao>

      <Cartao className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold">Adicionar amigo</h2>
          <p className="mt-0.5 text-sm text-texto-suave">
            Digite o nome de usuário da pessoa. Não precisa do @.
          </p>
        </div>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (apelido.trim()) convidar.mutate();
          }}
        >
          <Campo
            rotulo="Nome de usuário do amigo"
            name="nome-de-usuario-do-amigo"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="brunolima"
            value={apelido}
            onChange={(e) => setApelido(e.target.value)}
          />
          <Botao
            type="submit"
            icone={<UserPlus size={18} />}
            carregando={convidar.isPending}
            disabled={!apelido.trim()}
            className="sm:mt-[26px] sm:shrink-0"
          >
            Convidar
          </Botao>
        </form>
      </Cartao>

      {recebidos.length > 0 && (
        <section>
          <TituloSecao titulo="Convites recebidos" descricao="Alguém quer treinar junto com você." />
          <div className="flex flex-col gap-2">
            {recebidos.map((convite) => (
              <Cartao key={convite.id} className="flex items-center gap-3">
                <Avatar pessoa={convite.pessoa} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{convite.pessoa.name}</p>
                  <p className="truncate text-xs text-texto-suave">
                    @{convite.pessoa.username} · {formatarDataRelativa(convite.desde)}
                  </p>
                </div>
                <Botao
                  tamanho="sm"
                  icone={<Check size={16} />}
                  onClick={() => aceitar.mutate(convite.id)}
                  carregando={aceitar.isPending && aceitar.variables === convite.id}
                >
                  Aceitar
                </Botao>
                <Botao
                  tamanho="sm"
                  variante="secundario"
                  icone={<X size={16} />}
                  aria-label={`Recusar convite de ${convite.pessoa.name}`}
                  onClick={() => remover.mutate(convite.id)}
                />
              </Cartao>
            ))}
          </div>
        </section>
      )}

      <section>
        <TituloSecao titulo="Seus amigos" acao={amigos.length > 0 ? <span className="text-sm text-texto-suave">{amigos.length}</span> : undefined} />
        {amigos.length === 0 ? (
          <Vazio
            icone={<Users size={32} />}
            titulo="Nenhum amigo por aqui ainda"
            descricao="Convide alguém pelo nome de usuário acima. Depois vocês podem criar um grupo e ver os treinos uns dos outros."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {amigos.map((amigo) => (
              <Cartao key={amigo.id} className="flex items-center gap-3">
                <Avatar pessoa={amigo.pessoa} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{amigo.pessoa.name}</p>
                  <p className="truncate text-xs text-texto-suave">
                    @{amigo.pessoa.username} · amigos desde {formatarDataRelativa(amigo.desde)}
                  </p>
                </div>
                <button
                  onClick={() => setRemovendo(amigo)}
                  className="rounded-lg p-2 text-texto-suave hover:text-perigo"
                  aria-label={`Desfazer amizade com ${amigo.pessoa.name}`}
                >
                  <UserMinus size={18} />
                </button>
              </Cartao>
            ))}
          </div>
        )}
      </section>

      {enviados.length > 0 && (
        <section>
          <TituloSecao titulo="Convites enviados" descricao="Aguardando a outra pessoa aceitar." />
          <div className="flex flex-col gap-2">
            {enviados.map((convite) => (
              <Cartao key={convite.id} className="flex items-center gap-3">
                <Avatar pessoa={convite.pessoa} tamanho="sm" />
                <p className="min-w-0 flex-1 truncate text-sm">
                  {convite.pessoa.name} <span className="text-texto-suave">@{convite.pessoa.username}</span>
                </p>
                <Botao tamanho="sm" variante="secundario" onClick={() => remover.mutate(convite.id)}>
                  Cancelar
                </Botao>
              </Cartao>
            ))}
          </div>
        </section>
      )}

      <Cartao className="text-sm text-texto-suave">
        Com os amigos adicionados, crie um{' '}
        <Link to="/app/grupos" className="font-medium text-primaria">
          grupo de treino
        </Link>{' '}
        — os treinos que vocês terminarem aparecem lá sozinhos.
      </Cartao>

      <ConfirmarAcao
        aberto={removendo !== null}
        titulo="Desfazer amizade?"
        mensagem={`${removendo?.pessoa.name ?? ''} sai da sua lista de amigos. Os grupos em que vocês estão juntos continuam como estão.`}
        textoConfirmar="Desfazer"
        perigoso
        carregando={remover.isPending}
        aoConfirmar={() => removendo && remover.mutate(removendo.id)}
        aoCancelar={() => setRemovendo(null)}
      />
    </div>
  );
}
