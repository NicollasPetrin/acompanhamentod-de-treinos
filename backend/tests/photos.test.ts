import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, auth, criarUsuario, limparBanco, type Sessao } from './helpers';
import { prisma } from '../src/lib/prisma';

/** PNG 1×1 válido, suficiente para exercitar o upload. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('fotos', () => {
  let sessao: Sessao;

  beforeEach(async () => {
    await limparBanco();
    await prisma.photo.deleteMany();
    sessao = await criarUsuario('fotos@treinos.app');
  });

  it('guarda a foto de perfil no banco e a serve de volta', async () => {
    const envio = await request(app)
      .post('/api/usuarios/eu/foto')
      .set(auth(sessao))
      .attach('foto', PNG, { filename: 'perfil.png', contentType: 'image/png' });

    expect(envio.status).toBe(200);
    expect(envio.body.photoUrl).toMatch(/^\/api\/fotos\/.+/);

    const imagem = await request(app).get(envio.body.photoUrl);
    expect(imagem.status).toBe(200);
    expect(imagem.headers['content-type']).toContain('image/png');
    expect(imagem.body.length).toBe(PNG.length);
  });

  it('descarta a foto de perfil anterior ao trocar', async () => {
    const primeira = await request(app)
      .post('/api/usuarios/eu/foto')
      .set(auth(sessao))
      .attach('foto', PNG, { filename: 'a.png', contentType: 'image/png' });

    const segunda = await request(app)
      .post('/api/usuarios/eu/foto')
      .set(auth(sessao))
      .attach('foto', PNG, { filename: 'b.png', contentType: 'image/png' });

    expect(segunda.body.photoUrl).not.toBe(primeira.body.photoUrl);
    expect((await request(app).get(primeira.body.photoUrl)).status).toBe(404);
    expect((await request(app).get(segunda.body.photoUrl)).status).toBe(200);
    expect(await prisma.photo.count()).toBe(1);
  });

  it('anexa e remove fotos de progresso de uma medida', async () => {
    const medida = await request(app).post('/api/medidas').set(auth(sessao)).send({ weightKg: 80 });

    const comFoto = await request(app)
      .post(`/api/medidas/${medida.body.id}/fotos`)
      .set(auth(sessao))
      .attach('foto', PNG, { filename: 'progresso.png', contentType: 'image/png' });

    expect(comFoto.status).toBe(201);
    expect(comFoto.body.photos).toHaveLength(1);

    const url = comFoto.body.photos[0] as string;
    expect((await request(app).get(url)).status).toBe(200);

    const semFoto = await request(app).delete(`/api/medidas/${medida.body.id}/fotos`).set(auth(sessao)).send({ url });
    expect(semFoto.body.photos).toHaveLength(0);
    expect((await request(app).get(url)).status).toBe(404);
    expect(await prisma.photo.count()).toBe(0);
  });

  it('recusa arquivo que não é imagem', async () => {
    const envio = await request(app)
      .post('/api/usuarios/eu/foto')
      .set(auth(sessao))
      .attach('foto', Buffer.from('isto não é uma imagem'), { filename: 'nota.txt', contentType: 'text/plain' });

    expect(envio.status).toBe(400);
    expect(await prisma.photo.count()).toBe(0);
  });

  it('não deixa outro usuário apagar a foto pela remoção de medida', async () => {
    const medida = await request(app).post('/api/medidas').set(auth(sessao)).send({ weightKg: 80 });
    const comFoto = await request(app)
      .post(`/api/medidas/${medida.body.id}/fotos`)
      .set(auth(sessao))
      .attach('foto', PNG, { filename: 'progresso.png', contentType: 'image/png' });
    const url = comFoto.body.photos[0] as string;

    const intruso = await criarUsuario('intruso@treinos.app');
    const tentativa = await request(app)
      .delete(`/api/medidas/${medida.body.id}/fotos`)
      .set(auth(intruso))
      .send({ url });

    expect(tentativa.status).toBe(404);
    expect((await request(app).get(url)).status).toBe(200);
  });

  it('apaga as fotos junto com a conta', async () => {
    await request(app)
      .post('/api/usuarios/eu/foto')
      .set(auth(sessao))
      .attach('foto', PNG, { filename: 'perfil.png', contentType: 'image/png' });

    await request(app)
      .delete('/api/usuarios/eu')
      .set(auth(sessao))
      .send({ password: 'SenhaForte123', confirmacao: 'EXCLUIR' });

    expect(await prisma.photo.count()).toBe(0);
  });
});
