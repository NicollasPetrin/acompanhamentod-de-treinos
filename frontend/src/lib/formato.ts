/** Formatadores pt-BR usados em toda a interface. */
import type { Unidade } from './tipos';

const numeroBR = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const numeroInteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

export const formatarNumero = (valor: number, casas = 1) =>
  casas === 0 ? numeroInteiro.format(valor) : numeroBR.format(valor);

/** Converte de kg (padrão do banco) para a unidade escolhida pelo usuário. */
export const paraUnidade = (kg: number, unidade: Unidade) => (unidade === 'lb' ? kg / 0.45359237 : kg);
export const paraKg = (valor: number, unidade: Unidade) => (unidade === 'lb' ? valor * 0.45359237 : valor);

export const formatarPeso = (kg: number, unidade: Unidade = 'kg', comUnidade = true) => {
  const valor = paraUnidade(kg, unidade);
  const texto = numeroBR.format(Math.round(valor * 100) / 100);
  return comUnidade ? `${texto} ${unidade}` : texto;
};

/** 12345 kg → "12,3 t" (volume de treino fica mais legível em toneladas). */
export const formatarVolume = (kg: number, unidade: Unidade = 'kg') => {
  const valor = paraUnidade(kg, unidade);
  if (valor >= 1000) return `${numeroBR.format(valor / 1000)} ${unidade === 'kg' ? 't' : 'k lb'}`;
  return `${numeroInteiro.format(valor)} ${unidade}`;
};

export const formatarDuracao = (segundos: number) => {
  const total = Math.max(0, Math.round(segundos));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

export const formatarMinutos = (segundos: number) => {
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
};

const dataCurta = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
const dataCompleta = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const dataExtensa = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
const horaCurta = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

export const formatarData = (data: string | Date) => dataCompleta.format(new Date(data));
export const formatarDataCurta = (data: string | Date) => dataCurta.format(new Date(data));
export const formatarDataExtensa = (data: string | Date) => dataExtensa.format(new Date(data));
export const formatarHora = (data: string | Date) => horaCurta.format(new Date(data));

/** "hoje", "ontem", "há 3 dias" ou a data completa. */
export function formatarDataRelativa(data: string | Date) {
  const d = new Date(data);
  const hoje = new Date();
  const diff = Math.floor((hoje.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);

  if (diff === 0) return 'hoje';
  if (diff === 1) return 'ontem';
  if (diff > 1 && diff < 7) return `há ${diff} dias`;
  if (diff < 0) return formatarData(d);
  return formatarData(d);
}

export const chaveDoDia = (data: Date) =>
  `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;

export const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export const primeiraMaiuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

/** Plural simples: 3 "treino" → "3 treinos". */
export const plural = (quantidade: number, singular: string, pluralForma?: string) =>
  `${formatarNumero(quantidade, 0)} ${quantidade === 1 ? singular : pluralForma ?? `${singular}s`}`;
