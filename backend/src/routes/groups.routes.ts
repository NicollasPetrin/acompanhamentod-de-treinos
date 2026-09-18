import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, userId } from '../middleware/auth';
import { getQuery, validate } from '../middleware/validate';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors';
import {
  atividadeDosGrupos,
  donoDoGrupo,
  gerarCodigoDeConvite,
  idsDeAmigos,
  inicioDaSemana,
  listarGrupos,
  membroDoGrupo,
  muralDoGrupo,
  rankingDoGrupo,
} from '../services/social';

export const groupsRouter = Router();
groupsRouter.use(requireAuth);

const grupoSchema = z.object({
  name: z.string().trim().min(2, 'Dê um nome ao grupo').max(60),
  description: z.string().trim().max(200).nullable().optional(),
});

const CAMPOS_PUBLICOS = { id: true, name: true, photoUrl: true } as const;

/** GET /api/grupos — grupos em que o usuário está (ou foi convidado). */
groupsRouter.get('/', async (req, res, next) => {
  try {
    res.json(await listarGrupos(userId(req)));
  } catch (err) {
    next(err);
  }
});

/** POST /api/grupos — cria o grupo; quem cria já entra como dono. */
groupsRouter.post('/', validate(grupoSchema), async (req, res, next) => {
  try {
    const uid = userId(req);
    const body = req.body as z.infer<typeof grupoSchema>;

    const grupo = await prisma.group.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        ownerId: uid,
        inviteCode: await gerarCodigoDeConvite(),
        members: { create: { userId: uid, role: 'dono', status: 'ativo' } },
      },
    });

    res.status(201).json(grupo);
  } catch (err) {
    next(err);
  }
});

/** POST /api/grupos/entrar — entra num grupo usando o código de convite. */
groupsRouter.post(
  '/entrar',
  validate(z.object({ codigo: z.string().trim().toUpperCase().min(4).max(20) })),
  async (req, res, next) => {
    try {
      const uid = userId(req);
      const { codigo } = req.body as { codigo: string };

      const grupo = await prisma.group.findUnique({ where: { inviteCode: codigo } });
      if (!grupo) throw notFound('Código inválido — confira com quem te convidou');

      const existente = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId: grupo.id, userId: uid } },
      });
      if (existente?.status === 'ativo') throw conflict('Você já está neste grupo');

      if (existente) {
        await prisma.groupMember.update({
          where: { id: existente.id },
          data: { status: 'ativo', joinedAt: new Date() },
        });
      } else {
        await prisma.groupMember.create({ data: { groupId: grupo.id, userId: uid } });
      }

      res.status(201).json({ id: grupo.id, name: grupo.name });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/grupos/atividade — últimos treinos dos amigos, de todos os grupos
 * juntos. Precisa vir antes de /:id para "atividade" não virar um id.
 */
groupsRouter.get(
  '/atividade',
  validate(z.object({ limite: z.coerce.number().int().min(1).max(20).default(5) }), 'query'),
  async (req, res, next) => {
    try {
      const { limite } = getQuery<{ limite: number }>(req);
      res.json(await atividadeDosGrupos(userId(req), limite));
    } catch (err) {
      next(err);
    }
  },
);

/** GET /api/grupos/:id — dados do grupo, membros e ranking da semana. */
groupsRouter.get('/:id', async (req, res, next) => {
  try {
    const uid = userId(req);
    const membro = await membroDoGrupo(req.params.id, uid, false);

    const grupo = await prisma.group.findUnique({
      where: { id: req.params.id },
      include: { owner: { select: CAMPOS_PUBLICOS } },
    });
    if (!grupo) throw notFound('Grupo não encontrado');

    const [ranking, convidados] = await Promise.all([
      membro.status === 'ativo' ? rankingDoGrupo(grupo.id, inicioDaSemana()) : [],
      prisma.groupMember.findMany({
        where: { groupId: grupo.id, status: 'convidado' },
        include: { user: { select: CAMPOS_PUBLICOS } },
      }),
    ]);

    res.json({
      id: grupo.id,
      name: grupo.name,
      description: grupo.description,
      createdAt: grupo.createdAt,
      dono: grupo.owner,
      papel: membro.role,
      status: membro.status,
      // O código só vai para quem pode convidar, para não vazar em capturas de tela
      inviteCode: membro.role === 'dono' && membro.status === 'ativo' ? grupo.inviteCode : null,
      ranking,
      convidados: convidados.map((c) => c.user),
      semanaComecaEm: inicioDaSemana(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/grupos/:id/mural — treinos concluídos pelos membros, do mais
 * recente para o mais antigo. É o que faz o treino "aparecer sozinho" no grupo.
 */
groupsRouter.get(
  '/:id/mural',
  validate(
    z.object({
      limite: z.coerce.number().int().min(1).max(50).default(20),
      antesDe: z.coerce.date().optional(),
    }),
    'query',
  ),
  async (req, res, next) => {
    try {
      await membroDoGrupo(req.params.id, userId(req));
      const { limite, antesDe } = getQuery<{ limite: number; antesDe?: Date }>(req);
      res.json(await muralDoGrupo(req.params.id, { limite, antesDe }));
    } catch (err) {
      next(err);
    }
  },
);

/** PATCH /api/grupos/:id — dono edita nome e descrição. */
groupsRouter.patch('/:id', validate(grupoSchema.partial()), async (req, res, next) => {
  try {
    await donoDoGrupo(req.params.id, userId(req));
    const body = req.body as Partial<z.infer<typeof grupoSchema>>;
    const grupo = await prisma.group.update({
      where: { id: req.params.id },
      data: { name: body.name, description: body.description ?? undefined },
    });
    res.json(grupo);
  } catch (err) {
    next(err);
  }
});

/** POST /api/grupos/:id/codigo — gera um código novo e invalida o anterior. */
groupsRouter.post('/:id/codigo', async (req, res, next) => {
  try {
    await donoDoGrupo(req.params.id, userId(req));
    const grupo = await prisma.group.update({
      where: { id: req.params.id },
      data: { inviteCode: await gerarCodigoDeConvite() },
    });
    res.json({ inviteCode: grupo.inviteCode });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/grupos/:id/convidar — convida um amigo direto do app.
 * O convite fica pendente: ninguém entra em grupo sem aceitar.
 */
groupsRouter.post(
  '/:id/convidar',
  validate(z.object({ userId: z.string().min(1) })),
  async (req, res, next) => {
    try {
      const uid = userId(req);
      await membroDoGrupo(req.params.id, uid);

      const convidado = req.body.userId as string;
      if (convidado === uid) throw badRequest('Você já está no grupo');

      const amigos = await idsDeAmigos(uid);
      if (!amigos.includes(convidado)) throw forbidden('Você só convida quem já é seu amigo no app');

      const existente = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId: req.params.id, userId: convidado } },
      });
      if (existente) {
        throw conflict(
          existente.status === 'ativo' ? 'Essa pessoa já está no grupo' : 'Essa pessoa já foi convidada',
        );
      }

      await prisma.groupMember.create({
        data: { groupId: req.params.id, userId: convidado, status: 'convidado', invitedById: uid },
      });
      res.status(201).json({ convidado: true });
    } catch (err) {
      next(err);
    }
  },
);

/** POST /api/grupos/:id/aceitar — aceita um convite para o grupo. */
groupsRouter.post('/:id/aceitar', async (req, res, next) => {
  try {
    const membro = await membroDoGrupo(req.params.id, userId(req), false);
    if (membro.status === 'ativo') return res.json({ id: membro.groupId, status: membro.status });

    await prisma.groupMember.update({
      where: { id: membro.id },
      data: { status: 'ativo', joinedAt: new Date() },
    });
    res.json({ id: membro.groupId, status: 'ativo' });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/grupos/:id/membros/:userId — sai do grupo (você mesmo) ou
 * remove alguém (só o dono). O dono não sai sem passar o grupo adiante.
 */
groupsRouter.delete('/:id/membros/:userId', async (req, res, next) => {
  try {
    const uid = userId(req);
    const alvo = req.params.userId;
    const eu = await membroDoGrupo(req.params.id, uid, false);

    if (alvo !== uid && eu.role !== 'dono') throw forbidden('Apenas quem criou o grupo pode remover membros');
    if (alvo === uid && eu.role === 'dono') {
      throw badRequest('Você criou o grupo — para sair, exclua o grupo ou passe a outra pessoa');
    }

    const membro = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: req.params.id, userId: alvo } },
    });
    if (!membro) throw notFound('Essa pessoa não está no grupo');

    await prisma.groupMember.delete({ where: { id: membro.id } });
    res.json({ removido: true });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/grupos/:id — o dono exclui o grupo (os treinos ficam intactos). */
groupsRouter.delete('/:id', async (req, res, next) => {
  try {
    await donoDoGrupo(req.params.id, userId(req));
    await prisma.group.delete({ where: { id: req.params.id } });
    res.json({ removido: true });
  } catch (err) {
    next(err);
  }
});
