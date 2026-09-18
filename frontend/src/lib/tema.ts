/**
 * Tema da interface: modo claro/escuro e cor de destaque.
 *
 * As cores vivem em variáveis CSS (ver index.css), então trocar a cor é só
 * reescrever três variáveis — todos os botões, gráficos e indicadores seguem.
 */
import type { Tema } from './tipos';

export type CorDestaque =
  | 'verde'
  | 'rosa'
  | 'roxo'
  | 'azul'
  | 'ciano'
  | 'laranja'
  | 'vermelho'
  | 'amarelo';

interface Paleta {
  rotulo: string;
  /** Valores "R G B" — o formato que o Tailwind usa nas variáveis. */
  escuro: string;
  escuroHover: string;
  claro: string;
  claroHover: string;
  /** Cor do texto sobre a cor de destaque no tema escuro (tinta bem escura). */
  tinta: string;
}

/**
 * Paleta pensada para ter contraste suficiente nos dois temas: no escuro as
 * cores são claras (sobre fundo preto) e no claro são fechadas (sobre branco).
 */
export const CORES_DESTAQUE: Record<CorDestaque, Paleta> = {
  verde: {
    rotulo: 'Verde',
    escuro: '34 197 94',
    escuroHover: '22 163 74',
    claro: '21 128 61',
    claroHover: '20 100 50',
    tinta: '4 20 10',
  },
  rosa: {
    rotulo: 'Rosa',
    escuro: '244 114 182',
    escuroHover: '236 72 153',
    claro: '190 24 93',
    claroHover: '157 23 77',
    tinta: '35 6 20',
  },
  roxo: {
    rotulo: 'Roxo',
    escuro: '192 132 252',
    escuroHover: '168 85 247',
    claro: '126 34 206',
    claroHover: '107 33 168',
    tinta: '26 6 40',
  },
  azul: {
    rotulo: 'Azul',
    escuro: '96 165 250',
    escuroHover: '59 130 246',
    claro: '29 78 216',
    claroHover: '30 64 175',
    tinta: '6 17 40',
  },
  ciano: {
    rotulo: 'Ciano',
    escuro: '34 211 238',
    escuroHover: '6 182 212',
    claro: '14 116 144',
    claroHover: '21 94 117',
    tinta: '4 24 30',
  },
  laranja: {
    rotulo: 'Laranja',
    escuro: '251 146 60',
    escuroHover: '249 115 22',
    claro: '194 65 12',
    claroHover: '154 52 18',
    tinta: '35 15 2',
  },
  vermelho: {
    rotulo: 'Vermelho',
    escuro: '248 113 113',
    escuroHover: '239 68 68',
    claro: '185 28 28',
    claroHover: '153 27 27',
    tinta: '36 7 7',
  },
  amarelo: {
    rotulo: 'Amarelo',
    escuro: '250 204 21',
    escuroHover: '234 179 8',
    claro: '161 98 7',
    claroHover: '133 77 14',
    tinta: '35 25 2',
  },
};

export const ehCorValida = (valor: string | null | undefined): valor is CorDestaque =>
  Boolean(valor && valor in CORES_DESTAQUE);

/** Cor usada para mostrar a amostra da paleta nas configurações. */
export const amostraDaCor = (cor: CorDestaque, tema: Tema) => {
  const paleta = CORES_DESTAQUE[cor];
  return `rgb(${tema === 'dark' ? paleta.escuro : paleta.claro})`;
};

const CHAVE_TEMA = 'treinos.tema';
const CHAVE_COR = 'treinos.cor';

/** Evento disparado a cada troca — os gráficos escutam para se redesenhar. */
export const EVENTO_TEMA = 'treinos:tema-alterado';

/**
 * Aplica tema e cor no documento. Roda antes da primeira pintura (main.tsx) e
 * a cada mudança nas configurações.
 */
export function aplicarTema(tema: Tema, cor: CorDestaque = 'verde') {
  const paleta = CORES_DESTAQUE[ehCorValida(cor) ? cor : 'verde'];
  const raiz = document.documentElement;

  raiz.dataset.tema = tema;
  raiz.style.setProperty('--cor-primaria', tema === 'dark' ? paleta.escuro : paleta.claro);
  raiz.style.setProperty('--cor-primaria-escura', tema === 'dark' ? paleta.escuroHover : paleta.claroHover);
  // No tema claro a cor de destaque é fechada, então o texto por cima é branco
  raiz.style.setProperty('--cor-primaria-contraste', tema === 'dark' ? paleta.tinta : '255 255 255');

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', tema === 'dark' ? '#0b0f14' : '#f6f8fa');

  try {
    localStorage.setItem(CHAVE_TEMA, tema);
    localStorage.setItem(CHAVE_COR, cor);
  } catch {
    /* navegação privada: o tema volta ao padrão no próximo acesso */
  }

  window.dispatchEvent(new CustomEvent(EVENTO_TEMA, { detail: { tema, cor } }));
}

/** Preferências salvas no aparelho, usadas antes de a sessão carregar. */
export function temaSalvo(): { tema: Tema; cor: CorDestaque } {
  try {
    const tema = (localStorage.getItem(CHAVE_TEMA) as Tema | null) ?? 'dark';
    const cor = localStorage.getItem(CHAVE_COR);
    return { tema, cor: ehCorValida(cor) ? cor : 'verde' };
  } catch {
    return { tema: 'dark', cor: 'verde' };
  }
}
