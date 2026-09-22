import http from 'node:http';
import https from 'node:https';
import crypto from 'node:crypto';
import selfsigned from 'selfsigned';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/lib/prisma';
import { env } from '../src/env';
import { assinaturaDoQstashValida, dispararNotificacao } from '../src/services/agendador';
import { app, auth, criarUsuario, limparBanco, type Sessao } from './helpers';

/* -------------------------------------------------------------------------- */
/* Um "serviço de push" falso, no lugar do da Apple/Google                     */
/* -------------------------------------------------------------------------- */

interface Entrega {
  caminho: string;
  cabecalhos: http.IncomingHttpHeaders;
  corpo: Buffer;
  chegouEm: number;
}

let servidor: https.Server;
let base = '';
const entregas: Entrega[] = [];
let caOriginal: https.AgentOptions['ca'];

beforeAll(async () => {
  // Serviços de push reais só falam HTTPS — o falso também. O certificado é
  // gerado na hora e só o agente HTTPS deste processo de teste confia nele.
  const certificado = selfsigned.generate([{ name: 'commonName', value: '127.0.0.1' }], {
    days: 1,
    keySize: 2048,
    extensions: [{ name: 'subjectAltName', altNames: [{ type: 7, ip: '127.0.0.1' }] }],
  });
  caOriginal = https.globalAgent.options.ca;
  https.globalAgent.options.ca = certificado.cert;

  servidor = https.createServer({ key: certificado.private, cert: certificado.cert }, (req, res) => {
    const partes: Buffer[] = [];
    req.on('data', (p) => partes.push(p));
    req.on('end', () => {
      entregas.push({ caminho: req.url ?? '', cabecalhos: req.headers, corpo: Buffer.concat(partes), chegouEm: Date.now() });
      // aparelho que desinstalou o app: o serviço responde 410 Gone
      res.statusCode = req.url?.includes('morta') ? 410 : 201;
      res.end();
    });
  });
  await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok));
  base = `https://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});

afterAll(async () => {
  https.globalAgent.options.ca = caOriginal;
  await new Promise<void>((ok) => servidor.close(() => ok()));
});

/** Um aparelho de mentira: par de chaves ECDH P-256 e segredo, como o navegador gera. */
function novoAparelho(nome: string) {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const segredo = crypto.randomBytes(16);
  return {
    ecdh,
    segredo,
    inscricao: {
      endpoint: `${base}/push/${nome}`,
      keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: segredo.toString('base64url') },
    },
  };
}

/**
 * Abre a mensagem como o celular abriria (RFC 8291, aes128gcm). Se o conteúdo
 * sai legível aqui, a criptografia e as chaves do servidor estão certas.
 */
function abrir(entrega: Entrega, aparelho: ReturnType<typeof novoAparelho>) {
  const corpo = entrega.corpo;
  const sal = corpo.subarray(0, 16);
  const tamanhoDaChave = corpo[20];
  const chaveDoServidor = corpo.subarray(21, 21 + tamanhoDaChave);
  const cifrado = corpo.subarray(21 + tamanhoDaChave);

  const hmac = (chave: Buffer, dados: Buffer) => crypto.createHmac('sha256', chave).update(dados).digest();
  const segredoEcdh = aparelho.ecdh.computeSecret(chaveDoServidor);
  const prkChave = hmac(aparelho.segredo, segredoEcdh);
  const infoChave = Buffer.concat([Buffer.from('WebPush: info\0'), aparelho.ecdh.getPublicKey(), chaveDoServidor]);
  const ikm = hmac(prkChave, Buffer.concat([infoChave, Buffer.from([1])]));
  const prk = hmac(sal, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12);

  const decifrador = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
  decifrador.setAuthTag(cifrado.subarray(cifrado.length - 16));
  const claro = Buffer.concat([decifrador.update(cifrado.subarray(0, cifrado.length - 16)), decifrador.final()]);
  // o texto termina com o delimitador 0x02 seguido de enchimento
  const fim = claro.lastIndexOf(2);
  return JSON.parse(claro.subarray(0, fim).toString('utf8')) as {
    titulo: string;
    corpo: string;
    url: string;
    etiqueta: string;
  };
}

const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
async function aguardarEntregas(quantas: number, ateMs = 5000) {
  const limite = Date.now() + ateMs;
  while (entregas.length < quantas && Date.now() < limite) await esperar(50);
}

/* -------------------------------------------------------------------------- */

describe('notificações', () => {
  let pessoa: Sessao;
  let celular: ReturnType<typeof novoAparelho>;

  beforeEach(async () => {
    await limparBanco();
    await prisma.scheduledNotification.deleteMany();
    await prisma.pushSubscription.deleteMany();
    entregas.length = 0;
    pessoa = await criarUsuario('push@treinos.app', 'SenhaForte123', 'Pessoa Push');
    await prisma.user.update({ where: { id: pessoa.usuario.id }, data: { timeZone: 'America/Sao_Paulo' } });
    celular = novoAparelho(`celular-${Date.now()}`);
  });

  const inscrever = (sessao: Sessao, aparelho: ReturnType<typeof novoAparelho>) =>
    request(app).post('/api/notificacoes/inscricao').set(auth(sessao)).send(aparelho.inscricao);

  it('entrega a chave pública e ela não muda entre chamadas', async () => {
    const a = await request(app).get('/api/notificacoes/chave').set(auth(pessoa));
    const b = await request(app).get('/api/notificacoes/chave').set(auth(pessoa));

    expect(a.status).toBe(200);
    expect(a.body.publicKey).toMatch(/^[A-Za-z0-9_-]{80,}$/);
    expect(b.body.publicKey).toBe(a.body.publicKey);
    // nos testes o servidor fica ligado: o agendamento é pelo próprio processo
    expect(a.body.agendamento).toBe('processo');
  });

  it('inscreve o aparelho uma vez só, mesmo pedindo de novo', async () => {
    expect((await inscrever(pessoa, celular)).status).toBe(201);
    expect((await inscrever(pessoa, celular)).status).toBe(201);
    expect(await prisma.pushSubscription.count()).toBe(1);
  });

  it('o mesmo celular pode receber de duas contas (treino em dupla)', async () => {
    const parceira = await criarUsuario('dupla@treinos.app', 'SenhaForte123', 'Dupla');
    await inscrever(pessoa, celular);
    await inscrever(parceira, celular);
    expect(await prisma.pushSubscription.count()).toBe(2);
  });

  it('a notificação de teste chega criptografada e legível no aparelho', async () => {
    await inscrever(pessoa, celular);
    const resposta = await request(app).post('/api/notificacoes/teste').set(auth(pessoa)).send({});

    expect(resposta.body.entregues).toBe(1);
    await aguardarEntregas(1);
    const entrega = entregas[0];
    expect(entrega.cabecalhos['content-encoding']).toBe('aes128gcm');
    expect(String(entrega.cabecalhos.authorization)).toMatch(/^vapid t=.+, k=.+/);
    expect(entrega.cabecalhos.urgency).toBe('high');
    expect(abrir(entrega, celular).titulo).toBe('Notificações ligadas 💪');
  });

  it('sair do app no meio do treino avisa na hora que o treino está em andamento', async () => {
    await inscrever(pessoa, celular);
    const resposta = await request(app)
      .post('/api/notificacoes/saida')
      .set(auth(pessoa))
      .send({ nome: 'Treino A — Peito', url: '/app/treino/abc', seriesFeitas: 7, seriesTotal: 18 });

    expect(resposta.body).toMatchObject({ retomada: 1, descansoAgendado: false });
    await aguardarEntregas(1);
    const aviso = abrir(entregas[0], celular);
    expect(aviso.titulo).toBe('Treino em andamento — Treino A — Peito');
    expect(aviso.corpo).toBe('7 de 18 séries. Toque para continuar de onde parou.');
    expect(aviso.url).toBe('/app/treino/abc');
    expect(aviso.etiqueta).toBe('treino');
    // aparece toda vez que a tela apaga — não pode apitar
    expect((aviso as { silenciosa?: boolean }).silenciosa).toBe(true);
  });

  it('saindo durante o descanso: avisa agora e de novo quando o descanso acaba', async () => {
    await inscrever(pessoa, celular);
    const fim = new Date(Date.now() + 2500);
    const esperado = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(fim);

    const saiu = Date.now();
    const resposta = await request(app)
      .post('/api/notificacoes/saida')
      .set(auth(pessoa))
      .send({ nome: 'Treino C', descansoTerminaEm: fim.toISOString(), exercicio: 'Agachamento livre' });
    expect(resposta.body).toMatchObject({ retomada: 1, descansoAgendado: true });

    await aguardarEntregas(1);
    const agora = abrir(entregas[0], celular);
    expect(agora.corpo).toBe(`Descanso até ${esperado}. Toque para voltar.`);
    expect(entregas[0].chegouEm - saiu).toBeLessThan(1500);

    await aguardarEntregas(2, 6000);
    expect(entregas).toHaveLength(2);
    const fimDoDescanso = abrir(entregas[1], celular);
    expect(fimDoDescanso.titulo).toBe('Descanso acabou');
    expect(fimDoDescanso.corpo).toBe('Hora da próxima série de Agachamento livre.');
    // este, sim, precisa chamar a atenção
    expect((fimDoDescanso as { silenciosa?: boolean }).silenciosa).toBeFalsy();
    // chegou na hora marcada, não antes
    expect(entregas[1].chegouEm).toBeGreaterThanOrEqual(fim.getTime() - 50);
    expect(entregas[1].chegouEm - fim.getTime()).toBeLessThan(1500);
  });

  it('voltar para o app antes do fim cancela o aviso do descanso', async () => {
    await inscrever(pessoa, celular);
    await request(app)
      .post('/api/notificacoes/saida')
      .set(auth(pessoa))
      .send({ nome: 'Treino C', retomada: false, descansoTerminaEm: new Date(Date.now() + 1500).toISOString() });

    const voltou = await request(app).delete('/api/notificacoes/saida').set(auth(pessoa));
    expect(voltou.body.cancelados).toBe(1);

    await esperar(2500);
    expect(entregas).toHaveLength(0);
  });

  it('sair de novo troca o aviso marcado — nunca chegam dois', async () => {
    await inscrever(pessoa, celular);
    const sair = (ms: number) =>
      request(app)
        .post('/api/notificacoes/saida')
        .set(auth(pessoa))
        .send({ nome: 'Treino C', retomada: false, descansoTerminaEm: new Date(Date.now() + ms).toISOString() });

    await sair(1200);
    await sair(1800);

    await esperar(3000);
    expect(entregas).toHaveLength(1);
    expect(abrir(entregas[0], celular).titulo).toBe('Descanso acabou');
  });

  it('com o aviso de retomada desligado, só o do descanso é marcado', async () => {
    await inscrever(pessoa, celular);
    const resposta = await request(app)
      .post('/api/notificacoes/saida')
      .set(auth(pessoa))
      .send({ nome: 'Treino C', retomada: false });

    expect(resposta.body).toMatchObject({ retomada: 0, descansoAgendado: false });
    await esperar(300);
    expect(entregas).toHaveLength(0);
  });

  it('a mesma notificação disparada duas vezes chega uma vez só', async () => {
    await inscrever(pessoa, celular);
    const n = await prisma.scheduledNotification.create({
      data: {
        userId: pessoa.usuario.id, kind: 'descanso', sendAt: new Date(),
        title: 'Descanso acabou', body: 'Hora da próxima série.', url: '/app/treino',
      },
    });

    const [a, b] = await Promise.all([dispararNotificacao(n.id), dispararNotificacao(n.id)]);
    expect([a, b].sort()).toEqual(['enviada', 'ignorada']);
    await aguardarEntregas(1);
    await esperar(200);
    expect(entregas).toHaveLength(1);
  });

  it('aparelho que desinstalou o app sai da lista', async () => {
    const velho = novoAparelho('morta');
    await inscrever(pessoa, velho);
    await inscrever(pessoa, celular);

    const resposta = await request(app).post('/api/notificacoes/teste').set(auth(pessoa)).send({});
    expect(resposta.body.entregues).toBe(1);
    const restantes = await prisma.pushSubscription.findMany();
    expect(restantes.map((r) => r.endpoint)).toEqual([celular.inscricao.endpoint]);
  });

  it('o disparo externo só é aceito com o QStash configurado', async () => {
    const resposta = await request(app).post('/api/notificacoes/disparar/qualquer').send({ id: 'qualquer' });
    expect(resposta.status).toBe(403);
  });

  it('as rotas pessoais exigem login', async () => {
    expect((await request(app).get('/api/notificacoes/chave')).status).toBe(401);
    expect((await request(app).post('/api/notificacoes/saida').send({ nome: 'x' })).status).toBe(401);
  });
});

describe('assinatura do QStash', () => {
  const chaveAtual = 'sig_atual_teste_123456789';
  const chaveProxima = 'sig_proxima_teste_987654321';
  const url = 'https://treinos.exemplo.app/api/notificacoes/disparar/abc';
  const corpo = Buffer.from(JSON.stringify({ id: 'abc' }));
  const hash = crypto.createHash('sha256').update(corpo).digest('base64url');

  beforeAll(() => {
    env.QSTASH_CURRENT_SIGNING_KEY = chaveAtual;
    env.QSTASH_NEXT_SIGNING_KEY = chaveProxima;
  });
  afterAll(() => {
    env.QSTASH_CURRENT_SIGNING_KEY = undefined;
    env.QSTASH_NEXT_SIGNING_KEY = undefined;
  });

  const assinar = (chave: string, extra: Record<string, unknown> = {}) =>
    jwt.sign({ iss: 'Upstash', sub: url, body: hash, ...extra }, chave, { algorithm: 'HS256', expiresIn: 300 });

  it('aceita a assinatura com a chave atual e com a próxima', () => {
    expect(assinaturaDoQstashValida(assinar(chaveAtual), corpo, url)).toBe(true);
    expect(assinaturaDoQstashValida(assinar(chaveProxima), corpo, url)).toBe(true);
  });

  it('recusa chave errada, corpo adulterado, endereço trocado ou assinatura ausente', () => {
    expect(assinaturaDoQstashValida(assinar('chave-de-outra-pessoa'), corpo, url)).toBe(false);
    expect(assinaturaDoQstashValida(assinar(chaveAtual), Buffer.from('{"id":"outra"}'), url)).toBe(false);
    expect(assinaturaDoQstashValida(assinar(chaveAtual), corpo, `${url}-outra`)).toBe(false);
    expect(assinaturaDoQstashValida(assinar(chaveAtual, { iss: 'Outro' }), corpo, url)).toBe(false);
    expect(assinaturaDoQstashValida(undefined, corpo, url)).toBe(false);
  });
});
