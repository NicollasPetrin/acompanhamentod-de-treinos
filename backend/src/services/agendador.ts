/**
 * Notificações com hora marcada.
 *
 * O fim do descanso precisa chegar no celular na hora certa, com o app
 * fechado. Quem manda é o servidor — mas "daqui a 90 segundos" depende de onde
 * ele roda:
 *
 * - **processo**: servidor que fica ligado (sua máquina, Render). Um timer
 *   comum resolve, e na subida as pendências são reagendadas.
 * - **qstash**: hospedagem sem servidor (Vercel). O processo dorme entre uma
 *   requisição e outra, então um timer não dispara. O QStash, da Upstash, guarda
 *   o pedido e chama a API de volta na hora marcada.
 *
 * Nos dois casos quem envia de fato é `dispararNotificacao`, que só manda uma
 * vez: ela "reserva" o envio no banco antes de mandar.
 */
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { env } from '../env';
import { enviarParaUsuario } from './push';

/**
 * - qstash: agenda de verdade, em qualquer hospedagem.
 * - processo: servidor que fica ligado; o timer local resolve.
 * - sem-agendador: Vercel sem QStash. O timer local ainda é armado, mas o
 *   processo pode dormir antes da hora — o aviso de fim de descanso com o app
 *   fechado fica incerto. O de "treino em andamento", que é imediato, funciona.
 */
export type ModoAgendamento = 'qstash' | 'processo' | 'sem-agendador';

export function modoAgendamento(): ModoAgendamento {
  if (env.QSTASH_TOKEN && env.API_PUBLIC_URL) return 'qstash';
  return process.env.VERCEL ? 'sem-agendador' : 'processo';
}

const timers = new Map<string, NodeJS.Timeout>();

/** Endereço que o QStash chama na hora de enviar. */
export function urlDeDisparo(id: string): string {
  return `${(env.API_PUBLIC_URL ?? '').replace(/\/$/, '')}/api/notificacoes/disparar/${id}`;
}

/** Marca o envio para `sendAt`, no modo em que o servidor estiver. */
export async function agendarNotificacao(notificacao: { id: string; sendAt: Date }): Promise<void> {
  if (modoAgendamento() === 'qstash') {
    const resposta = await fetch(`${env.QSTASH_URL.replace(/\/$/, '')}/v2/publish/${urlDeDisparo(notificacao.id)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.QSTASH_TOKEN}`,
        'Content-Type': 'application/json',
        'Upstash-Not-Before': String(Math.floor(notificacao.sendAt.getTime() / 1000)),
        'Upstash-Retries': '2',
      },
      body: JSON.stringify({ id: notificacao.id }),
    });
    if (!resposta.ok) {
      throw new Error(`QStash recusou o agendamento (${resposta.status}): ${await resposta.text()}`);
    }
    return;
  }

  esquecerTimer(notificacao.id);
  const atraso = Math.max(0, notificacao.sendAt.getTime() - Date.now());
  const timer = setTimeout(() => {
    timers.delete(notificacao.id);
    void dispararNotificacao(notificacao.id).catch((e) => console.warn('⚠️ Falha ao disparar notificação:', e));
  }, atraso);
  // Um timer pendente não segura o processo aberto (testes, desligamento)
  timer.unref?.();
  timers.set(notificacao.id, timer);
}

/** Cancela o timer local, se houver. O que já está no banco é cancelado lá. */
export function esquecerTimer(id: string) {
  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  timers.delete(id);
}

/**
 * Envia a notificação, se ela ainda estiver valendo. A reserva no banco
 * (`sentAt` preenchido numa única atualização condicional) garante que dois
 * disparos — o QStash repetindo, dois processos — não mandem em dobro.
 */
export async function dispararNotificacao(id: string): Promise<'enviada' | 'ignorada'> {
  const agora = new Date();
  const { count } = await prisma.scheduledNotification.updateMany({
    where: {
      id,
      sentAt: null,
      canceledAt: null,
      // pequena folga: o QStash pode chegar um instante antes do segundo exato
      sendAt: { lte: new Date(agora.getTime() + 5000) },
    },
    data: { sentAt: agora },
  });
  if (count === 0) return 'ignorada';

  const n = await prisma.scheduledNotification.findUniqueOrThrow({ where: { id } });
  await enviarParaUsuario(n.userId, { titulo: n.title, corpo: n.body, url: n.url, etiqueta: 'treino' });
  return 'enviada';
}

/** Na subida de um servidor que fica ligado, retoma o que estava marcado. */
export async function reagendarPendentes(): Promise<number> {
  if (modoAgendamento() === 'qstash') return 0;
  const pendentes = await prisma.scheduledNotification.findMany({
    where: { sentAt: null, canceledAt: null, sendAt: { gte: new Date(Date.now() - 60_000) } },
    select: { id: true, sendAt: true },
  });
  for (const p of pendentes) await agendarNotificacao(p);
  return pendentes.length;
}

/**
 * Confere se a chamada veio mesmo do QStash: ele assina cada entrega com um
 * JWT (HS256) cujo `body` é o hash do corpo e cujo `sub` é o endereço chamado.
 * Aceita a chave atual e a próxima, que a Upstash usa durante a troca.
 */
export function assinaturaDoQstashValida(assinatura: string | undefined, corpo: Buffer, url: string): boolean {
  if (!assinatura) return false;
  const chaves = [env.QSTASH_CURRENT_SIGNING_KEY, env.QSTASH_NEXT_SIGNING_KEY].filter(Boolean) as string[];
  const hashDoCorpo = crypto.createHash('sha256').update(corpo).digest('base64url');

  for (const chave of chaves) {
    try {
      const conteudo = jwt.verify(assinatura, chave, { algorithms: ['HS256'], issuer: 'Upstash' }) as jwt.JwtPayload;
      const hashAssinado = String(conteudo.body ?? '').replace(/=+$/, '');
      if (conteudo.sub === url && hashAssinado === hashDoCorpo) return true;
    } catch {
      /* tenta a próxima chave */
    }
  }
  return false;
}
