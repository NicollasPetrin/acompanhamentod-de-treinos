import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { prisma } from '../src/lib/prisma';
import { chaveDoDia, inicioDoDia, somarDias } from '../src/lib/datas';
import { app, auth, criarExercicio, criarUsuario, limparBanco, type Sessao } from './helpers';

const SAO_PAULO = 'America/Sao_Paulo';

/** Grava um treino concluído num instante escolhido. */
async function treinoEm(sessao: Sessao, quando: Date, exerciseId: string) {
  return prisma.workout.create({
    data: {
      userId: sessao.usuario.id,
      name: 'Treino da noite',
      status: 'concluido',
      startedAt: quando,
      finishedAt: new Date(quando.getTime() + 45 * 60 * 1000),
      durationSec: 2700,
      totalVolume: 5000,
      totalSets: 20,
      totalReps: 200,
      exercises: { create: { exerciseId, order: 0 } },
    },
  });
}

describe('treino da noite não escorrega para o dia seguinte', () => {
  let usuario: Sessao;
  let exercicioId: string;

  beforeEach(async () => {
    await limparBanco();
    usuario = await criarUsuario('noturno@treinos.app', 'SenhaForte123', 'Coruja');
    await prisma.user.update({ where: { id: usuario.usuario.id }, data: { timeZone: SAO_PAULO } });
    exercicioId = (await criarExercicio('Supino reto com barra')).id;
  });

  it('o calendário coloca o treino no dia em que a pessoa treinou', async () => {
    // 21/09/2026 às 21:30 em São Paulo — já é dia 22 em UTC
    await treinoEm(usuario, new Date('2026-09-22T00:30:00.000Z'), exercicioId);

    const resposta = await request(app).get('/api/treinos/calendario?mes=2026-09').set(auth(usuario));
    expect(resposta.status).toBe(200);
    expect(Object.keys(resposta.body.dias)).toEqual(['2026-09-21']);
  });

  it('treino na última noite do mês continua nesse mês', async () => {
    // 30/09/2026 às 22:00 em São Paulo = 01/10 01:00 UTC
    await treinoEm(usuario, new Date('2026-10-01T01:00:00.000Z'), exercicioId);

    const setembro = await request(app).get('/api/treinos/calendario?mes=2026-09').set(auth(usuario));
    const outubro = await request(app).get('/api/treinos/calendario?mes=2026-10').set(auth(usuario));

    expect(Object.keys(setembro.body.dias)).toEqual(['2026-09-30']);
    expect(Object.keys(outubro.body.dias)).toEqual([]);
  });

  it('a sequência de dias conta o treino de ontem como ontem', async () => {
    const agora = new Date();
    const ontemDeNoite = new Date(somarDias(inicioDoDia(agora, SAO_PAULO), -1, SAO_PAULO).getTime() + 21.5 * 3600 * 1000);
    const anteontemDeNoite = new Date(somarDias(inicioDoDia(agora, SAO_PAULO), -2, SAO_PAULO).getTime() + 21.5 * 3600 * 1000);

    await treinoEm(usuario, anteontemDeNoite, exercicioId);
    await treinoEm(usuario, ontemDeNoite, exercicioId);

    const resumo = await request(app).get('/api/progresso/resumo').set(auth(usuario));
    // dois dias seguidos, e não um único dia com dois treinos
    expect(resumo.body.streak).toBe(2);
    expect(chaveDoDia(ontemDeNoite, SAO_PAULO)).not.toBe(chaveDoDia(anteontemDeNoite, SAO_PAULO));
  });

  it('o resumo da semana usa a semana de quem treina', async () => {
    // domingo 27/09/2026 às 22h em São Paulo — em UTC já é segunda, semana seguinte
    await treinoEm(usuario, new Date('2026-09-28T01:00:00.000Z'), exercicioId);

    const semanal = await request(app).get('/api/progresso/volume-semanal?semanas=52').set(auth(usuario));
    const comTreino = semanal.body.filter((s: { treinos: number }) => s.treinos > 0);

    expect(comTreino).toHaveLength(1);
    expect(comTreino[0].semana).toBe('2026-09-21'); // segunda-feira da semana dele
  });

  it('quem está em outro fuso vê o próprio dia', async () => {
    await prisma.user.update({ where: { id: usuario.usuario.id }, data: { timeZone: 'Europe/Lisbon' } });
    // o mesmo instante de 21:30 em São Paulo já é 02:30 do dia 22 em Lisboa
    await treinoEm(usuario, new Date('2026-09-22T00:30:00.000Z'), exercicioId);

    const resposta = await request(app).get('/api/treinos/calendario?mes=2026-09').set(auth(usuario));
    expect(Object.keys(resposta.body.dias)).toEqual(['2026-09-22']);
  });

  it('conta sem fuso informado cai no horário de Brasília', async () => {
    await prisma.user.update({ where: { id: usuario.usuario.id }, data: { timeZone: null } });
    await treinoEm(usuario, new Date('2026-09-22T00:30:00.000Z'), exercicioId);

    const resposta = await request(app).get('/api/treinos/calendario?mes=2026-09').set(auth(usuario));
    expect(Object.keys(resposta.body.dias)).toEqual(['2026-09-21']);
  });

  it('o app avisa o fuso do aparelho e ele fica gravado', async () => {
    const resposta = await request(app)
      .patch('/api/usuarios/eu/preferencias')
      .set(auth(usuario))
      .send({ timeZone: 'America/Manaus' });

    expect(resposta.status).toBe(200);
    expect(resposta.body.timeZone).toBe('America/Manaus');
  });
});
