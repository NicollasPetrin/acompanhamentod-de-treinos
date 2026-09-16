import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, auth, criarExercicio, criarUsuario, limparBanco, type Sessao } from './helpers';

/** Registra e finaliza um treino com um exercício, para ele contar como "usado". */
async function treinar(sessao: Sessao, exerciseId: string) {
  const inicio = await request(app).post('/api/treinos/iniciar').set(auth(sessao)).send({});
  const exercicio = await request(app)
    .post(`/api/treinos/${inicio.body.id}/exercicios`)
    .set(auth(sessao))
    .send({ exerciseId, sets: 1 });
  await request(app)
    .patch(`/api/treinos/series/${exercicio.body.sets[0].id}`)
    .set(auth(sessao))
    .send({ weight: 60, reps: 10, completed: true });
  await request(app).post(`/api/treinos/${inicio.body.id}/finalizar`).set(auth(sessao)).send({});
}

describe('aba "seus exercícios"', () => {
  let sessao: Sessao;

  beforeEach(async () => {
    await limparBanco();
    sessao = await criarUsuario('meus@treinos.app');
  });

  it('traz só o que o usuário treinou, tem na rotina ou cadastrou', async () => {
    const treinado = await criarExercicio('Supino reto com barra');
    const naRotina = await criarExercicio('Agachamento livre com barra');
    await criarExercicio('Exercício que nunca usei');

    await treinar(sessao, treinado.id);

    await request(app)
      .post('/api/rotinas')
      .set(auth(sessao))
      .send({
        name: 'Minha rotina',
        days: [{ name: 'Treino A', exercises: [{ exerciseId: naRotina.id, sets: 3, repsMin: 8, repsMax: 12 }] }],
      });

    const criado = await request(app)
      .post('/api/exercicios')
      .set(auth(sessao))
      .send({ name: 'Rosca do meu jeito', muscleGroup: 'biceps', equipment: 'halter', type: 'forca' });

    const resposta = await request(app).get('/api/exercicios?usados=true').set(auth(sessao));
    const nomes = resposta.body.itens.map((e: { name: string }) => e.name);

    expect(nomes).toContain('Supino reto com barra');
    expect(nomes).toContain('Agachamento livre com barra');
    expect(nomes).toContain('Rosca do meu jeito');
    expect(nomes).not.toContain('Exercício que nunca usei');
    expect(resposta.body.total).toBe(3);
    expect(criado.status).toBe(201);
  });

  it('conta quantas vezes cada exercício foi treinado e ordena pelos mais usados', async () => {
    const frequente = await criarExercicio('Supino reto com barra');
    const eventual = await criarExercicio('Crucifixo reto com halteres');

    await treinar(sessao, frequente.id);
    await treinar(sessao, frequente.id);
    await treinar(sessao, eventual.id);

    const resposta = await request(app).get('/api/exercicios?usados=true').set(auth(sessao));
    const itens = resposta.body.itens as Array<{ name: string; usos: number; ultimoUso: string | null }>;

    expect(itens[0].name).toBe('Supino reto com barra');
    expect(itens[0].usos).toBe(2);
    expect(itens[0].ultimoUso).toBeTruthy();
    expect(itens[1].usos).toBe(1);
  });

  it('não mistura os exercícios de um usuário com os de outro', async () => {
    const exercicio = await criarExercicio('Supino reto com barra');
    await treinar(sessao, exercicio.id);

    const outro = await criarUsuario('outro@treinos.app');
    const resposta = await request(app).get('/api/exercicios?usados=true').set(auth(outro));

    expect(resposta.body.itens).toHaveLength(0);
  });

  it('a busca e os filtros continuam valendo dentro da aba', async () => {
    const supino = await criarExercicio('Supino reto com barra');
    const rosca = await criarExercicio('Rosca direta com barra');
    await treinar(sessao, supino.id);
    await treinar(sessao, rosca.id);

    const resposta = await request(app).get('/api/exercicios?usados=true&busca=rosca').set(auth(sessao));
    expect(resposta.body.itens.map((e: { name: string }) => e.name)).toEqual(['Rosca direta com barra']);
  });
});
