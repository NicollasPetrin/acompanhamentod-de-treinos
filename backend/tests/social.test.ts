import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, auth, criarExercicio, criarUsuario, limparBanco, type Sessao } from './helpers';

/** Registra e finaliza um treino completo — é o que alimenta o mural do grupo. */
async function treinar(sessao: Sessao, exerciseId: string, peso = 60) {
  const inicio = await request(app).post('/api/treinos/iniciar').set(auth(sessao)).send({});
  const exercicio = await request(app)
    .post(`/api/treinos/${inicio.body.id}/exercicios`)
    .set(auth(sessao))
    .send({ exerciseId, sets: 1 });
  await request(app)
    .patch(`/api/treinos/series/${exercicio.body.sets[0].id}`)
    .set(auth(sessao))
    .send({ weight: peso, reps: 10, completed: true });
  return request(app).post(`/api/treinos/${inicio.body.id}/finalizar`).set(auth(sessao)).send({});
}

/** Deixa duas contas amigas, aceitando o convite. */
async function virarAmigos(a: Sessao, b: Sessao) {
  const convite = await request(app).post('/api/amigos').set(auth(a)).send({ email: b.usuario.email });
  await request(app).post(`/api/amigos/${convite.body.id}/aceitar`).set(auth(b)).send({});
  return convite.body.id as string;
}

describe('amigos', () => {
  let ana: Sessao;
  let bruno: Sessao;

  beforeEach(async () => {
    await limparBanco();
    ana = await criarUsuario('ana@treinos.app', 'SenhaForte123', 'Ana');
    bruno = await criarUsuario('bruno@treinos.app', 'SenhaForte123', 'Bruno');
  });

  it('convida pelo e-mail, o outro aceita e os dois viram amigos', async () => {
    const convite = await request(app).post('/api/amigos').set(auth(ana)).send({ email: 'bruno@treinos.app' });
    expect(convite.status).toBe(201);

    const pendentes = await request(app).get('/api/amigos').set(auth(bruno));
    expect(pendentes.body.recebidos).toHaveLength(1);
    expect(pendentes.body.recebidos[0].pessoa.name).toBe('Ana');
    expect(pendentes.body.amigos).toHaveLength(0);

    await request(app).post(`/api/amigos/${convite.body.id}/aceitar`).set(auth(bruno)).send({});

    const dela = await request(app).get('/api/amigos').set(auth(ana));
    const dele = await request(app).get('/api/amigos').set(auth(bruno));
    expect(dela.body.amigos.map((a: { pessoa: { name: string } }) => a.pessoa.name)).toEqual(['Bruno']);
    expect(dele.body.amigos.map((a: { pessoa: { name: string } }) => a.pessoa.name)).toEqual(['Ana']);
    expect(dele.body.recebidos).toHaveLength(0);
  });

  it('convite cruzado vira amizade na hora, sem ninguém precisar aceitar', async () => {
    await request(app).post('/api/amigos').set(auth(ana)).send({ email: 'bruno@treinos.app' });
    const resposta = await request(app).post('/api/amigos').set(auth(bruno)).send({ email: 'ana@treinos.app' });

    expect(resposta.status).toBe(200);
    expect(resposta.body.status).toBe('aceita');
    const dela = await request(app).get('/api/amigos').set(auth(ana));
    expect(dela.body.amigos).toHaveLength(1);
  });

  it('não deixa convidar a si mesmo, nem repetir convite, nem inventar e-mail', async () => {
    const proprio = await request(app).post('/api/amigos').set(auth(ana)).send({ email: 'ana@treinos.app' });
    expect(proprio.status).toBe(400);

    const inexistente = await request(app).post('/api/amigos').set(auth(ana)).send({ email: 'ninguem@treinos.app' });
    expect(inexistente.status).toBe(404);

    await request(app).post('/api/amigos').set(auth(ana)).send({ email: 'bruno@treinos.app' });
    const repetido = await request(app).post('/api/amigos').set(auth(ana)).send({ email: 'bruno@treinos.app' });
    expect(repetido.status).toBe(409);
  });

  it('só o destinatário aceita o convite', async () => {
    const carla = await criarUsuario('carla@treinos.app', 'SenhaForte123', 'Carla');
    const convite = await request(app).post('/api/amigos').set(auth(ana)).send({ email: 'bruno@treinos.app' });

    const intruso = await request(app).post(`/api/amigos/${convite.body.id}/aceitar`).set(auth(carla)).send({});
    expect(intruso.status).toBe(403);
  });

  it('desfaz a amizade pelos dois lados', async () => {
    const id = await virarAmigos(ana, bruno);
    const remocao = await request(app).delete(`/api/amigos/${id}`).set(auth(bruno));

    expect(remocao.status).toBe(200);
    const dela = await request(app).get('/api/amigos').set(auth(ana));
    expect(dela.body.amigos).toHaveLength(0);
  });
});

describe('grupos de treino', () => {
  let ana: Sessao;
  let bruno: Sessao;
  let exercicioId: string;

  beforeEach(async () => {
    await limparBanco();
    ana = await criarUsuario('ana@treinos.app', 'SenhaForte123', 'Ana');
    bruno = await criarUsuario('bruno@treinos.app', 'SenhaForte123', 'Bruno');
    exercicioId = (await criarExercicio('Supino reto com barra')).id;
  });

  /** Cria o grupo com Ana e coloca Bruno dentro pelo código. */
  async function grupoComOsDois() {
    const grupo = await request(app)
      .post('/api/grupos')
      .set(auth(ana))
      .send({ name: 'Galera da academia', description: 'Treino de segunda a sexta' });
    await request(app).post('/api/grupos/entrar').set(auth(bruno)).send({ codigo: grupo.body.inviteCode });
    return grupo.body as { id: string; inviteCode: string };
  }

  it('cria o grupo, entra pelo código e lista os dois membros', async () => {
    const grupo = await grupoComOsDois();

    const detalhe = await request(app).get(`/api/grupos/${grupo.id}`).set(auth(bruno));
    expect(detalhe.status).toBe(200);
    expect(detalhe.body.name).toBe('Galera da academia');
    expect(detalhe.body.ranking.map((l: { pessoa: { name: string } }) => l.pessoa.name).sort()).toEqual(['Ana', 'Bruno']);
    // O código de convite só vai para quem pode convidar
    expect(detalhe.body.inviteCode).toBeNull();

    const daAna = await request(app).get(`/api/grupos/${grupo.id}`).set(auth(ana));
    expect(daAna.body.inviteCode).toBe(grupo.inviteCode);
    expect(daAna.body.papel).toBe('dono');
  });

  it('o treino concluído aparece sozinho no mural do grupo', async () => {
    const grupo = await grupoComOsDois();

    const vazio = await request(app).get(`/api/grupos/${grupo.id}/mural`).set(auth(ana));
    expect(vazio.body).toHaveLength(0);

    await treinar(bruno, exercicioId, 80);

    const mural = await request(app).get(`/api/grupos/${grupo.id}/mural`).set(auth(ana));
    expect(mural.status).toBe(200);
    expect(mural.body).toHaveLength(1);
    expect(mural.body[0].pessoa.name).toBe('Bruno');
    expect(mural.body[0].volume).toBe(800);
    expect(mural.body[0].series).toBe(1);
    expect(mural.body[0].exercicios).toBe(1);
    expect(mural.body[0].gruposMusculares).toEqual(['peito']);
    // O primeiro treino do exercício já é recorde, e isso aparece para os amigos
    expect(mural.body[0].recordes).toBeGreaterThan(0);
  });

  it('o ranking da semana ordena por número de treinos', async () => {
    const grupo = await grupoComOsDois();

    await treinar(ana, exercicioId, 40);
    await treinar(bruno, exercicioId, 100);
    await treinar(bruno, exercicioId, 105);

    const detalhe = await request(app).get(`/api/grupos/${grupo.id}`).set(auth(ana));
    expect(detalhe.body.ranking[0].pessoa.name).toBe('Bruno');
    expect(detalhe.body.ranking[0].treinos).toBe(2);
    expect(detalhe.body.ranking[1].pessoa.name).toBe('Ana');
    expect(detalhe.body.ranking[1].treinos).toBe(1);
  });

  it('quem desliga o compartilhamento some do mural, mas continua no grupo', async () => {
    const grupo = await grupoComOsDois();
    await treinar(bruno, exercicioId);

    await request(app).patch('/api/usuarios/eu/preferencias').set(auth(bruno)).send({ shareWorkouts: false });

    const mural = await request(app).get(`/api/grupos/${grupo.id}/mural`).set(auth(ana));
    expect(mural.body).toHaveLength(0);

    const detalhe = await request(app).get(`/api/grupos/${grupo.id}`).set(auth(ana));
    const linhaDoBruno = detalhe.body.ranking.find((l: { pessoa: { name: string } }) => l.pessoa.name === 'Bruno');
    expect(linhaDoBruno).toBeDefined();
    expect(linhaDoBruno.compartilhando).toBe(false);
  });

  it('treino anterior à entrada no grupo não é exposto para trás', async () => {
    await treinar(bruno, exercicioId);
    const grupo = await grupoComOsDois();

    const mural = await request(app).get(`/api/grupos/${grupo.id}/mural`).set(auth(ana));
    expect(mural.body).toHaveLength(0);
  });

  it('quem não é do grupo não vê nada dele', async () => {
    const grupo = await grupoComOsDois();
    const estranha = await criarUsuario('carla@treinos.app', 'SenhaForte123', 'Carla');

    const detalhe = await request(app).get(`/api/grupos/${grupo.id}`).set(auth(estranha));
    const mural = await request(app).get(`/api/grupos/${grupo.id}/mural`).set(auth(estranha));
    expect(detalhe.status).toBe(404);
    expect(mural.status).toBe(404);
  });

  it('convida um amigo, que só entra depois de aceitar', async () => {
    const grupo = await grupoComOsDois();
    const carla = await criarUsuario('carla@treinos.app', 'SenhaForte123', 'Carla');

    const semAmizade = await request(app)
      .post(`/api/grupos/${grupo.id}/convidar`)
      .set(auth(ana))
      .send({ userId: carla.usuario.id });
    expect(semAmizade.status).toBe(403);

    await virarAmigos(ana, carla);
    const convite = await request(app)
      .post(`/api/grupos/${grupo.id}/convidar`)
      .set(auth(ana))
      .send({ userId: carla.usuario.id });
    expect(convite.status).toBe(201);

    // Convidada ainda não vê o mural
    const antes = await request(app).get(`/api/grupos/${grupo.id}/mural`).set(auth(carla));
    expect(antes.status).toBe(403);

    const listaDela = await request(app).get('/api/grupos').set(auth(carla));
    expect(listaDela.body[0].status).toBe('convidado');

    await request(app).post(`/api/grupos/${grupo.id}/aceitar`).set(auth(carla)).send({});
    const depois = await request(app).get(`/api/grupos/${grupo.id}/mural`).set(auth(carla));
    expect(depois.status).toBe(200);
  });

  it('só o dono edita, troca o código e remove membros', async () => {
    const grupo = await grupoComOsDois();

    expect((await request(app).patch(`/api/grupos/${grupo.id}`).set(auth(bruno)).send({ name: 'Outro nome' })).status).toBe(403);
    expect((await request(app).post(`/api/grupos/${grupo.id}/codigo`).set(auth(bruno)).send({})).status).toBe(403);
    expect(
      (await request(app).delete(`/api/grupos/${grupo.id}/membros/${ana.usuario.id}`).set(auth(bruno))).status,
    ).toBe(403);

    const novoCodigo = await request(app).post(`/api/grupos/${grupo.id}/codigo`).set(auth(ana)).send({});
    expect(novoCodigo.body.inviteCode).not.toBe(grupo.inviteCode);

    const codigoVelho = await request(app).post('/api/grupos/entrar').set(auth(bruno)).send({ codigo: grupo.inviteCode });
    expect(codigoVelho.status).toBe(404);
  });

  it('membro sai sozinho; o dono precisa excluir o grupo', async () => {
    const grupo = await grupoComOsDois();

    const donaSaindo = await request(app).delete(`/api/grupos/${grupo.id}/membros/${ana.usuario.id}`).set(auth(ana));
    expect(donaSaindo.status).toBe(400);

    const saida = await request(app).delete(`/api/grupos/${grupo.id}/membros/${bruno.usuario.id}`).set(auth(bruno));
    expect(saida.status).toBe(200);
    expect((await request(app).get('/api/grupos').set(auth(bruno))).body).toHaveLength(0);

    await request(app).delete(`/api/grupos/${grupo.id}`).set(auth(ana));
    expect((await request(app).get('/api/grupos').set(auth(ana))).body).toHaveLength(0);
  });

  it('a atividade da tela inicial junta os grupos e deixa de fora os treinos da própria pessoa', async () => {
    const grupo = await grupoComOsDois();
    await treinar(ana, exercicioId, 50);
    await treinar(bruno, exercicioId, 90);

    const atividade = await request(app).get('/api/grupos/atividade').set(auth(ana));
    expect(atividade.status).toBe(200);
    expect(atividade.body).toHaveLength(1);
    expect(atividade.body[0].pessoa.name).toBe('Bruno');
    expect(atividade.body[0].grupo.id).toBe(grupo.id);
  });
});
