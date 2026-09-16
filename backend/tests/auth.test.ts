import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, criarUsuario, limparBanco } from './helpers';
import { prisma } from '../src/lib/prisma';
import { hashToken } from '../src/lib/jwt';

describe('autenticação', () => {
  beforeEach(async () => {
    await limparBanco();
  });

  it('cadastra um usuário e devolve os tokens', async () => {
    const resposta = await request(app)
      .post('/api/auth/registrar')
      .send({ name: 'Maria', email: 'maria@treinos.app', password: 'SenhaForte123' });

    expect(resposta.status).toBe(201);
    expect(resposta.body.usuario.email).toBe('maria@treinos.app');
    expect(resposta.body.accessToken).toBeTruthy();
    expect(resposta.body.refreshToken).toBeTruthy();
    // A senha jamais vai na resposta
    expect(resposta.body.usuario.passwordHash).toBeUndefined();
  });

  it('recusa senha fraca', async () => {
    const resposta = await request(app)
      .post('/api/auth/registrar')
      .send({ name: 'João', email: 'joao@treinos.app', password: 'abcdefgh' });

    expect(resposta.status).toBe(400);
    expect(resposta.body.erro.mensagem).toMatch(/fraca/i);
  });

  it('recusa e-mail duplicado', async () => {
    await criarUsuario('dup@treinos.app');
    const resposta = await request(app)
      .post('/api/auth/registrar')
      .send({ name: 'Outro', email: 'dup@treinos.app', password: 'SenhaForte123' });

    expect(resposta.status).toBe(409);
  });

  it('valida o formato do e-mail', async () => {
    const resposta = await request(app)
      .post('/api/auth/registrar')
      .send({ name: 'Maria', email: 'nao-e-email', password: 'SenhaForte123' });

    expect(resposta.status).toBe(422);
    expect(resposta.body.erro.codigo).toBe('validacao');
  });

  it('faz login com credenciais válidas', async () => {
    await criarUsuario('login@treinos.app', 'SenhaForte123');
    const resposta = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@treinos.app', password: 'SenhaForte123', rememberMe: true });

    expect(resposta.status).toBe(200);
    expect(resposta.body.accessToken).toBeTruthy();
  });

  it('não revela se o e-mail existe quando a senha está errada', async () => {
    await criarUsuario('seguro@treinos.app', 'SenhaForte123');

    const senhaErrada = await request(app)
      .post('/api/auth/login')
      .send({ email: 'seguro@treinos.app', password: 'SenhaErrada123' });
    const emailInexistente = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ninguem@treinos.app', password: 'SenhaForte123' });

    expect(senhaErrada.status).toBe(401);
    expect(emailInexistente.status).toBe(401);
    expect(senhaErrada.body.erro.mensagem).toBe(emailInexistente.body.erro.mensagem);
  });

  it('bloqueia rota protegida sem token', async () => {
    const resposta = await request(app).get('/api/usuarios/eu');
    expect(resposta.status).toBe(401);
  });

  it('bloqueia rota protegida com token inválido', async () => {
    const resposta = await request(app).get('/api/usuarios/eu').set('Authorization', 'Bearer token-falso');
    expect(resposta.status).toBe(401);
  });

  it('renova o access token e revoga o refresh usado (rotação)', async () => {
    const sessao = await criarUsuario('refresh@treinos.app');

    const primeira = await request(app).post('/api/auth/refresh').send({ refreshToken: sessao.refreshToken });
    expect(primeira.status).toBe(200);
    expect(primeira.body.refreshToken).not.toBe(sessao.refreshToken);

    // Reutilizar o refresh antigo não pode funcionar
    const reuso = await request(app).post('/api/auth/refresh').send({ refreshToken: sessao.refreshToken });
    expect(reuso.status).toBe(401);
  });

  it('encerra a sessão no logout', async () => {
    const sessao = await criarUsuario('logout@treinos.app');

    const logout = await request(app).post('/api/auth/logout').send({ refreshToken: sessao.refreshToken });
    expect(logout.status).toBe(200);

    const depois = await request(app).post('/api/auth/refresh').send({ refreshToken: sessao.refreshToken });
    expect(depois.status).toBe(401);
  });

  it('recupera a senha com token válido e expira o antigo', async () => {
    const sessao = await criarUsuario('recuperar@treinos.app', 'SenhaForte123');

    const pedido = await request(app).post('/api/auth/esqueci-senha').send({ email: 'recuperar@treinos.app' });
    expect(pedido.status).toBe(200);

    // O token cru só existe no e-mail; nos testes geramos um conhecido
    const tokenCru = 'token-de-teste-para-recuperacao';
    await prisma.passwordResetToken.create({
      data: {
        userId: sessao.usuario.id,
        tokenHash: hashToken(tokenCru),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const troca = await request(app)
      .post('/api/auth/redefinir-senha')
      .send({ token: tokenCru, password: 'NovaSenha456' });
    expect(troca.status).toBe(200);

    const loginAntigo = await request(app)
      .post('/api/auth/login')
      .send({ email: 'recuperar@treinos.app', password: 'SenhaForte123' });
    expect(loginAntigo.status).toBe(401);

    const loginNovo = await request(app)
      .post('/api/auth/login')
      .send({ email: 'recuperar@treinos.app', password: 'NovaSenha456' });
    expect(loginNovo.status).toBe(200);

    // O token de recuperação é de uso único
    const reuso = await request(app)
      .post('/api/auth/redefinir-senha')
      .send({ token: tokenCru, password: 'OutraSenha789' });
    expect(reuso.status).toBe(400);
  });

  it('recusa token de recuperação expirado', async () => {
    const sessao = await criarUsuario('expirado@treinos.app');
    const tokenCru = 'token-expirado-de-teste';
    await prisma.passwordResetToken.create({
      data: {
        userId: sessao.usuario.id,
        tokenHash: hashToken(tokenCru),
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const resposta = await request(app)
      .post('/api/auth/redefinir-senha')
      .send({ token: tokenCru, password: 'NovaSenha456' });
    expect(resposta.status).toBe(400);
  });

  it('não vaza a existência do e-mail em "esqueci a senha"', async () => {
    const resposta = await request(app).post('/api/auth/esqueci-senha').send({ email: 'ninguem@treinos.app' });
    expect(resposta.status).toBe(200);
  });

  it('exclui a conta apenas com senha e confirmação corretas', async () => {
    const sessao = await criarUsuario('excluir@treinos.app', 'SenhaForte123');
    const cabecalho = { Authorization: `Bearer ${sessao.accessToken}` };

    const semConfirmacao = await request(app)
      .delete('/api/usuarios/eu')
      .set(cabecalho)
      .send({ password: 'SenhaForte123', confirmacao: 'apagar' });
    expect(semConfirmacao.status).toBe(400);

    const senhaErrada = await request(app)
      .delete('/api/usuarios/eu')
      .set(cabecalho)
      .send({ password: 'ErradaTotal1', confirmacao: 'EXCLUIR' });
    expect(senhaErrada.status).toBe(400);

    const sucesso = await request(app)
      .delete('/api/usuarios/eu')
      .set(cabecalho)
      .send({ password: 'SenhaForte123', confirmacao: 'EXCLUIR' });
    expect(sucesso.status).toBe(200);

    expect(await prisma.user.findUnique({ where: { email: 'excluir@treinos.app' } })).toBeNull();
  });
});
