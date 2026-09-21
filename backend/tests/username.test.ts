import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { prisma } from '../src/lib/prisma';
import { app, auth, criarUsuario, limparBanco, type Sessao } from './helpers';

describe('nome de usuário', () => {
  beforeEach(limparBanco);

  it('quem não escolhe recebe um sugerido a partir do nome', async () => {
    const sessao = await criarUsuario('joao@treinos.app', 'SenhaForte123', 'João da Silva');
    expect(sessao.usuario.username).toBe('joaodasilva');
  });

  it('nome repetido vira apelido com número, sem colidir', async () => {
    const primeiro = await criarUsuario('a@treinos.app', 'SenhaForte123', 'Ana Souza');
    const segundo = await criarUsuario('b@treinos.app', 'SenhaForte123', 'Ana Souza');

    expect(primeiro.usuario.username).toBe('anasouza');
    expect(segundo.usuario.username).toMatch(/^anasouza\d{4}$/);
    expect(segundo.usuario.username).not.toBe(primeiro.usuario.username);
  });

  it('aceita o apelido escolhido no cadastro e normaliza @ e maiúsculas', async () => {
    const sessao = await criarUsuario('c@treinos.app', 'SenhaForte123', 'Carla', '@CarlaLifts');
    expect(sessao.usuario.username).toBe('carlalifts');
  });

  it('recusa apelido já usado no cadastro', async () => {
    await criarUsuario('d@treinos.app', 'SenhaForte123', 'Dani', 'dani');
    const resposta = await request(app)
      .post('/api/auth/registrar')
      .send({ name: 'Outra Dani', email: 'd2@treinos.app', password: 'SenhaForte123', username: 'DANI' });

    expect(resposta.status).toBe(409);
    expect(resposta.body.erro.codigo).toBe('username_em_uso');
  });

  it('recusa formatos inválidos', async () => {
    const casos = ['ab', 'com espaço', 'ponto..duplo', '_comeca', 'admin', 'tem#simbolo'];
    for (const username of casos) {
      const resposta = await request(app)
        .post('/api/auth/registrar')
        .send({ name: 'Teste', email: `${Math.random()}@treinos.app`, password: 'SenhaForte123', username });
      expect(resposta.status, `deveria recusar "${username}"`).toBeGreaterThanOrEqual(400);
    }
  });

  it('troca o apelido pelo perfil, e o antigo fica livre', async () => {
    const sessao = await criarUsuario('e@treinos.app', 'SenhaForte123', 'Edu', 'edu');

    const trocou = await request(app).patch('/api/usuarios/eu').set(auth(sessao)).send({ username: 'edu.treina' });
    expect(trocou.status).toBe(200);
    expect(trocou.body.username).toBe('edu.treina');

    const outra = await criarUsuario('f@treinos.app', 'SenhaForte123', 'Fabi', 'edu');
    expect(outra.usuario.username).toBe('edu');
  });

  it('não deixa roubar o apelido de outra pessoa', async () => {
    await criarUsuario('g@treinos.app', 'SenhaForte123', 'Gabi', 'gabi');
    const outra = await criarUsuario('h@treinos.app', 'SenhaForte123', 'Higor', 'higor');

    const resposta = await request(app).patch('/api/usuarios/eu').set(auth(outra)).send({ username: 'gabi' });
    expect(resposta.status).toBe(409);
  });

  it('manter o próprio apelido ao salvar o perfil não dá conflito', async () => {
    const sessao = await criarUsuario('i@treinos.app', 'SenhaForte123', 'Ivo', 'ivo');
    const resposta = await request(app)
      .patch('/api/usuarios/eu')
      .set(auth(sessao))
      .send({ username: 'ivo', name: 'Ivo Lima' });

    expect(resposta.status).toBe(200);
    expect(resposta.body.name).toBe('Ivo Lima');
  });

  it('diz se um apelido está livre enquanto a pessoa digita', async () => {
    const sessao = await criarUsuario('j@treinos.app', 'SenhaForte123', 'Ju', 'ju.treina');

    const ocupado = await request(app).get('/api/usuarios/username-livre?username=ju.treina').set(auth(sessao));
    expect(ocupado.body.livre).toBe(true); // é o próprio apelido dela

    const outra = await criarUsuario('k@treinos.app', 'SenhaForte123', 'Kaio', 'kaio');
    const deOutro = await request(app).get('/api/usuarios/username-livre?username=ju.treina').set(auth(outra));
    expect(deOutro.body.livre).toBe(false);

    const invalido = await request(app).get('/api/usuarios/username-livre?username=ab').set(auth(outra));
    expect(invalido.body.livre).toBe(false);
    expect(invalido.body.motivo).toMatch(/pelo menos/);
  });

  it('conta antiga sem apelido ganha um ao abrir o app', async () => {
    const sessao = await criarUsuario('l@treinos.app', 'SenhaForte123', 'Lara Antiga', 'lara');
    await prisma.user.update({ where: { id: sessao.usuario.id }, data: { username: null } });

    const eu = await request(app).get('/api/usuarios/eu').set(auth(sessao));
    expect(eu.status).toBe(200);
    expect(eu.body.username).toBe('laraantiga');
  });

  it('o apelido aparece junto das pessoas nas telas sociais', async () => {
    const ana: Sessao = await criarUsuario('m@treinos.app', 'SenhaForte123', 'Ana', 'ana');
    const bruno: Sessao = await criarUsuario('n@treinos.app', 'SenhaForte123', 'Bruno', 'bruno');

    const convite = await request(app).post('/api/amigos').set(auth(ana)).send({ username: 'bruno' });
    await request(app).post(`/api/amigos/${convite.body.id}/aceitar`).set(auth(bruno)).send({});

    const lista = await request(app).get('/api/amigos').set(auth(ana));
    expect(lista.body.amigos[0].pessoa.username).toBe('bruno');
  });
});
