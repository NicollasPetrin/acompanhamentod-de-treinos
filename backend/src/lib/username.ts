/**
 * Nome de usuário: o apelido público pelo qual os amigos se encontram.
 *
 * Guardado sempre em minúsculas e sem o "@" — o arroba é enfeite da interface.
 * A comparação é feita sobre o valor já normalizado, o que mantém a busca
 * insensível a maiúsculas sem depender de recurso exclusivo do PostgreSQL
 * (o SQLite do desenvolvimento não tem `mode: 'insensitive'`).
 */
import { prisma } from './prisma';

export const TAMANHO_MINIMO = 3;
export const TAMANHO_MAXIMO = 20;

/** Letras sem acento, números, ponto e traço-baixo. */
const PERMITIDO = /^[a-z0-9._]+$/;

/** Apelidos que não podem ser escolhidos por confundirem com telas do app. */
const RESERVADOS = new Set([
  'admin', 'administrador', 'suporte', 'ajuda', 'treinos', 'app', 'api',
  'eu', 'voce', 'você', 'amigos', 'grupos', 'config', 'configuracoes', 'sobre',
]);

/** Tira o @, baixa a caixa e remove acentos — o que chega da interface é bagunçado. */
export function normalizarUsername(valor: string): string {
  return valor
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Devolve o problema encontrado, ou null quando o apelido serve. */
export function problemaNoUsername(username: string): string | null {
  if (username.length < TAMANHO_MINIMO) return `Use pelo menos ${TAMANHO_MINIMO} caracteres`;
  if (username.length > TAMANHO_MAXIMO) return `Use no máximo ${TAMANHO_MAXIMO} caracteres`;
  if (!PERMITIDO.test(username)) return 'Use apenas letras, números, ponto e _';
  if (/^[._]|[._]$/.test(username)) return 'Não pode começar nem terminar com ponto ou _';
  if (/[._]{2,}/.test(username)) return 'Não repita ponto ou _ seguidos';
  if (RESERVADOS.has(username)) return 'Esse nome de usuário é reservado';
  return null;
}

/** Já existe alguém com esse apelido? (ignorando uma conta, ao editar o próprio) */
export async function usernameEmUso(username: string, exceto?: string): Promise<boolean> {
  const dono = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  return Boolean(dono && dono.id !== exceto);
}

/**
 * Sugere um apelido a partir do nome ou do e-mail e garante que ele esteja
 * livre, acrescentando um número quando precisar. Usado no cadastro e ao
 * preencher contas antigas.
 */
export async function gerarUsernameUnico(nome: string, email?: string): Promise<string> {
  const daBase = normalizarUsername(nome).replace(/[^a-z0-9]+/g, '').slice(0, TAMANHO_MAXIMO - 4);
  const doEmail = email ? normalizarUsername(email.split('@')[0]).replace(/[^a-z0-9]+/g, '') : '';
  const base = daBase.length >= TAMANHO_MINIMO ? daBase : doEmail.slice(0, TAMANHO_MAXIMO - 4) || 'atleta';

  if (!problemaNoUsername(base) && !(await usernameEmUso(base))) return base;

  for (let tentativa = 0; tentativa < 50; tentativa++) {
    const sufixo = String(Math.floor(Math.random() * 9000) + 1000);
    const candidato = `${base.slice(0, TAMANHO_MAXIMO - sufixo.length)}${sufixo}`;
    if (!problemaNoUsername(candidato) && !(await usernameEmUso(candidato))) return candidato;
  }

  // Praticamente inalcançável; ainda assim, nunca devolve repetido
  return `atleta${Date.now().toString(36)}`.slice(0, TAMANHO_MAXIMO);
}
