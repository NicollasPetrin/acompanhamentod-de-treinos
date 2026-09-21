import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, userId } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors';
import { listarAmizades } from '../services/social';
import { normalizarUsername, TAMANHO_MAXIMO, TAMANHO_MINIMO } from '../lib/username';

export const friendsRouter = Router();
friendsRouter.use(requireAuth);

/** GET /api/amigos — amigos, convites recebidos e convites enviados. */
friendsRouter.get('/', async (req, res, next) => {
  try {
    res.json(await listarAmizades(userId(req)));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/amigos — envia convite de amizade pelo nome de usuário.
 *
 * Se a outra pessoa já tinha convidado você, o convite é aceito na hora: é o
 * que as duas queriam, e evita o vaivém de "convidei mas ele também convidou".
 */
friendsRouter.post(
  '/',
  validate(
    z.object({
      username: z
        .string()
        .trim()
        .min(1, 'Informe o nome de usuário')
        .max(TAMANHO_MAXIMO + 1, 'Nome de usuário muito longo'),
    }),
  ),
  async (req, res, next) => {
    try {
      const uid = userId(req);
      const username = normalizarUsername((req.body as { username: string }).username);
      if (username.length < TAMANHO_MINIMO) throw badRequest('Nome de usuário muito curto');

      const pessoa = await prisma.user.findUnique({
        where: { username },
        select: { id: true, name: true, username: true, photoUrl: true },
      });
      if (!pessoa) throw notFound(`Ninguém por aqui usa @${username}`);
      if (pessoa.id === uid) throw badRequest('Você não precisa se adicionar 🙂');

      const existente = await prisma.friendship.findFirst({
        where: {
          OR: [
            { requesterId: uid, addresseeId: pessoa.id },
            { requesterId: pessoa.id, addresseeId: uid },
          ],
        },
      });

      if (existente?.status === 'aceita') throw conflict('Vocês já são amigos');

      if (existente?.addresseeId === uid) {
        const aceita = await prisma.friendship.update({
          where: { id: existente.id },
          data: { status: 'aceita', respondedAt: new Date() },
        });
        return res.status(200).json({ id: aceita.id, status: aceita.status, pessoa });
      }

      if (existente) throw conflict('Convite já enviado — falta a outra pessoa aceitar');

      const amizade = await prisma.friendship.create({
        data: { requesterId: uid, addresseeId: pessoa.id },
      });
      res.status(201).json({ id: amizade.id, status: amizade.status, pessoa });
    } catch (err) {
      next(err);
    }
  },
);

/** POST /api/amigos/:id/aceitar — aceita um convite recebido. */
friendsRouter.post('/:id/aceitar', async (req, res, next) => {
  try {
    const uid = userId(req);
    const amizade = await prisma.friendship.findUnique({ where: { id: req.params.id } });
    if (!amizade) throw notFound('Convite não encontrado');
    if (amizade.addresseeId !== uid) throw forbidden('Este convite não é seu');
    if (amizade.status === 'aceita') return res.json({ id: amizade.id, status: amizade.status });

    const aceita = await prisma.friendship.update({
      where: { id: amizade.id },
      data: { status: 'aceita', respondedAt: new Date() },
    });
    res.json({ id: aceita.id, status: aceita.status });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/amigos/:id — recusa um convite recebido, cancela um que você
 * enviou ou desfaz a amizade. Qualquer um dos dois lados pode.
 */
friendsRouter.delete('/:id', async (req, res, next) => {
  try {
    const uid = userId(req);
    const amizade = await prisma.friendship.findUnique({ where: { id: req.params.id } });
    if (!amizade) throw notFound('Convite não encontrado');
    if (amizade.requesterId !== uid && amizade.addresseeId !== uid) throw forbidden();

    await prisma.friendship.delete({ where: { id: amizade.id } });
    res.json({ removido: true });
  } catch (err) {
    next(err);
  }
});
