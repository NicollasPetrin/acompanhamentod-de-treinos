/**
 * Gera a ilustração de um exercício como SVG (sem depender de arquivos ou
 * serviços externos): dois bonecos — vista frontal e posterior — com os
 * músculos trabalhados destacados, além do equipamento usado.
 *
 * Servido em GET /api/exercicios/:id/imagem.svg
 */

type Regiao =
  | 'peito' | 'costas' | 'ombros' | 'biceps' | 'triceps' | 'antebraco'
  | 'quadriceps' | 'posterior' | 'gluteos' | 'panturrilha' | 'abdomen'
  | 'corpo_todo' | 'cardio';

interface Parte {
  regioes: Regiao[];
  shape: string;
}

const COR_BASE = '#2a3440';
const COR_PRIMARIA = '#22c55e';
const COR_SECUNDARIA = '#15803d';
const COR_CONTORNO = '#0f1620';

/** Vista frontal (centro x = cx). */
const frente = (cx: number): Parte[] => [
  { regioes: [], shape: `<ellipse cx="${cx}" cy="40" rx="19" ry="23" />` },
  { regioes: [], shape: `<rect x="${cx - 8}" y="60" width="16" height="12" rx="4" />` },
  { regioes: ['ombros'], shape: `<ellipse cx="${cx - 40}" cy="84" rx="15" ry="13" /><ellipse cx="${cx + 40}" cy="84" rx="15" ry="13" />` },
  { regioes: ['peito'], shape: `<path d="M${cx - 32} 74 h64 a6 6 0 0 1 6 6 v28 a8 8 0 0 1 -8 8 h-60 a8 8 0 0 1 -8 -8 v-28 a6 6 0 0 1 6 -6 z" />` },
  { regioes: ['abdomen'], shape: `<rect x="${cx - 24}" y="118" width="48" height="46" rx="8" />` },
  { regioes: ['biceps'], shape: `<rect x="${cx - 58}" y="92" width="16" height="46" rx="8" /><rect x="${cx + 42}" y="92" width="16" height="46" rx="8" />` },
  { regioes: ['antebraco'], shape: `<rect x="${cx - 62}" y="140" width="14" height="42" rx="7" /><rect x="${cx + 48}" y="140" width="14" height="42" rx="7" />` },
  { regioes: ['quadriceps'], shape: `<rect x="${cx - 26}" y="168" width="24" height="60" rx="10" /><rect x="${cx + 2}" y="168" width="24" height="60" rx="10" />` },
  { regioes: ['panturrilha'], shape: `<rect x="${cx - 24}" y="234" width="20" height="46" rx="9" /><rect x="${cx + 4}" y="234" width="20" height="46" rx="9" />` },
];

/** Vista posterior (centro x = cx). */
const costas = (cx: number): Parte[] => [
  { regioes: [], shape: `<ellipse cx="${cx}" cy="40" rx="19" ry="23" />` },
  { regioes: ['costas'], shape: `<path d="M${cx - 30} 66 h60 a6 6 0 0 1 6 6 v18 h-72 v-18 a6 6 0 0 1 6 -6 z" />` },
  { regioes: ['ombros'], shape: `<ellipse cx="${cx - 40}" cy="88" rx="15" ry="13" /><ellipse cx="${cx + 40}" cy="88" rx="15" ry="13" />` },
  { regioes: ['costas'], shape: `<path d="M${cx - 34} 92 h68 l-10 46 h-48 z" />` },
  { regioes: ['costas'], shape: `<rect x="${cx - 18}" y="138" width="36" height="26" rx="6" />` },
  { regioes: ['triceps'], shape: `<rect x="${cx - 58}" y="96" width="16" height="44" rx="8" /><rect x="${cx + 42}" y="96" width="16" height="44" rx="8" />` },
  { regioes: ['antebraco'], shape: `<rect x="${cx - 62}" y="142" width="14" height="40" rx="7" /><rect x="${cx + 48}" y="142" width="14" height="40" rx="7" />` },
  { regioes: ['gluteos'], shape: `<ellipse cx="${cx - 14}" cy="176" rx="15" ry="14" /><ellipse cx="${cx + 14}" cy="176" rx="15" ry="14" />` },
  { regioes: ['posterior'], shape: `<rect x="${cx - 26}" y="190" width="24" height="52" rx="10" /><rect x="${cx + 2}" y="190" width="24" height="52" rx="10" />` },
  { regioes: ['panturrilha'], shape: `<rect x="${cx - 24}" y="246" width="20" height="40" rx="9" /><rect x="${cx + 4}" y="246" width="20" height="40" rx="9" />` },
];

const ICONES_EQUIPAMENTO: Record<string, string> = {
  barra: '<rect x="8" y="20" width="84" height="6" rx="3" /><rect x="14" y="12" width="8" height="22" rx="2" /><rect x="78" y="12" width="8" height="22" rx="2" />',
  halter: '<rect x="30" y="20" width="40" height="6" rx="3" /><rect x="18" y="12" width="12" height="22" rx="3" /><rect x="70" y="12" width="12" height="22" rx="3" />',
  maquina: '<rect x="20" y="8" width="60" height="30" rx="6" /><rect x="34" y="16" width="32" height="6" rx="3" />',
  cabo: '<circle cx="50" cy="12" r="6" /><rect x="48" y="16" width="4" height="16" /><rect x="34" y="30" width="32" height="6" rx="3" />',
  peso_corporal: '<circle cx="50" cy="12" r="7" /><rect x="46" y="20" width="8" height="16" rx="4" /><rect x="30" y="22" width="16" height="5" rx="2" /><rect x="54" y="22" width="16" height="5" rx="2" />',
  kettlebell: '<path d="M40 14 a10 10 0 0 1 20 0" fill="none" stroke="currentColor" stroke-width="5" /><path d="M34 20 h32 a14 14 0 0 1 -32 0 z" />',
  elastico: '<path d="M14 30 q36 -30 72 0" fill="none" stroke="currentColor" stroke-width="5" />',
  outro: '<circle cx="50" cy="24" r="12" />',
};

export interface OpcoesIlustracao {
  nome: string;
  grupoPrincipal: string;
  gruposSecundarios: string[];
  equipamento: string;
}

export function gerarSvgExercicio({
  nome,
  grupoPrincipal,
  gruposSecundarios,
  equipamento,
}: OpcoesIlustracao): string {
  const principais = new Set<string>(
    grupoPrincipal === 'corpo_todo' || grupoPrincipal === 'cardio'
      ? ['peito', 'costas', 'ombros', 'quadriceps', 'posterior', 'abdomen', 'gluteos']
      : [grupoPrincipal],
  );
  const secundarios = new Set(gruposSecundarios);

  const pintar = (partes: Parte[]) =>
    partes
      .map((p) => {
        const destaquePrincipal = p.regioes.some((r) => principais.has(r));
        const destaqueSecundario = !destaquePrincipal && p.regioes.some((r) => secundarios.has(r));
        const fill = destaquePrincipal ? COR_PRIMARIA : destaqueSecundario ? COR_SECUNDARIA : COR_BASE;
        return `<g fill="${fill}" stroke="${COR_CONTORNO}" stroke-width="2">${p.shape}</g>`;
      })
      .join('');

  const icone = ICONES_EQUIPAMENTO[equipamento] ?? ICONES_EQUIPAMENTO.outro;
  const titulo = nome.replace(/[<>&]/g, '');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 400" width="440" height="400" role="img" aria-label="Ilustração do exercício ${titulo}">
  <title>${titulo}</title>
  <rect width="440" height="400" fill="#121821" rx="16" />
  <text x="220" y="26" fill="#e5efe8" font-family="system-ui,sans-serif" font-size="16" font-weight="600" text-anchor="middle">${titulo.length > 42 ? `${titulo.slice(0, 40)}…` : titulo}</text>
  <g transform="translate(0,26)">
    ${pintar(frente(120))}
    ${pintar(costas(320))}
  </g>
  <text x="120" y="378" fill="#7c8a99" font-family="system-ui,sans-serif" font-size="12" text-anchor="middle">frente</text>
  <text x="320" y="378" fill="#7c8a99" font-family="system-ui,sans-serif" font-size="12" text-anchor="middle">costas</text>
  <g transform="translate(180,336) scale(0.8)" fill="#22c55e" color="#22c55e">${icone}</g>
</svg>`;
}
