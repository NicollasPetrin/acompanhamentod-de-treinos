/**
 * Datas no fuso de quem treina, não no do servidor.
 *
 * O banco guarda instantes (UTC), o que está certo. O problema é agrupar por
 * "dia": o servidor roda em UTC e, no Brasil (UTC-3), tudo que acontece depois
 * das 21h cai no dia seguinte para ele. Um treino de terça à noite virava
 * quarta — bagunçando calendário, sequência de dias, resumo da semana e
 * comparativo mensal.
 *
 * Aqui os limites de dia, semana e mês são calculados no fuso da pessoa, com
 * `Intl` (o Node traz os dados de fuso completos), sem depender do relógio da
 * máquina nem de biblioteca externa.
 */

/** Usado quando a conta ainda não informou o fuso — o app nasceu em pt-BR. */
export const FUSO_PADRAO = 'America/Sao_Paulo';

const UM_DIA = 24 * 60 * 60 * 1000;

/** Fusos inválidos não podem derrubar uma listagem: caem no padrão. */
export function fusoValido(fuso: string | null | undefined): string {
  if (!fuso) return FUSO_PADRAO;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: fuso }).format(new Date());
    return fuso;
  } catch {
    return FUSO_PADRAO;
  }
}

const formatadores = new Map<string, Intl.DateTimeFormat>();
function formatador(fuso: string): Intl.DateTimeFormat {
  let f = formatadores.get(fuso);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: fuso,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formatadores.set(fuso, f);
  }
  return f;
}

interface Relogio {
  ano: number;
  mes: number; // 1-12
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
}

/** Que horas eram, nesse fuso, no instante informado. */
export function relogioLocal(data: Date, fuso: string): Relogio {
  const partes = Object.fromEntries(
    formatador(fusoValido(fuso))
      .formatToParts(data)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  return {
    ano: Number(partes.year),
    mes: Number(partes.month),
    dia: Number(partes.day),
    hora: Number(partes.hour),
    minuto: Number(partes.minute),
    segundo: Number(partes.second),
  };
}

/** Quanto o fuso estava adiantado (ms) em relação ao UTC naquele instante. */
function deslocamento(data: Date, fuso: string): number {
  const r = relogioLocal(data, fuso);
  const comoSeFosseUtc = Date.UTC(r.ano, r.mes - 1, r.dia, r.hora, r.minuto, r.segundo);
  // Descarta os milissegundos dos dois lados para o deslocamento sair redondo
  return comoSeFosseUtc - Math.floor(data.getTime() / 1000) * 1000;
}

/** Chave "AAAA-MM-DD" do dia em que o instante caiu, no fuso da pessoa. */
export function chaveDoDia(data: Date, fuso: string): string {
  const r = relogioLocal(data, fuso);
  return `${r.ano}-${String(r.mes).padStart(2, '0')}-${String(r.dia).padStart(2, '0')}`;
}

/** Chave "AAAA-MM" do mês em que o instante caiu, no fuso da pessoa. */
export function chaveDoMes(data: Date, fuso: string): string {
  const r = relogioLocal(data, fuso);
  return `${r.ano}-${String(r.mes).padStart(2, '0')}`;
}

/** Hora do dia (0-23) no fuso da pessoa — para "treinou de madrugada". */
export function horaLocal(data: Date, fuso: string): number {
  return relogioLocal(data, fuso).hora;
}

/**
 * Instante (UTC) em que começou aquele dia local.
 *
 * A meia-noite local é achada em duas passadas: a primeira usa o deslocamento
 * do instante recebido, a segunda o do palpite. Isso acerta os dias em que o
 * fuso muda no meio (horário de verão), em que as duas medidas diferem.
 */
export function inicioDoDiaLocal(ano: number, mes: number, dia: number, fuso: string): Date {
  const zona = fusoValido(fuso);
  const meiaNoiteIngenua = Date.UTC(ano, mes - 1, dia);
  let palpite = meiaNoiteIngenua - deslocamento(new Date(meiaNoiteIngenua), zona);
  palpite = meiaNoiteIngenua - deslocamento(new Date(palpite), zona);
  return new Date(palpite);
}

/** Começo do dia (no fuso da pessoa) em que o instante caiu. */
export function inicioDoDia(data: Date, fuso: string): Date {
  const r = relogioLocal(data, fuso);
  return inicioDoDiaLocal(r.ano, r.mes, r.dia, fuso);
}

/** Dia da semana no fuso da pessoa, com segunda-feira = 0 (padrão do Brasil). */
export function diaDaSemana(data: Date, fuso: string): number {
  const r = relogioLocal(data, fuso);
  return (new Date(Date.UTC(r.ano, r.mes - 1, r.dia)).getUTCDay() + 6) % 7;
}

/** Segunda-feira da semana em que o instante caiu, no fuso da pessoa. */
export function inicioDaSemana(data: Date, fuso: string): Date {
  const inicio = inicioDoDia(data, fuso);
  const recuo = diaDaSemana(data, fuso);
  return recuo === 0 ? inicio : inicioDoDia(new Date(inicio.getTime() - recuo * UM_DIA + UM_DIA / 2), fuso);
}

/** Primeiro dia do mês em que o instante caiu, no fuso da pessoa. */
export function inicioDoMes(data: Date, fuso: string): Date {
  const r = relogioLocal(data, fuso);
  return inicioDoDiaLocal(r.ano, r.mes, 1, fuso);
}

/** Mesma hora local, `meses` meses antes (ou depois, com número negativo). */
export function somarMeses(data: Date, meses: number, fuso: string): Date {
  const r = relogioLocal(data, fuso);
  const alvo = new Date(Date.UTC(r.ano, r.mes - 1 + meses, 1));
  return inicioDoDiaLocal(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 1, fuso);
}

/**
 * Soma dias mantendo a meia-noite local — atravessa mudanças de fuso sem
 * escorregar para 23h do dia anterior.
 */
export function somarDias(data: Date, dias: number, fuso: string): Date {
  const meio = new Date(data.getTime() + dias * UM_DIA + UM_DIA / 2);
  return inicioDoDia(meio, fuso);
}

/**
 * Fuso da conta, com o padrão aplicado quando ela ainda não informou.
 * Consulta leve: uma coluna só, usada nas telas que agrupam por dia.
 */
export async function fusoDoUsuario(uid: string): Promise<string> {
  const { prisma } = await import('./prisma');
  const user = await prisma.user.findUnique({ where: { id: uid }, select: { timeZone: true } });
  return fusoValido(user?.timeZone);
}
