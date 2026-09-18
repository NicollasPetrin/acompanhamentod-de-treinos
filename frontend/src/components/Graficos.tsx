import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useEffect, useState, type ReactNode } from 'react';
import { EVENTO_TEMA } from '../lib/tema';

/** Paleta dos gráficos — legível nos temas claro e escuro. */
export const COR_INFO = '#60a5fa';
export const COR_ALERTA = '#fbbf24';

const lerVariavel = (nome: string, padrao: string) => {
  if (typeof window === 'undefined') return padrao;
  const valor = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
  return valor ? `rgb(${valor})` : padrao;
};

/**
 * Cor de destaque escolhida pelo usuário, lida da variável CSS. Recharts
 * precisa de uma cor concreta, então acompanhamos as trocas de tema pelo
 * evento disparado em lib/tema.ts.
 */
export function useCorPrimaria() {
  const [cor, setCor] = useState(() => lerVariavel('--cor-primaria', '#22c55e'));

  useEffect(() => {
    const atualizar = () => setCor(lerVariavel('--cor-primaria', '#22c55e'));
    window.addEventListener(EVENTO_TEMA, atualizar);
    return () => window.removeEventListener(EVENTO_TEMA, atualizar);
  }, []);

  return cor;
}

const eixo = { fontSize: 11, fill: 'rgb(var(--cor-texto-suave))' };
const grade = 'rgb(var(--cor-borda))';

/** 12500 → "12,5 mil": mantém o eixo legível em telas de 360px. */
const compacto = (valor: number) => {
  if (Math.abs(valor) >= 1000) {
    return `${(valor / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  }
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
};

/** Tooltip com o visual do app (o padrão do Recharts é claro demais). */
function DicaPersonalizada({
  active,
  payload,
  label,
  formatador,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
  label?: string | number;
  formatador?: (valor: number, nome: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-borda bg-superficie px-3 py-2 text-sm shadow-lg">
      {label !== undefined && <p className="mb-1 font-medium">{label}</p>}
      {payload.map((item, i) => (
        <p key={i} className="flex items-center gap-1.5 text-texto-suave">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} aria-hidden />
          {formatador && typeof item.value === 'number'
            ? formatador(item.value, item.name ?? '')
            : `${item.name}: ${item.value}`}
        </p>
      ))}
    </div>
  );
}

interface BaseProps {
  dados: Array<Record<string, string | number>>;
  chaveX: string;
  altura?: number;
  formatador?: (valor: number, nome: string) => string;
  formatarEixoX?: (valor: string) => string;
}

export function GraficoLinha({
  dados,
  chaveX,
  chaveY,
  cor,
  altura = 220,
  formatador,
  formatarEixoX,
}: BaseProps & { chaveY: string; cor?: string }) {
  const corPadrao = useCorPrimaria();
  const traco = cor ?? corPadrao;
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <LineChart data={dados} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={grade} vertical={false} />
        <XAxis dataKey={chaveX} tick={eixo} tickLine={false} axisLine={false} tickFormatter={formatarEixoX} />
        <YAxis tick={eixo} tickLine={false} axisLine={false} width={56} tickFormatter={compacto} />
        <Tooltip content={<DicaPersonalizada formatador={formatador} />} />
        <Line type="monotone" dataKey={chaveY} stroke={traco} strokeWidth={2.5} dot={{ r: 3, fill: traco }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function GraficoArea({
  dados,
  chaveX,
  chaveY,
  cor,
  altura = 220,
  formatador,
  formatarEixoX,
}: BaseProps & { chaveY: string; cor?: string }) {
  const corPadrao = useCorPrimaria();
  const traco = cor ?? corPadrao;
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <AreaChart data={dados} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
        <defs>
          <linearGradient id={`gradiente-${chaveY}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={traco} stopOpacity={0.35} />
            <stop offset="95%" stopColor={traco} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={grade} vertical={false} />
        <XAxis dataKey={chaveX} tick={eixo} tickLine={false} axisLine={false} tickFormatter={formatarEixoX} />
        <YAxis tick={eixo} tickLine={false} axisLine={false} width={56} tickFormatter={compacto} />
        <Tooltip content={<DicaPersonalizada formatador={formatador} />} />
        <Area type="monotone" dataKey={chaveY} stroke={traco} strokeWidth={2.5} fill={`url(#gradiente-${chaveY})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function GraficoBarras({
  dados,
  chaveX,
  chaveY,
  cor,
  altura = 220,
  formatador,
  formatarEixoX,
  cores,
}: BaseProps & { chaveY: string; cor?: string; cores?: string[] }) {
  const corPadrao = useCorPrimaria();
  const preenchimento = cor ?? corPadrao;
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <BarChart data={dados} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={grade} vertical={false} />
        <XAxis dataKey={chaveX} tick={eixo} tickLine={false} axisLine={false} tickFormatter={formatarEixoX} />
        <YAxis tick={eixo} tickLine={false} axisLine={false} width={56} tickFormatter={compacto} />
        <Tooltip content={<DicaPersonalizada formatador={formatador} />} cursor={{ fill: 'rgb(var(--cor-superficie-2))' }} />
        <Bar dataKey={chaveY} radius={[6, 6, 0, 0]} fill={preenchimento}>
          {cores?.map((c, i) => <Cell key={i} fill={c} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GraficoPizza({
  dados,
  chaveValor,
  chaveNome,
  cores,
  altura = 240,
  formatador,
}: {
  dados: Array<Record<string, string | number>>;
  chaveValor: string;
  chaveNome: string;
  cores: string[];
  altura?: number;
  formatador?: (valor: number, nome: string) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <PieChart>
        <Pie data={dados} dataKey={chaveValor} nameKey={chaveNome} innerRadius="52%" outerRadius="80%" paddingAngle={2}>
          {dados.map((_, i) => (
            <Cell key={i} fill={cores[i % cores.length]} stroke="rgb(var(--cor-superficie))" strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip content={<DicaPersonalizada formatador={formatador} />} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Moldura padrão dos gráficos, com título e legenda opcional. */
export function CartaoGrafico({
  titulo,
  descricao,
  children,
  acao,
}: {
  titulo: string;
  descricao?: string;
  children: ReactNode;
  acao?: ReactNode;
}) {
  return (
    <div className="cartao p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{titulo}</h3>
          {descricao && <p className="text-sm text-texto-suave">{descricao}</p>}
        </div>
        {acao}
      </div>
      {children}
    </div>
  );
}
