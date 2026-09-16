import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, auth, criarExercicio, criarUsuario, limparBanco, type Sessao } from './helpers';

/** Registra um treino completo com uma única série e o finaliza. */
async function treinoComSerie(sessao: Sessao, exerciseId: string, weight: number, reps: number) {
  const inicio = await request(app).post('/api/treinos/iniciar').set(auth(sessao)).send({ name: 'Treino livre' });
  const workoutId = inicio.body.id as string;

  const exercicio = await request(app)
    .post(`/api/treinos/${workoutId}/exercicios`)
    .set(auth(sessao))
    .send({ exerciseId, sets: 1 });
  const setId = exercicio.body.sets[0].id as string;

  const serie = await request(app)
    .patch(`/api/treinos/series/${setId}`)
    .set(auth(sessao))
    .send({ weight, reps, completed: true });

  return { workoutId, setId, recordes: serie.body.recordes as Array<{ type: string; value: number }> };
}

describe('registro de treino', () => {
  let sessao: Sessao;
  let exerciseId: string;

  beforeEach(async () => {
    await limparBanco();
    sessao = await criarUsuario('atleta@treinos.app');
    exerciseId = (await criarExercicio()).id;
  });

  it('inicia um treino livre e impede dois treinos simultâneos', async () => {
    const primeiro = await request(app).post('/api/treinos/iniciar').set(auth(sessao)).send({});
    expect(primeiro.status).toBe(201);
    expect(primeiro.body.status).toBe('em_andamento');

    const segundo = await request(app).post('/api/treinos/iniciar').set(auth(sessao)).send({});
    expect(segundo.status).toBe(409);
  });

  it('retoma o rascunho em andamento', async () => {
    const criado = await request(app).post('/api/treinos/iniciar').set(auth(sessao)).send({});
    const rascunho = await request(app).get('/api/treinos/em-andamento').set(auth(sessao));

    expect(rascunho.status).toBe(200);
    expect(rascunho.body.id).toBe(criado.body.id);
  });

  it('marca a primeira série como recorde em todos os tipos', async () => {
    const { recordes } = await treinoComSerie(sessao, exerciseId, 80, 10);
    expect(recordes.map((r) => r.type).sort()).toEqual(['1rm', 'carga', 'reps', 'volume']);
  });

  it('só marca recorde de carga quando a carga sobe', async () => {
    const primeiro = await treinoComSerie(sessao, exerciseId, 80, 10);
    await request(app).post(`/api/treinos/${primeiro.workoutId}/finalizar`).set(auth(sessao)).send({});

    // Mesmo peso e menos reps: não é recorde de nada
    const igual = await treinoComSerie(sessao, exerciseId, 80, 8);
    expect(igual.recordes).toEqual([]);
    await request(app).post(`/api/treinos/${igual.workoutId}/finalizar`).set(auth(sessao)).send({});

    // Carga maior com menos repetições: recorde de carga (e de 1RM)
    const maior = await treinoComSerie(sessao, exerciseId, 90, 6);
    const tipos = maior.recordes.map((r) => r.type);
    expect(tipos).toContain('carga');
    expect(tipos).not.toContain('reps');
  });

  it('não gera recorde em série de aquecimento', async () => {
    const inicio = await request(app).post('/api/treinos/iniciar').set(auth(sessao)).send({});
    const exercicio = await request(app)
      .post(`/api/treinos/${inicio.body.id}/exercicios`)
      .set(auth(sessao))
      .send({ exerciseId, sets: 1 });

    const serie = await request(app)
      .patch(`/api/treinos/series/${exercicio.body.sets[0].id}`)
      .set(auth(sessao))
      .send({ weight: 200, reps: 10, type: 'aquecimento', completed: true });

    expect(serie.body.recordes).toEqual([]);
    expect(serie.body.serie.isPr).toBe(false);
  });

  it('finaliza o treino calculando volume, séries e grupos musculares', async () => {
    const inicio = await request(app).post('/api/treinos/iniciar').set(auth(sessao)).send({});
    const workoutId = inicio.body.id as string;
    const exercicio = await request(app)
      .post(`/api/treinos/${workoutId}/exercicios`)
      .set(auth(sessao))
      .send({ exerciseId, sets: 3 });

    const sets = exercicio.body.sets as Array<{ id: string }>;
    await request(app).patch(`/api/treinos/series/${sets[0].id}`).set(auth(sessao)).send({ weight: 60, reps: 12, type: 'aquecimento', completed: true });
    await request(app).patch(`/api/treinos/series/${sets[1].id}`).set(auth(sessao)).send({ weight: 80, reps: 10, completed: true });
    await request(app).patch(`/api/treinos/series/${sets[2].id}`).set(auth(sessao)).send({ weight: 80, reps: 8, completed: true });

    const resumo = await request(app).post(`/api/treinos/${workoutId}/finalizar`).set(auth(sessao)).send({ rpe: 8 });

    expect(resumo.status).toBe(200);
    // Aquecimento não entra no volume: 80×10 + 80×8 = 1440
    expect(resumo.body.volumeTotal).toBe(1440);
    expect(resumo.body.seriesConcluidas).toBe(3);
    expect(resumo.body.repeticoesTotais).toBe(18);
    expect(resumo.body.gruposMusculares).toEqual({ peito: 2 });
    expect(resumo.body.treino.status).toBe('concluido');
    expect(resumo.body.recordes.length).toBeGreaterThan(0);
    expect(resumo.body.conquistas.map((c: { code: string }) => c.code)).toContain('primeiro_treino');
  });

  it('descarta as séries não concluídas ao finalizar', async () => {
    const inicio = await request(app).post('/api/treinos/iniciar').set(auth(sessao)).send({});
    const exercicio = await request(app)
      .post(`/api/treinos/${inicio.body.id}/exercicios`)
      .set(auth(sessao))
      .send({ exerciseId, sets: 3 });

    await request(app)
      .patch(`/api/treinos/series/${exercicio.body.sets[0].id}`)
      .set(auth(sessao))
      .send({ weight: 70, reps: 10, completed: true });

    const resumo = await request(app).post(`/api/treinos/${inicio.body.id}/finalizar`).set(auth(sessao)).send({});
    expect(resumo.body.treino.exercises[0].sets).toHaveLength(1);
  });

  it('mantém o quadro de recordes coerente após excluir um treino', async () => {
    const primeiro = await treinoComSerie(sessao, exerciseId, 80, 10);
    await request(app).post(`/api/treinos/${primeiro.workoutId}/finalizar`).set(auth(sessao)).send({});

    const segundo = await treinoComSerie(sessao, exerciseId, 100, 5);
    await request(app).post(`/api/treinos/${segundo.workoutId}/finalizar`).set(auth(sessao)).send({});

    const antes = await request(app).get('/api/progresso/recordes').set(auth(sessao));
    expect(antes.body[0].recordes.carga.value).toBe(100);

    await request(app).delete(`/api/treinos/${segundo.workoutId}`).set(auth(sessao));

    const depois = await request(app).get('/api/progresso/recordes').set(auth(sessao));
    // O PR de 100 kg sumiu junto com o treino — volta a valer o de 80 kg
    expect(depois.body[0].recordes.carga.value).toBe(80);
  });

  it('substitui o rascunho do servidor quando o treino é finalizado offline', async () => {
    // Treino começou online (rascunho no servidor) e terminou sem internet
    const inicio = await request(app)
      .post('/api/treinos/iniciar')
      .set(auth(sessao))
      .send({ name: 'Começou online', clientId: 'misto-1' });
    expect(inicio.body.status).toBe('em_andamento');

    const sincronizacao = await request(app)
      .post('/api/treinos/sincronizar')
      .set(auth(sessao))
      .send({
        treinos: [
          {
            clientId: 'misto-1',
            name: 'Terminou offline',
            startedAt: new Date(Date.now() - 3600_000).toISOString(),
            finishedAt: new Date().toISOString(),
            exercises: [{ exerciseId, order: 0, sets: [{ order: 0, weight: 60, reps: 10, completed: true }] }],
          },
        ],
      });

    expect(sincronizacao.body.resultados[0].status).toBe('atualizado');

    // O rascunho sumiu e restou só o treino concluído
    expect((await request(app).get('/api/treinos/em-andamento').set(auth(sessao))).body).toBeNull();
    const historico = await request(app).get('/api/treinos').set(auth(sessao));
    expect(historico.body.total).toBe(1);
    expect(historico.body.itens[0].name).toBe('Terminou offline');
  });

  it('sincroniza treinos offline sem duplicar (idempotência por clientId)', async () => {
    const treino = {
      clientId: 'offline-1',
      name: 'Treino offline',
      startedAt: new Date(Date.now() - 3600_000).toISOString(),
      finishedAt: new Date().toISOString(),
      exercises: [
        {
          exerciseId,
          order: 0,
          sets: [
            { order: 0, weight: 70, reps: 10, completed: true },
            { order: 1, weight: 70, reps: 9, completed: true },
          ],
        },
      ],
    };

    const primeira = await request(app).post('/api/treinos/sincronizar').set(auth(sessao)).send({ treinos: [treino] });
    expect(primeira.body.resultados[0].status).toBe('criado');

    const segunda = await request(app).post('/api/treinos/sincronizar').set(auth(sessao)).send({ treinos: [treino] });
    expect(segunda.body.resultados[0].status).toBe('ja_sincronizado');

    const historico = await request(app).get('/api/treinos').set(auth(sessao));
    expect(historico.body.total).toBe(1);
    expect(historico.body.itens[0].totalVolume).toBe(70 * 10 + 70 * 9);
  });
});

describe('autorização — cada usuário só acessa os próprios dados', () => {
  let alice: Sessao;
  let bob: Sessao;
  let exerciseId: string;

  beforeEach(async () => {
    await limparBanco();
    alice = await criarUsuario('alice@treinos.app');
    bob = await criarUsuario('bob@treinos.app');
    exerciseId = (await criarExercicio()).id;
  });

  it('não deixa ler o treino de outro usuário', async () => {
    const { workoutId } = await treinoComSerie(alice, exerciseId, 60, 10);
    await request(app).post(`/api/treinos/${workoutId}/finalizar`).set(auth(alice)).send({});

    const tentativa = await request(app).get(`/api/treinos/${workoutId}`).set(auth(bob));
    expect(tentativa.status).toBe(404);

    const historicoDoBob = await request(app).get('/api/treinos').set(auth(bob));
    expect(historicoDoBob.body.total).toBe(0);
  });

  it('não deixa excluir o treino de outro usuário', async () => {
    const { workoutId } = await treinoComSerie(alice, exerciseId, 60, 10);
    const tentativa = await request(app).delete(`/api/treinos/${workoutId}`).set(auth(bob));
    expect(tentativa.status).toBe(404);
  });

  it('não deixa ler nem editar a rotina de outro usuário', async () => {
    const rotina = await request(app)
      .post('/api/rotinas')
      .set(auth(alice))
      .send({ name: 'Rotina da Alice', days: [{ name: 'Treino A', exercises: [] }] });

    expect((await request(app).get(`/api/rotinas/${rotina.body.id}`).set(auth(bob))).status).toBe(404);
    expect((await request(app).patch(`/api/rotinas/${rotina.body.id}`).set(auth(bob)).send({ name: 'Invadida' })).status).toBe(404);
    expect((await request(app).delete(`/api/rotinas/${rotina.body.id}`).set(auth(bob))).status).toBe(404);
    expect((await request(app).get('/api/rotinas').set(auth(bob))).body).toHaveLength(0);
  });

  it('não lista exercícios personalizados de outro usuário', async () => {
    await request(app)
      .post('/api/exercicios')
      .set(auth(alice))
      .send({ name: 'Exercício secreto da Alice', muscleGroup: 'peito', equipment: 'barra', type: 'forca' });

    const biblioteca = await request(app).get('/api/exercicios?busca=secreto').set(auth(bob));
    expect(biblioteca.body.itens).toHaveLength(0);
  });

  it('trata filtros booleanos "false" da query corretamente', async () => {
    await criarExercicio('Exercício global de teste');

    // favoritos=false / meus=false não devem esconder a biblioteca global
    const todos = await request(app)
      .get('/api/exercicios?favoritos=false&meus=false')
      .set(auth(alice));
    expect(todos.body.itens.length).toBeGreaterThan(0);

    const soFavoritos = await request(app).get('/api/exercicios?favoritos=true').set(auth(alice));
    expect(soFavoritos.body.itens).toHaveLength(0);
  });

  it('não deixa alterar medidas de outro usuário', async () => {
    const medida = await request(app).post('/api/medidas').set(auth(alice)).send({ weightKg: 80 });
    expect((await request(app).patch(`/api/medidas/${medida.body.id}`).set(auth(bob)).send({ weightKg: 60 })).status).toBe(404);
    expect((await request(app).get('/api/medidas').set(auth(bob))).body).toHaveLength(0);
  });
});
