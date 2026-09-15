/** Parser/serializador de CSV simples (suporta aspas, vírgulas e quebras de linha). */

export function parseCsv(texto: string): Record<string, string>[] {
  const linhas = dividirLinhas(texto.replace(/^﻿/, ''));
  if (linhas.length === 0) return [];

  const separador = detectarSeparador(linhas[0]);
  const cabecalho = dividirLinha(linhas[0], separador).map((h) => h.trim());

  return linhas.slice(1).flatMap((linha) => {
    if (!linha.trim()) return [];
    const campos = dividirLinha(linha, separador);
    const registro: Record<string, string> = {};
    cabecalho.forEach((chave, i) => {
      registro[chave] = (campos[i] ?? '').trim();
    });
    return [registro];
  });
}

const detectarSeparador = (linha: string) => {
  const virgulas = (linha.match(/,/g) ?? []).length;
  const pontoVirgulas = (linha.match(/;/g) ?? []).length;
  return pontoVirgulas > virgulas ? ';' : ',';
};

/** Quebra o arquivo em linhas respeitando quebras dentro de aspas. */
function dividirLinhas(texto: string): string[] {
  const linhas: string[] = [];
  let atual = '';
  let dentroAspas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === '"') {
      if (dentroAspas && texto[i + 1] === '"') {
        atual += '""';
        i++;
        continue;
      }
      dentroAspas = !dentroAspas;
      atual += c;
    } else if ((c === '\n' || c === '\r') && !dentroAspas) {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      linhas.push(atual);
      atual = '';
    } else {
      atual += c;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

function dividirLinha(linha: string, separador: string): string[] {
  const campos: string[] = [];
  let atual = '';
  let dentroAspas = false;

  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (dentroAspas && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else {
        dentroAspas = !dentroAspas;
      }
    } else if (c === separador && !dentroAspas) {
      campos.push(atual);
      atual = '';
    } else {
      atual += c;
    }
  }
  campos.push(atual);
  return campos;
}

export function toCsv(linhas: Record<string, unknown>[], colunas?: string[]): string {
  if (linhas.length === 0) return '';
  const chaves = colunas ?? [...new Set(linhas.flatMap((l) => Object.keys(l)))];
  const escapar = (valor: unknown) => {
    const texto = valor === null || valor === undefined ? '' : String(valor);
    return /[",\n;]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  return [chaves.join(','), ...linhas.map((l) => chaves.map((k) => escapar(l[k])).join(','))].join('\n');
}

/** Normaliza nomes para comparação (sem acento, minúsculo, só letras e números). */
export const normalizarNome = (nome: string) =>
  nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
