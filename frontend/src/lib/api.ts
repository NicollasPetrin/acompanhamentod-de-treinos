import type { Sessao } from './tipos';

const CHAVE_SESSAO = 'treinos.sessao';

/** Erro vindo da API, já com a mensagem pronta para exibir ao usuário. */
export class ErroApi extends Error {
  status: number;
  codigo: string;
  campos?: Record<string, string[]>;
  detalhes?: unknown;

  constructor(status: number, mensagem: string, codigo = 'erro', campos?: Record<string, string[]>, detalhes?: unknown) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
    this.campos = campos;
    this.detalhes = detalhes;
  }

  /** Erro de rede/offline — o app continua funcionando com dados locais. */
  get offline() {
    return this.status === 0;
  }
}

export const lerSessao = (): Sessao | null => {
  try {
    const bruto = localStorage.getItem(CHAVE_SESSAO);
    return bruto ? (JSON.parse(bruto) as Sessao) : null;
  } catch {
    return null;
  }
};

export const salvarSessao = (sessao: Sessao | null) => {
  if (sessao) localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
  else localStorage.removeItem(CHAVE_SESSAO);
  ouvintes.forEach((fn) => fn(sessao));
};

type Ouvinte = (sessao: Sessao | null) => void;
const ouvintes = new Set<Ouvinte>();

/** Permite ao AuthProvider reagir a logout automático (refresh token expirado). */
export const aoMudarSessao = (fn: Ouvinte) => {
  ouvintes.add(fn);
  return () => {
    ouvintes.delete(fn);
  };
};

interface Opcoes extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Rotas públicas (login, cadastro, rotina compartilhada) não enviam token. */
  publico?: boolean;
}

let renovacaoEmAndamento: Promise<string | null> | null = null;

/** Renova o access token usando o refresh token (uma renovação por vez). */
async function renovarToken(): Promise<string | null> {
  if (renovacaoEmAndamento) return renovacaoEmAndamento;

  renovacaoEmAndamento = (async () => {
    const sessao = lerSessao();
    if (!sessao?.refreshToken) return null;

    try {
      const resposta = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: sessao.refreshToken }),
      });
      if (!resposta.ok) {
        salvarSessao(null);
        return null;
      }
      const nova = (await resposta.json()) as Sessao;
      salvarSessao(nova);
      return nova.accessToken;
    } catch {
      // Sem internet: mantém a sessão e deixa o app seguir no modo offline
      return null;
    } finally {
      renovacaoEmAndamento = null;
    }
  })();

  return renovacaoEmAndamento;
}

/**
 * Cliente HTTP da aplicação: injeta o token, converte JSON, padroniza erros e
 * renova o access token automaticamente quando ele expira.
 */
export async function api<T>(caminho: string, opcoes: Opcoes = {}): Promise<T> {
  const { body, publico, headers, ...resto } = opcoes;

  const enviar = async (token?: string | null): Promise<Response> => {
    const cabecalhos: Record<string, string> = { ...(headers as Record<string, string>) };
    const ehFormData = body instanceof FormData;
    if (body !== undefined && !ehFormData) cabecalhos['Content-Type'] = 'application/json';
    if (token) cabecalhos.Authorization = `Bearer ${token}`;

    return fetch(`/api${caminho}`, {
      ...resto,
      headers: cabecalhos,
      body: body === undefined ? undefined : ehFormData ? body : JSON.stringify(body),
    });
  };

  let resposta: Response;
  const token = publico ? null : lerSessao()?.accessToken;

  try {
    resposta = await enviar(token);
  } catch {
    throw new ErroApi(0, 'Sem conexão com o servidor', 'offline');
  }

  // Access token expirado → renova uma vez e repete a requisição
  if (resposta.status === 401 && !publico) {
    const novoToken = await renovarToken();
    if (novoToken) {
      try {
        resposta = await enviar(novoToken);
      } catch {
        throw new ErroApi(0, 'Sem conexão com o servidor', 'offline');
      }
    }
  }

  if (resposta.status === 204) return undefined as T;

  const tipo = resposta.headers.get('content-type') ?? '';
  const dados = tipo.includes('application/json') ? await resposta.json() : await resposta.text();

  if (!resposta.ok) {
    const erro = (dados as { erro?: { mensagem?: string; codigo?: string; campos?: Record<string, string[]>; detalhes?: unknown } })?.erro;
    throw new ErroApi(
      resposta.status,
      erro?.mensagem ?? 'Não foi possível completar a operação',
      erro?.codigo ?? 'erro',
      erro?.campos,
      erro?.detalhes,
    );
  }

  return dados as T;
}

export const apiGet = <T>(caminho: string, opcoes?: Opcoes) => api<T>(caminho, { ...opcoes, method: 'GET' });
export const apiPost = <T>(caminho: string, body?: unknown, opcoes?: Opcoes) =>
  api<T>(caminho, { ...opcoes, method: 'POST', body });
export const apiPatch = <T>(caminho: string, body?: unknown, opcoes?: Opcoes) =>
  api<T>(caminho, { ...opcoes, method: 'PATCH', body });
export const apiDelete = <T>(caminho: string, body?: unknown, opcoes?: Opcoes) =>
  api<T>(caminho, { ...opcoes, method: 'DELETE', body });
