/**
 * Amigos e grupos de treino.
 *
 * O mural do grupo não guarda nada por conta própria: ele é derivado dos
 * treinos já concluídos pelos membros. Assim, quando alguém termina um treino
 * — inclusive um treino que ficou offline e só subiu depois — ele aparece no
 * grupo automaticamente, sem nenhum passo extra e sem risco de o mural ficar
 * dessincronizado do histórico de quem treinou.
 */
import { prisma } from '../lib/prisma';
import { forbidden, notFound } from '../lib/errors';
import { arredondar } from '../utils/calculations';

/** Dados de outra pessoa que podem ser mostrados para amigos e grupos. */
export interface PessoaPublica {
  id: string;
  name: string;
  username: string | null;
  photoUrl: string | null;
}

const CAMPOS_PUBLICOS = { id: true, name: true, username: true, photoUrl: true } as const;

/** Alfabeto sem caracteres que se confundem ao ditar o código (O/0, I/1). */
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Código curto de convite, fácil de passar por mensagem. */
export async function gerarCodigoDeConvite(): Promise<string> {
  for (let tentativa = 0; tentativa < 10; tentativa++) {
    let codigo = '';
    for (let i = 0; i < 6; i++) codigo += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
    const existe = await prisma.group.findUnique({ where: { inviteCode: codigo }, select: { id: true } });
    if (!existe) return codigo;
  }
  // Praticamente impossível chegar aqui (32^6 combinações), mas nunca devolve repetido
  return `G${Date.now().toString(36).toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// Amizades
// ---------------------------------------------------------------------------

/** Ids de quem já é amigo confirmado. */
export async function idsDeAmigos(uid: string): Promise<string[]> {
  const amizades = await prisma.friendship.findMany({
    where: { status: 'aceita', OR: [{ requesterId: uid }, { addresseeId: uid }] },
    select: { requesterId: true, addresseeId: true },
  });
  return amizades.map((a) => (a.requesterId === uid ? a.addresseeId : a.requesterId));
}

/** Lista de amigos, convites recebidos e convites enviados. */
export async function listarAmizades(uid: string) {
  const amizades = await prisma.friendship.findMany({
    where: { OR: [{ requesterId: uid }, { addresseeId: uid }] },
    include: {
      requester: { select: CAMPOS_PUBLICOS },
      addressee: { select: CAMPOS_PUBLICOS },
    },
    orderBy: { createdAt: 'desc' },
  });

  const mapear = (a: (typeof amizades)[number]) => ({
    id: a.id,
    desde: a.respondedAt ?? a.createdAt,
    pessoa: a.requesterId === uid ? a.addressee : a.requester,
  });

  return {
    amigos: amizades.filter((a) => a.status === 'aceita').map(mapear),
    recebidos: amizades
      .filter((a) => a.status === 'pendente' && a.addresseeId === uid)
      .map((a) => ({ id: a.id, desde: a.createdAt, pessoa: a.requester })),
    enviados: amizades
      .filter((a) => a.status === 'pendente' && a.requesterId === uid)
      .map((a) => ({ id: a.id, desde: a.createdAt, pessoa: a.addressee })),
  };
}

// ---------------------------------------------------------------------------
// Grupos
// ---------------------------------------------------------------------------

/**
 * Garante que o usuário participa do grupo antes de devolver qualquer dado.
 * Quem foi apenas convidado ainda não vê o mural.
 */
export async function membroDoGrupo(groupId: string, uid: string, exigirAtivo = true) {
  const membro = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: uid } },
  });
  if (!membro) throw notFound('Grupo não encontrado');
  if (exigirAtivo && membro.status !== 'ativo') throw forbidden('Você ainda não entrou neste grupo');
  return membro;
}

/** Só o dono mexe em nome, descrição, código e na lista de membros. */
export async function donoDoGrupo(groupId: string, uid: string) {
  const membro = await membroDoGrupo(groupId, uid);
  if (membro.role !== 'dono') throw forbidden('Apenas quem criou o grupo pode fazer isso');
  return membro;
}

/**
 * Treinos que um membro compartilha com o grupo: concluídos, posteriores à
 * entrada dele e apenas se ele não desligou o compartilhamento.
 */
function filtroDeTreinosDoGrupo(membros: Array<{ userId: string; joinedAt: Date }>) {
  return {
    status: 'concluido',
    user: { shareWorkouts: true },
    OR: membros.map((m) => ({ userId: m.userId, startedAt: { gte: m.joinedAt } })),
  };
}

export interface ItemDoMural {
  id: string;
  nome: string;
  pessoa: PessoaPublica;
  data: Date;
  duracaoSec: number | null;
  volume: number;
  series: number;
  repeticoes: number;
  exercicios: number;
  gruposMusculares: string[];
  recordes: number;
}

/**
 * Mural do grupo: os treinos dos membros em ordem cronológica inversa.
 * `antesDe` pagina para trás a partir da data recebida.
 */
export async function muralDoGrupo(
  groupId: string,
  opcoes: { limite?: number; antesDe?: Date } = {},
): Promise<ItemDoMural[]> {
  const limite = opcoes.limite ?? 20;
  const membros = await prisma.groupMember.findMany({
    where: { groupId, status: 'ativo' },
    select: { userId: true, joinedAt: true },
  });
  if (membros.length === 0) return [];

  const treinos = await prisma.workout.findMany({
    where: {
      ...filtroDeTreinosDoGrupo(membros),
      ...(opcoes.antesDe ? { startedAt: { lt: opcoes.antesDe } } : {}),
    },
    select: {
      id: true,
      name: true,
      startedAt: true,
      durationSec: true,
      totalVolume: true,
      totalSets: true,
      totalReps: true,
      user: { select: CAMPOS_PUBLICOS },
      exercises: { select: { exercise: { select: { muscleGroup: true } } } },
      records: { select: { id: true } },
    },
    orderBy: { startedAt: 'desc' },
    take: limite,
  });

  return treinos.map((t) => ({
    id: t.id,
    nome: t.name,
    pessoa: t.user,
    data: t.startedAt,
    duracaoSec: t.durationSec,
    volume: arredondar(t.totalVolume ?? 0),
    series: t.totalSets ?? 0,
    repeticoes: t.totalReps ?? 0,
    exercicios: t.exercises.length,
    gruposMusculares: [...new Set(t.exercises.map((e) => e.exercise.muscleGroup))],
    recordes: t.records.length,
  }));
}

export interface LinhaDoRanking {
  pessoa: PessoaPublica;
  papel: string;
  desde: Date;
  treinos: number;
  volume: number;
  series: number;
  minutos: number;
  ultimoTreino: Date | null;
  compartilhando: boolean;
}

/**
 * Ranking do período (padrão: a semana corrente), ordenado por número de
 * treinos e, no empate, por volume. Serve de incentivo sem virar competição
 * de carga pura.
 */
export async function rankingDoGrupo(groupId: string, desde: Date): Promise<LinhaDoRanking[]> {
  const membros = await prisma.groupMember.findMany({
    where: { groupId, status: 'ativo' },
    include: { user: { select: { ...CAMPOS_PUBLICOS, shareWorkouts: true } } },
  });
  if (membros.length === 0) return [];

  const treinos = await prisma.workout.findMany({
    where: {
      ...filtroDeTreinosDoGrupo(membros.map((m) => ({ userId: m.userId, joinedAt: m.joinedAt }))),
      startedAt: { gte: desde },
    },
    select: { userId: true, startedAt: true, totalVolume: true, totalSets: true, durationSec: true },
  });

  const porPessoa = new Map<string, { treinos: number; volume: number; series: number; segundos: number; ultimo: Date | null }>();
  for (const t of treinos) {
    const atual = porPessoa.get(t.userId) ?? { treinos: 0, volume: 0, series: 0, segundos: 0, ultimo: null };
    atual.treinos += 1;
    atual.volume += t.totalVolume ?? 0;
    atual.series += t.totalSets ?? 0;
    atual.segundos += t.durationSec ?? 0;
    if (!atual.ultimo || t.startedAt > atual.ultimo) atual.ultimo = t.startedAt;
    porPessoa.set(t.userId, atual);
  }

  return membros
    .map((m) => {
      const dados = porPessoa.get(m.userId);
      return {
        pessoa: { id: m.user.id, name: m.user.name, username: m.user.username, photoUrl: m.user.photoUrl },
        papel: m.role,
        desde: m.joinedAt,
        treinos: dados?.treinos ?? 0,
        volume: arredondar(dados?.volume ?? 0),
        series: dados?.series ?? 0,
        minutos: Math.round((dados?.segundos ?? 0) / 60),
        ultimoTreino: dados?.ultimo ?? null,
        compartilhando: m.user.shareWorkouts,
      };
    })
    .sort((a, b) => b.treinos - a.treinos || b.volume - a.volume || a.pessoa.name.localeCompare(b.pessoa.name, 'pt-BR'));
}

/** Segunda-feira da semana corrente — mesmo critério usado no resto do app. */
export function inicioDaSemana(data = new Date()) {
  const d = new Date(data);
  const diaSemana = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diaSemana);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Grupos do usuário, com contagem de membros e o último treino do mural. */
export async function listarGrupos(uid: string) {
  const participacoes = await prisma.groupMember.findMany({
    where: { userId: uid },
    include: {
      group: {
        include: {
          owner: { select: CAMPOS_PUBLICOS },
          members: { where: { status: 'ativo' }, select: { userId: true, joinedAt: true } },
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  });

  const desde = inicioDaSemana();

  return Promise.all(
    participacoes.map(async (p) => {
      const membros = p.group.members;
      const [treinosDaSemana, ultimo] = await Promise.all([
        membros.length
          ? prisma.workout.count({
              where: { ...filtroDeTreinosDoGrupo(membros), startedAt: { gte: desde } },
            })
          : 0,
        membros.length
          ? prisma.workout.findFirst({
              where: filtroDeTreinosDoGrupo(membros),
              select: { startedAt: true, name: true, user: { select: { name: true } } },
              orderBy: { startedAt: 'desc' },
            })
          : null,
      ]);

      return {
        id: p.group.id,
        name: p.group.name,
        description: p.group.description,
        inviteCode: p.role === 'dono' ? p.group.inviteCode : null,
        papel: p.role,
        status: p.status,
        convidadoPor: p.invitedById,
        dono: p.group.owner,
        membros: membros.length,
        treinosNaSemana: treinosDaSemana,
        ultimoTreino: ultimo
          ? { nome: ultimo.name, pessoa: ultimo.user.name, data: ultimo.startedAt }
          : null,
      };
    }),
  );
}

/**
 * Atividade recente de todos os grupos do usuário, sem repetir o mesmo treino
 * quando duas pessoas dividem mais de um grupo. Alimenta o cartão da tela
 * inicial — os próprios treinos ficam de fora, já aparecem no histórico.
 */
export async function atividadeDosGrupos(uid: string, limite = 5) {
  const participacoes = await prisma.groupMember.findMany({
    where: { userId: uid, status: 'ativo' },
    select: { groupId: true, group: { select: { name: true } } },
  });
  if (participacoes.length === 0) return [];

  const listas = await Promise.all(
    participacoes.map(async (p) => {
      const itens = await muralDoGrupo(p.groupId, { limite });
      return itens
        .filter((i) => i.pessoa.id !== uid)
        .map((i) => ({ ...i, grupo: { id: p.groupId, name: p.group.name } }));
    }),
  );

  const vistos = new Set<string>();
  return listas
    .flat()
    .sort((a, b) => b.data.getTime() - a.data.getTime())
    .filter((i) => (vistos.has(i.id) ? false : vistos.add(i.id) && true))
    .slice(0, limite);
}
