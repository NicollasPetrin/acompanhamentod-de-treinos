/**
 * Notificações do treino.
 *
 * Duas notificações, as duas pensadas para quando o app NÃO está na tela:
 *
 * - **Treino em andamento** — ao bloquear o celular ou trocar de app no meio do
 *   treino. Fica na tela de bloqueio, sem apitar, e um toque volta para o
 *   treino. Durante o descanso ela diz até que horas ele vai.
 * - **Descanso acabou** — na hora em que o descanso termina, com som.
 *
 * Com o app aberto nada disso aparece: quem avisa é o próprio cronômetro, com
 * som e vibração. Por isso tudo é disparado pelo servidor (Web Push) no momento
 * em que o app some da tela, e cancelado quando ele volta.
 */
import { useEffect, useRef } from 'react';
import { api, apiGet, apiPost, garantirTokenFresco, ErroApi } from './api';
import type { EstadoDescanso } from './descanso';

export interface PreferenciasNotificacao {
  /** Notificações ligadas neste aparelho, para esta conta. */
  ligado: boolean;
  descanso: boolean;
  retomada: boolean;
}

const PADRAO: PreferenciasNotificacao = { ligado: false, descanso: true, retomada: true };
const chave = (userId: string) => `treinos.notificacoes.${userId}`;

export function lerPreferencias(userId: string): PreferenciasNotificacao {
  try {
    const bruto = localStorage.getItem(chave(userId));
    return bruto ? { ...PADRAO, ...(JSON.parse(bruto) as Partial<PreferenciasNotificacao>) } : PADRAO;
  } catch {
    return PADRAO;
  }
}

export function salvarPreferencias(userId: string, prefs: PreferenciasNotificacao) {
  try {
    localStorage.setItem(chave(userId), JSON.stringify(prefs));
  } catch {
    /* navegação privada */
  }
}

/** O navegador tem tudo o que precisa para receber notificações com o app fechado. */
export const suportaNotificacoes = () =>
  typeof window !== 'undefined' &&
  'Notification' in window &&
  'serviceWorker' in navigator &&
  'PushManager' in window;

/**
 * No iPhone, notificação só existe com o app instalado na Tela de Início —
 * aberto como aba do Safari, o navegador nem oferece a opção.
 */
export const ehIphoneForaDoApp = () => {
  if (typeof navigator === 'undefined') return false;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const instalado =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches;
  return ios && !instalado;
};

export type EstadoNotificacoes = 'nao-suportado' | 'instalar-primeiro' | 'bloqueado' | 'desligado' | 'ligado';

export async function estadoNotificacoes(userId: string): Promise<EstadoNotificacoes> {
  if (!suportaNotificacoes()) return ehIphoneForaDoApp() ? 'instalar-primeiro' : 'nao-suportado';
  if (Notification.permission === 'denied') return 'bloqueado';
  if (Notification.permission !== 'granted') return 'desligado';
  if (!lerPreferencias(userId).ligado) return 'desligado';
  const registro = await navigator.serviceWorker.getRegistration();
  const inscricao = await registro?.pushManager.getSubscription();
  return inscricao ? 'ligado' : 'desligado';
}

/** A chave do servidor chega em base64url; o navegador quer os bytes. */
function paraBytes(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=');
  const binario = atob(base64);
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

function mesmaChave(inscricao: PushSubscription, chavePublica: string): boolean {
  const atual = inscricao.options?.applicationServerKey;
  if (!atual) return true; // navegador não diz — assume que é a mesma
  const esperada = paraBytes(chavePublica);
  const bytes = new Uint8Array(atual);
  return bytes.length === esperada.length && bytes.every((b, i) => b === esperada[i]);
}

/**
 * Liga as notificações neste aparelho. PRECISA ser chamada direto de um toque:
 * o iPhone só mostra a pergunta de permissão em resposta a um gesto — por isso
 * o pedido de permissão é a primeira coisa, antes de qualquer espera.
 */
export async function ligarNotificacoes(userId: string): Promise<EstadoNotificacoes> {
  if (!suportaNotificacoes()) return ehIphoneForaDoApp() ? 'instalar-primeiro' : 'nao-suportado';

  const permissao = await Notification.requestPermission();
  if (permissao === 'denied') return 'bloqueado';
  if (permissao !== 'granted') return 'desligado';

  const registro = await navigator.serviceWorker.ready;
  const { publicKey } = await apiGet<{ publicKey: string }>('/notificacoes/chave');

  let inscricao = await registro.pushManager.getSubscription();
  if (inscricao && !mesmaChave(inscricao, publicKey)) {
    await inscricao.unsubscribe();
    inscricao = null;
  }
  inscricao ??= await registro.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: paraBytes(publicKey) as BufferSource,
  });

  await apiPost('/notificacoes/inscricao', inscricao.toJSON());
  salvarPreferencias(userId, { ...lerPreferencias(userId), ligado: true });
  return 'ligado';
}

/**
 * Desliga para esta conta. A inscrição do navegador continua: com treino em
 * dupla, a outra conta do mesmo celular segue recebendo as dela.
 */
export async function desligarNotificacoes(userId: string): Promise<void> {
  salvarPreferencias(userId, { ...lerPreferencias(userId), ligado: false });
  const registro = await navigator.serviceWorker?.getRegistration();
  const inscricao = await registro?.pushManager.getSubscription();
  if (inscricao) {
    await api('/notificacoes/inscricao', { method: 'DELETE', body: { endpoint: inscricao.endpoint } }).catch(() => undefined);
  }
}

export async function enviarTeste(): Promise<number> {
  const { entregues } = await apiPost<{ entregues: number }>('/notificacoes/teste');
  return entregues;
}

/** Tira da bandeja as notificações do treino — o app já está na tela. */
async function limparNotificacoesDoTreino() {
  try {
    const registro = await navigator.serviceWorker?.getRegistration();
    const abertas = (await registro?.getNotifications({ tag: 'treino' })) ?? [];
    abertas.forEach((n) => n.close());
  } catch {
    /* navegador sem suporte a listar notificações */
  }
}

interface DadosDoTreino {
  userId: string;
  /** Nulo quando não há treino aberto — nada é enviado. */
  nome: string | null;
  url: string;
  seriesFeitas: number;
  seriesTotal: number;
  descanso: EstadoDescanso | null;
}

/**
 * Liga as notificações à tela do treino: avisa o servidor quando o app sai da
 * tela e cancela quando volta. Os dados mais recentes ficam numa ref, porque
 * o aviso de saída é mandado de dentro de um evento do navegador.
 */
export function useNotificacoesDoTreino(dados: DadosDoTreino) {
  const atual = useRef(dados);
  atual.current = dados;

  useEffect(() => {
    if (!dados.userId || !suportaNotificacoes()) return;

    let saiu = false;
    // O cancelamento na volta espera o aviso de saída terminar: numa volta
    // rápida, ele não pode chegar ao servidor antes do próprio aviso
    let saida: Promise<unknown> = Promise.resolve();

    const aoMudarVisibilidade = () => {
      const d = atual.current;
      const prefs = lerPreferencias(d.userId);
      if (!prefs.ligado || !d.nome || Notification.permission !== 'granted') return;

      if (document.visibilityState === 'hidden') {
        const descansoValendo =
          prefs.descanso && d.descanso?.terminaEm && !d.descanso.avisado && d.descanso.terminaEm > Date.now();
        saiu = true;
        const corpo = {
          nome: d.nome,
          url: d.url,
          seriesFeitas: d.seriesFeitas,
          seriesTotal: d.seriesTotal,
          retomada: prefs.retomada,
          ...(descansoValendo
            ? { descansoTerminaEm: new Date(d.descanso!.terminaEm!).toISOString(), exercicio: d.descanso!.exercicio }
            : {}),
        };
        const avisar = (keepalive: boolean) =>
          api('/notificacoes/saida', { method: 'POST', keepalive, body: corpo });
        // keepalive: a requisição sobrevive ao app ser suspenso logo em seguida.
        // Navegador que não aceita keepalive com o token (pedido pré-CORS) recusa
        // na hora — aí vai uma requisição comum, que ainda dá tempo de sair.
        saida = avisar(true)
          .catch((e) => (e instanceof ErroApi && e.offline ? avisar(false) : undefined))
          .catch(() => undefined);
        return;
      }

      // Voltou: o cronômetro da tela assume, e a bandeja fica limpa
      void limparNotificacoesDoTreino();
      if (saiu) {
        saiu = false;
        void saida.then(() => api('/notificacoes/saida', { method: 'DELETE' })).catch(() => undefined);
      }
      void garantirTokenFresco().catch(() => undefined);
    };

    document.addEventListener('visibilitychange', aoMudarVisibilidade);
    // O token precisa estar em dia no momento em que o app sair da tela
    void garantirTokenFresco().catch(() => undefined);
    const renovacao = setInterval(() => void garantirTokenFresco().catch(() => undefined), 4 * 60 * 1000);

    return () => {
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
      clearInterval(renovacao);
    };
  }, [dados.userId]);
}
