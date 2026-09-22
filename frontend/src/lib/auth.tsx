import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch, apiPost, aoMudarSessao, lerSessao, listarContas, salvarSessao, trocarConta, ErroApi } from './api';
import { apagarRascunho, limparCacheDaApi, sincronizarPendentes } from './offline';
import { aplicarTema, ehCorValida, temaSalvo, type CorDestaque } from './tema';
import type { Sessao, Tema, Usuario } from './tipos';

interface ContextoAuth {
  usuario: Usuario | null;
  carregando: boolean;
  autenticado: boolean;
  /** Contas conectadas neste aparelho (treino em dupla). */
  contas: Usuario[];
  entrar: (email: string, senha: string, lembrar: boolean) => Promise<void>;
  cadastrar: (nome: string, email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
  trocarPara: (userId: string) => void | Promise<void>;
  atualizarUsuario: (usuario: Usuario) => void;
  aplicarTema: (tema: Tema, cor?: string) => void;
}

const Contexto = createContext<ContextoAuth | null>(null);

/**
 * Aplica as preferências visuais do usuário (tema + cor de destaque).
 * Precisa acontecer antes da primeira pintura, por isso também é chamada em
 * main.tsx com o que estiver salvo no aparelho.
 */
export function aplicarTemaNoDocumento(tema: Tema, cor?: string) {
  const escolhida: CorDestaque = ehCorValida(cor) ? cor : temaSalvo().cor;
  aplicarTema(tema, escolhida);
}

/**
 * Conta ao servidor em que fuso o aparelho está.
 *
 * O servidor roda em UTC; sem isto, um treino das 21h no Brasil seria contado
 * no dia seguinte no calendário, na sequência de dias e no resumo da semana.
 * Só chama a API quando o fuso mudou (viagem, celular novo), e falhar aqui não
 * pode atrapalhar nada — no pior caso vale o fuso padrão do app.
 */
async function avisarFuso(usuario: Usuario) {
  try {
    const doAparelho = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!doAparelho || doAparelho === usuario.timeZone) return;
    await apiPatch('/usuarios/eu/preferencias', { timeZone: doAparelho });
  } catch {
    /* sem rede ou fuso desconhecido: o servidor usa o padrão */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => lerSessao()?.usuario ?? null);
  const [carregando, setCarregando] = useState(true);
  const queryClient = useQueryClient();

  /**
   * Zera tudo que ficou em memória/cache da conta anterior. Sem isso, ao trocar
   * de usuário no mesmo aparelho a tela mostraria os dados de quem saiu.
   */
  const limparDadosDaSessaoAnterior = useCallback(async () => {
    queryClient.clear();
    await limparCacheDaApi();
  }, [queryClient]);

  // Revalida a sessão ao abrir o app (e sincroniza treinos pendentes)
  useEffect(() => {
    let ativo = true;

    (async () => {
      if (!lerSessao()) {
        setCarregando(false);
        return;
      }
      try {
        const atual = await apiGet<Usuario>('/usuarios/eu');
        if (!ativo) return;
        setUsuario(atual);
        aplicarTemaNoDocumento(atual.theme, atual.accentColor);
        const sessao = lerSessao();
        if (sessao) salvarSessao({ ...sessao, usuario: atual });
        void sincronizarPendentes(atual.id);
        void avisarFuso(atual);
      } catch (erro) {
        // Offline: seguimos com os dados salvos localmente
        if (erro instanceof ErroApi && !erro.offline && erro.status === 401) {
          salvarSessao(null);
          if (ativo) setUsuario(null);
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, []);

  // Logout automático quando o refresh token expira
  useEffect(() => aoMudarSessao((sessao) => setUsuario(sessao?.usuario ?? null)), []);

  const entrar = useCallback(async (email: string, senha: string, lembrar: boolean) => {
    const sessao = await apiPost<Sessao>('/auth/login', { email, password: senha, rememberMe: lembrar }, { publico: true });
    await limparDadosDaSessaoAnterior();
    salvarSessao(sessao);
    setUsuario(sessao.usuario);
    aplicarTemaNoDocumento(sessao.usuario.theme, sessao.usuario.accentColor);
    void sincronizarPendentes(sessao.usuario.id);
    void avisarFuso(sessao.usuario);
  }, [limparDadosDaSessaoAnterior]);

  const cadastrar = useCallback(async (nome: string, email: string, senha: string) => {
    const sessao = await apiPost<Sessao>('/auth/registrar', { name: nome, email, password: senha }, { publico: true });
    await limparDadosDaSessaoAnterior();
    salvarSessao(sessao);
    setUsuario(sessao.usuario);
    aplicarTemaNoDocumento(sessao.usuario.theme, sessao.usuario.accentColor);
    void avisarFuso(sessao.usuario);
  }, [limparDadosDaSessaoAnterior]);

  const sair = useCallback(async () => {
    const sessao = lerSessao();
    try {
      await apiPost('/auth/logout', { refreshToken: sessao?.refreshToken });
    } catch {
      /* sair localmente mesmo sem internet */
    }
    if (sessao) await apagarRascunho(sessao.usuario.id);
    await limparDadosDaSessaoAnterior();
    salvarSessao(null, true);

    // Se houver outra conta no aparelho, assume ela (treino em dupla)
    const restante = listarContas()[0];
    if (restante) {
      salvarSessao(restante);
      setUsuario(restante.usuario);
      aplicarTemaNoDocumento(restante.usuario.theme, restante.usuario.accentColor);
    } else {
      setUsuario(null);
    }
  }, [limparDadosDaSessaoAnterior]);

  /** Alterna para outra conta conectada; recarrega para limpar os caches. */
  const trocarPara = useCallback(
    async (userId: string) => {
      const conta = trocarConta(userId);
      if (!conta) return;
      await limparDadosDaSessaoAnterior();
      aplicarTemaNoDocumento(conta.usuario.theme, conta.usuario.accentColor);
      // Recarrega para garantir que nada da conta anterior sobreviva em memória
      window.location.assign('/app');
    },
    [limparDadosDaSessaoAnterior],
  );

  const valor = useMemo<ContextoAuth>(
    () => ({
      usuario,
      carregando,
      autenticado: Boolean(usuario),
      contas: listarContas().map((c) => c.usuario),
      entrar,
      cadastrar,
      sair,
      trocarPara,
      atualizarUsuario: (novo) => {
        setUsuario(novo);
        const sessao = lerSessao();
        if (sessao) salvarSessao({ ...sessao, usuario: novo });
      },
      aplicarTema: aplicarTemaNoDocumento,
    }),
    [usuario, carregando, entrar, cadastrar, sair, trocarPara],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAuth() {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return contexto;
}

/** Unidade de peso preferida do usuário (kg por padrão). */
export function useUnidade() {
  const { usuario } = useAuth();
  return usuario?.weightUnit ?? 'kg';
}
