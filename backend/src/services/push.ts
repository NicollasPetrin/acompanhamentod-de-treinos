/**
 * Envio de notificações pelo Web Push — o padrão que o iPhone (iOS 16.4+, com
 * o app na Tela de Início), o Android e os navegadores de computador aceitam.
 *
 * É o único jeito de avisar alguém com o app fechado: o celular recebe a
 * mensagem do serviço de push da Apple/Google e mostra a notificação mesmo
 * sem o app estar rodando.
 */
import webpush from 'web-push';
import { prisma } from '../lib/prisma';
import { env } from '../env';

interface ChavesVapid {
  publicKey: string;
  privateKey: string;
}

let chavesEmMemoria: ChavesVapid | null = null;

/**
 * Chaves que identificam este servidor para os serviços de push.
 *
 * Se não vierem por variável de ambiente, são geradas uma única vez e ficam
 * no banco — assim ninguém precisa configurar nada para as notificações
 * funcionarem. Trocar as chaves invalida as inscrições já feitas, por isso
 * elas nunca são regeradas depois de gravadas.
 */
export async function chavesVapid(): Promise<ChavesVapid> {
  if (chavesEmMemoria) return chavesEmMemoria;

  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    chavesEmMemoria = { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
    return chavesEmMemoria;
  }

  const salvas = await prisma.appConfig.findUnique({ where: { key: 'vapid' } });
  if (salvas) {
    chavesEmMemoria = JSON.parse(salvas.value) as ChavesVapid;
    return chavesEmMemoria;
  }

  // Duas instâncias podem chegar aqui ao mesmo tempo: a primeira a gravar
  // vence, e todas passam a usar o que ficou no banco.
  const geradas = webpush.generateVAPIDKeys();
  try {
    await prisma.appConfig.create({ data: { key: 'vapid', value: JSON.stringify(geradas) } });
  } catch {
    /* outra instância gravou antes */
  }
  const vencedoras = await prisma.appConfig.findUniqueOrThrow({ where: { key: 'vapid' } });
  chavesEmMemoria = JSON.parse(vencedoras.value) as ChavesVapid;
  return chavesEmMemoria;
}

/** O serviço de push da Apple exige um contato válido (mailto: ou https:). */
function contato(): string {
  if (env.VAPID_SUBJECT) return env.VAPID_SUBJECT;
  if (env.APP_URL.startsWith('https://')) return env.APP_URL;
  return 'mailto:contato@treinos.app';
}

/** O que vai dentro da notificação — o service worker do app monta a exibição. */
export interface CargaNotificacao {
  titulo: string;
  corpo: string;
  /** Tela que abre ao tocar. */
  url: string;
  /** Notificações com a mesma etiqueta se substituem em vez de empilhar. */
  etiqueta: string;
  /** Sem som nem vibração — para o aviso que aparece toda vez que a tela apaga. */
  silenciosa?: boolean;
}

/**
 * Manda a notificação para todos os aparelhos da pessoa. Aparelho que não
 * existe mais (app removido, permissão revogada) é apagado da lista.
 * Devolve quantos aparelhos receberam.
 */
export async function enviarParaUsuario(userId: string, carga: CargaNotificacao): Promise<number> {
  const inscricoes = await prisma.pushSubscription.findMany({ where: { userId } });
  if (inscricoes.length === 0) return 0;

  const { publicKey, privateKey } = await chavesVapid();
  const opcoes: webpush.RequestOptions = {
    vapidDetails: { subject: contato(), publicKey, privateKey },
    // Descanso que acabou há 10 minutos não interessa mais a ninguém
    TTL: 10 * 60,
    urgency: 'high',
  };

  const resultados = await Promise.allSettled(
    inscricoes.map((i) =>
      webpush.sendNotification(
        { endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } },
        JSON.stringify(carga),
        opcoes,
      ),
    ),
  );

  let entregues = 0;
  const mortas: string[] = [];
  resultados.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      entregues++;
      return;
    }
    const status = (r.reason as { statusCode?: number })?.statusCode;
    // 404/410: o serviço de push avisa que essa inscrição acabou
    if (status === 404 || status === 410) mortas.push(inscricoes[i].endpoint);
    else console.warn('⚠️ Falha ao enviar notificação:', status ?? (r.reason as Error)?.message);
  });

  if (mortas.length) await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: mortas } } });
  return entregues;
}
