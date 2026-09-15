import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, aoMudarSessao, lerSessao, listarContas, salvarSessao, trocarConta, ErroApi } from './api';
import { apagarRascunho, limparCacheDaApi, sincronizarPendentes } from './offline';
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
  aplicarTema: (tema: Tema) => void;
}

const Contexto = createContext<ContextoAuth | null>(null);

/** Aplica o tema no <html> — precisa acontecer antes da primeira pintura. */
export function aplicarTemaNoDocumento(tema: Tema) {
  document.documentElement.dataset.tema = tema;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', tema === 'dark' ? '#0b0f14' : '#f6f8fa');
  localStorage.setItem('treinos.tema', tema);
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
        aplicarTemaNoDocumento(atual.theme);
        const sessao = lerSessao();
        if (sessao) salvarSessao({ ...sessao, usuario: atual });
        void sincronizarPendentes(atual.id);
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
    aplicarTemaNoDocumento(sessao.usuario.theme);
    void sincronizarPendentes(sessao.usuario.id);
  }, [limparDadosDaSessaoAnterior]);

  const cadastrar = useCallback(async (nome: string, email: string, senha: string) => {
    const sessao = await apiPost<Sessao>('/auth/registrar', { name: nome, email, password: senha }, { publico: true });
    await limparDadosDaSessaoAnterior();
    salvarSessao(sessao);
    setUsuario(sessao.usuario);
    aplicarTemaNoDocumento(sessao.usuario.theme);
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
      aplicarTemaNoDocumento(restante.usuario.theme);
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
      aplicarTemaNoDocumento(conta.usuario.theme);
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
