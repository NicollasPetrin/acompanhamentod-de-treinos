import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, auth, criarExercicio, criarUsuario, limparBanco, type Sessao } from './helpers';
import { prisma } from '../src/lib/prisma';
import { toJson } from '../src/lib/json';

/** Registra e finaliza um treino com uma série, para alimentar metas e progresso. */
async function registrar(sessao: Sessao, exerciseId: string, weight: number, reps: number) {
  const inicio = await request(app).post('/api/treinos/iniciar').set(auth(sessao)).send({});
  const exercicio = await request(app)
    .post(`/api/treinos/${inicio.body.id}/exercicios`)
    .set(auth(sessao))
    .send({ exerciseId, sets: 1 });
  await request(app)
    .patch(`/api/treinos/series/${exercicio.body.sets[0].id}`)
    .set(auth(sessao))
    .send({ weight, reps, completed: true });
  await request(app).post(`/api/treinos/${inicio.body.id}/finalizar`).set(auth(sessao)).send({});
}

describe('metas', () => {
  let sessao: Sessao;
  let exerciseId: string;

  beforeEach(async () => {
    await limparBanco();
    sessao = await criarUsuario('metas@treinos.app');
    exerciseId = (await criarExercicio()).id;
  });

  it('calcula o progresso a partir dos treinos registrados', async () => {
    await request(app)
      .post('/api/metas')
      .set(auth(sessao))
      .send({ title: 'Supino 100 kg', type: 'carga', exerciseId, targetValue: 100, startValue: 60 });

    await registrar(sessao, exerciseId, 80, 5);

    const metas = await request(app).get('/api/metas').set(auth(sessao));
    expect(metas.body[0].currentValue).toBe(80);
    // (80 − 60) / (100 − 60) = 50%
    expect(metas.body[0].progress).toBe(50);
    expect(metas.body[0].completed).toBe(false);
  });

  it('marca a meta como concluída ao atingir o alvo', async () => {
    await request(app)
      .post('/api/metas')
      .set(auth(sessao))
      .send({ title: 'Supino 100 kg', type: 'carga', exerciseId, targetValue: 100, startValue: 60 });

    await registrar(sessao, exerciseId, 100, 3);

    const metas = await request(app).get('/api/metas').set(auth(sessao));
    expect(metas.body[0].completed).toBe(true);
    expect(metas.body[0].progress).toBe(100);
  });

  it('entende metas de emagrecimento (alvo abaixo do início)', async () => {
    await request(app).post('/api/medidas').set(auth(sessao)).send({ weightKg: 78 });
    await request(app)
      .post('/api/metas')
      .set(auth(sessao))
      .send({ title: 'Chegar a 75 kg', type: 'peso_corporal', targetValue: 75, startValue: 85 });

    const emAndamento = await request(app).get('/api/metas').set(auth(sessao));
    expect(emAndamento.body[0].completed).toBe(false);

    await request(app).post('/api/medidas').set(auth(sessao)).send({ weightKg: 74.5 });
    const atingida = await request(app).get('/api/metas').set(auth(sessao));
    expect(atingida.body[0].completed).toBe(true);
  });

  it('conta a frequência semanal', async () => {
    await request(app)
      .post('/api/metas')
      .set(auth(sessao))
      .send({ title: 'Treinar 4x por semana', type: 'frequencia', targetValue: 4 });

    await registrar(sessao, exerciseId, 60, 10);
    await registrar(sessao, exerciseId, 62, 10);

    const metas = await request(app).get('/api/metas').set(auth(sessao));
    expect(metas.body[0].currentValue).toBe(2);
    expect(metas.body[0].progress).toBe(50);
  });
});

describe('rotinas', () => {
  let sessao: Sessao;

  beforeEach(async () => {
    await limparBanco();
    sessao = await criarUsuario('rotinas@treinos.app');
    // O template ABC precisa dos exercícios globais correspondentes
    await prisma.exercise.createMany({
      data: ['Supino reto com barra', 'Barra fixa (pegada pronada)', 'Agachamento livre com barra'].map((name) => ({
        name,
        muscleGroup: 'peito',
        secondaryMuscles: toJson([]),
        equipment: 'barra',
        type: 'forca',
        instructions: '',
      })),
    });
  });

  it('cria uma rotina a partir de um template', async () => {
    const resposta = await request(app).post('/api/rotinas/templates/abc/aplicar').set(auth(sessao)).send({});

    expect(resposta.status).toBe(201);
    expect(resposta.body.days).toHaveLength(3);
    // Só entram os exercícios existentes na biblioteca
    expect(resposta.body.days[0].exercises.length).toBeGreaterThan(0);
  });

  it('mantém apenas uma rotina ativa por vez', async () => {
    const a = await request(app).post('/api/rotinas').set(auth(sessao)).send({ name: 'Rotina A', isActive: true });
    const b = await request(app).post('/api/rotinas').set(auth(sessao)).send({ name: 'Rotina B' });

    await request(app).post(`/api/rotinas/${b.body.id}/ativar`).set(auth(sessao));

    const ativa = await request(app).get('/api/rotinas/ativa').set(auth(sessao));
    expect(ativa.body.id).toBe(b.body.id);

    const todas = await request(app).get('/api/rotinas').set(auth(sessao));
    expect(todas.body.find((r: { id: string }) => r.id === a.body.id).isActive).toBe(false);
  });

  it('separa rotinas ativas das arquivadas nos filtros da lista', async () => {
    const ativa = await request(app).post('/api/rotinas').set(auth(sessao)).send({ name: 'Em uso' });
    const antiga = await request(app).post('/api/rotinas').set(auth(sessao)).send({ name: 'Fase antiga' });
    await request(app).post(`/api/rotinas/${antiga.body.id}/arquivar`).set(auth(sessao));

    // `arquivadas=false` precisa trazer só as rotinas em uso
    const emUso = await request(app).get('/api/rotinas?arquivadas=false').set(auth(sessao));
    expect(emUso.body.map((r: { id: string }) => r.id)).toEqual([ativa.body.id]);

    const semParametro = await request(app).get('/api/rotinas').set(auth(sessao));
    expect(semParametro.body.map((r: { id: string }) => r.id)).toEqual([ativa.body.id]);

    const arquivadas = await request(app).get('/api/rotinas?arquivadas=true').set(auth(sessao));
    expect(arquivadas.body.map((r: { id: string }) => r.id)).toEqual([antiga.body.id]);
  });

  it('compartilha por link e permite copiar para outra conta', async () => {
    const rotina = await request(app)
      .post('/api/rotinas')
      .set(auth(sessao))
      .send({ name: 'Minha rotina', days: [{ name: 'Treino A', exercises: [] }] });

    const link = await request(app).post(`/api/rotinas/${rotina.body.id}/compartilhar`).set(auth(sessao));
    expect(link.body.shareSlug).toBeTruthy();

    // Leitura pública, sem token
    const publica = await request(app).get(`/api/rotinas/compartilhadas/${link.body.shareSlug}`);
    expect(publica.status).toBe(200);
    expect(publica.body.autor).toBeTruthy();

    const outro = await criarUsuario('copiador@treinos.app');
    const copia = await request(app)
      .post(`/api/rotinas/compartilhadas/${link.body.shareSlug}/copiar`)
      .set(auth(outro))
      .send({});
    expect(copia.status).toBe(201);
    expect(copia.body.name).toContain('cópia');

    // Depois de revogar, o link para de funcionar
    await request(app).delete(`/api/rotinas/${rotina.body.id}/compartilhar`).set(auth(sessao));
    expect((await request(app).get(`/api/rotinas/compartilhadas/${link.body.shareSlug}`)).status).toBe(404);
  });

  it('reordena os exercícios do dia', async () => {
    const exA = await criarExercicio('Exercício A');
    const exB = await criarExercicio('Exercício B');
    const rotina = await request(app)
      .post('/api/rotinas')
      .set(auth(sessao))
      .send({
        name: 'Com ordem',
        days: [
          {
            name: 'Treino A',
            exercises: [
              { exerciseId: exA.id, sets: 3, repsMin: 8, repsMax: 12 },
              { exerciseId: exB.id, sets: 3, repsMin: 8, repsMax: 12 },
            ],
          },
        ],
      });

    const dia = rotina.body.days[0];
    const ordemInvertida = [dia.exercises[1].id, dia.exercises[0].id];
    const resposta = await request(app)
      .patch(`/api/rotinas/dias/${dia.id}/exercicios/reordenar`)
      .set(auth(sessao))
      .send({ ordem: ordemInvertida });

    expect(resposta.status).toBe(200);
    expect(resposta.body.map((e: { id: string }) => e.id)).toEqual(ordemInvertida);
  });
});
