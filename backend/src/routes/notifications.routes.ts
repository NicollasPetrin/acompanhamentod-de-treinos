import { Router, type Request } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, userId } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { badRequest, forbidden } from '../lib/errors';
import { fusoDoUsuario, relogioLocal } from '../lib/datas';
import { chavesVapid, enviarParaUsuario } from '../services/push';
import {
  agendarNotificacao,
  assinaturaDoQstashValida,
  dispararNotificacao,
  esquecerTimer,
  modoAgendamento,
  urlDeDisparo,
} from '../services/agendador';

export const notificationsRouter = Router();

/** Corpo cru da requisição, guardado pelo express.json para conferir assinaturas. */
type RequestComCorpo = Request & { corpoBruto?: Buffer };

/**
 * POST /api/notificacoes/disparar/:id — chamado pelo QStash na hora marcada.
 * Fica antes do requireAuth: quem chama é o agendador, não uma pessoa. A
 * assinatura do QStash é obrigatória; sem ela, ninguém de fora dispara nada.
 */
notificationsRouter.post('/disparar/:id', async (req, res, next) => {
  try {
    if (modoAgendamento() !== 'qstash') throw forbidden('Disparo externo desativado');
    const valida = assinaturaDoQstashValida(
      req.header('upstash-signature'),
      (req as RequestComCorpo).corpoBruto ?? Buffer.from(''),
      urlDeDisparo(req.params.id),
    );
    if (!valida) throw forbidden('Assinatura inválida');

    res.json({ resultado: await dispararNotificacao(req.params.id) });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.use(requireAuth);

/** GET /api/notificacoes/chave — chave pública para o aparelho se inscrever. */
notificationsRouter.get('/chave', async (_req, res, next) => {
  try {
    const { publicKey } = await chavesVapid();
    res.json({ publicKey, agendamento: modoAgendamento() });
  } catch (err) {
    next(err);
  }
});

const inscricaoSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

/** POST /api/notificacoes/inscricao — este aparelho passa a receber avisos. */
notificationsRouter.post('/inscricao', validate(inscricaoSchema), async (req, res, next) => {
  try {
    const uid = userId(req);
    const { endpoint, keys } = req.body as z.infer<typeof inscricaoSchema>;
    await prisma.pushSubscription.upsert({
      where: { userId_endpoint: { userId: uid, endpoint } },
      create: {
        userId: uid,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: req.header('user-agent')?.slice(0, 200),
      },
      update: { p256dh: keys.p256dh, auth: keys.auth },
    });
    res.status(201).json({ inscrito: true });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/notificacoes/inscricao — este aparelho para de receber. */
notificationsRouter.delete(
  '/inscricao',
  validate(z.object({ endpoint: z.string().url().max(1000) })),
  async (req, res, next) => {
    try {
      await prisma.pushSubscription.deleteMany({
        where: { userId: userId(req), endpoint: (req.body as { endpoint: string }).endpoint },
      });
      res.json({ inscrito: false });
    } catch (err) {
      next(err);
    }
  },
);

/** Cancela o aviso de descanso que estiver marcado para a pessoa. */
async function cancelarDescansos(uid: string) {
  const pendentes = await prisma.scheduledNotification.findMany({
    where: { userId: uid, kind: 'descanso', sentAt: null, canceledAt: null },
    select: { id: true },
  });
  if (pendentes.length === 0) return 0;
  await prisma.scheduledNotification.updateMany({
    where: { id: { in: pendentes.map((p) => p.id) } },
    data: { canceledAt: new Date() },
  });
  pendentes.forEach((p) => esquecerTimer(p.id));
  return pendentes.length;
}

/** "18:42" no fuso da pessoa, para a notificação falar a língua dela. */
function horaNoFuso(data: Date, fuso: string) {
  const r = relogioLocal(data, fuso);
  return `${String(r.hora).padStart(2, '0')}:${String(r.minuto).padStart(2, '0')}`;
}

const saidaSchema = z.object({
  /** Nome do treino em andamento. */
  nome: z.string().trim().min(1).max(120),
  /** Tela para voltar ao tocar. */
  url: z.string().startsWith('/').max(200).default('/app/treino'),
  seriesFeitas: z.number().int().min(0).max(500).optional(),
  seriesTotal: z.number().int().min(0).max(500).optional(),
  /** Avisar que o app ficou para trás com um treino aberto. */
  retomada: z.boolean().default(true),
  /** Fim do descanso em andamento, se houver (epoch ms ou ISO). */
  descansoTerminaEm: z.coerce.date().optional(),
  exercicio: z.string().trim().max(120).optional(),
});

/**
 * POST /api/notificacoes/saida — o app saiu da tela no meio do treino.
 *
 * Chamado pelo próprio app quando some da tela (bloqueou o celular, trocou de
 * app, fechou). Ele manda na hora o aviso de "treino em andamento" e marca o
 * de "descanso acabou" para o fim do descanso. Com o app na tela nada disso
 * acontece: lá quem avisa é o som e a vibração do próprio cronômetro.
 */
notificationsRouter.post('/saida', validate(saidaSchema), async (req, res, next) => {
  try {
    const uid = userId(req);
    const dados = req.body as z.infer<typeof saidaSchema>;
    const fuso = await fusoDoUsuario(uid);
    await cancelarDescansos(uid);

    const agora = Date.now();
    // Descanso que ainda não acabou merece o aviso, mesmo faltando 1 segundo
    const fimDoDescanso = dados.descansoTerminaEm && dados.descansoTerminaEm.getTime() > agora + 500
      ? dados.descansoTerminaEm
      : null;
    if (fimDoDescanso && fimDoDescanso.getTime() > agora + 2 * 60 * 60 * 1000) {
      throw badRequest('Descanso longo demais');
    }

    let retomada = 0;
    if (dados.retomada) {
      const progresso =
        dados.seriesTotal !== undefined ? `${dados.seriesFeitas ?? 0} de ${dados.seriesTotal} séries` : null;
      const corpo = fimDoDescanso
        ? `Descanso até ${horaNoFuso(fimDoDescanso, fuso)}${progresso ? ` · ${progresso}` : ''}. Toque para voltar.`
        : `${progresso ? `${progresso}. ` : ''}Toque para continuar de onde parou.`;
      retomada = await enviarParaUsuario(uid, {
        titulo: `Treino em andamento — ${dados.nome}`,
        corpo,
        url: dados.url,
        etiqueta: 'treino',
        // aparece toda vez que a tela apaga: fica na tela de bloqueio sem apitar
        silenciosa: true,
      });
    }

    let descansoAgendado = false;
    if (fimDoDescanso) {
      const notificacao = await prisma.scheduledNotification.create({
        data: {
          userId: uid,
          kind: 'descanso',
          sendAt: fimDoDescanso,
          title: 'Descanso acabou',
          body: dados.exercicio ? `Hora da próxima série de ${dados.exercicio}.` : 'Hora da próxima série.',
          url: dados.url,
        },
      });
      await agendarNotificacao(notificacao);
      descansoAgendado = true;
    }

    res.json({ retomada, descansoAgendado, agendamento: modoAgendamento() });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/notificacoes/saida — o app voltou para a tela. O aviso de fim do
 * descanso deixa de fazer sentido: o cronômetro na tela cuida disso.
 */
notificationsRouter.delete('/saida', async (req, res, next) => {
  try {
    res.json({ cancelados: await cancelarDescansos(userId(req)) });
  } catch (err) {
    next(err);
  }
});

/** POST /api/notificacoes/teste — manda uma notificação agora, para conferir. */
notificationsRouter.post('/teste', async (req, res, next) => {
  try {
    const entregues = await enviarParaUsuario(userId(req), {
      titulo: 'Notificações ligadas 💪',
      corpo: 'É assim que você vai saber que o descanso acabou.',
      url: '/app/configuracoes',
      etiqueta: 'teste',
    });
    res.json({ entregues });
  } catch (err) {
    next(err);
  }
});
