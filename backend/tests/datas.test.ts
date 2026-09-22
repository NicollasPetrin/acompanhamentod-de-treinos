import { beforeAll, describe, expect, it } from 'vitest';
import {
  chaveDoDia,
  chaveDoMes,
  diaDaSemana,
  FUSO_PADRAO,
  fusoValido,
  horaLocal,
  inicioDaSemana,
  inicioDoDia,
  inicioDoMes,
  somarDias,
  somarMeses,
} from '../src/lib/datas';

/**
 * Os testes rodam com o relógio do servidor em UTC — como na Vercel. É
 * justamente aí que o bug aparecia: treino da noite de terça no Brasil virava
 * quarta-feira para o servidor.
 */
beforeAll(() => {
  process.env.TZ = 'UTC';
});

// 21/09/2026 às 21:30 em São Paulo = 22/09 00:30 UTC
const TREINO_DA_NOITE = new Date('2026-09-22T00:30:00.000Z');
// 22/09/2026 às 10:00 em São Paulo
const MANHA_SEGUINTE = new Date('2026-09-22T13:00:00.000Z');

describe('datas no fuso de quem treina', () => {
  it('treino da noite fica no dia em que a pessoa treinou, não no dia seguinte', () => {
    expect(chaveDoDia(TREINO_DA_NOITE, FUSO_PADRAO)).toBe('2026-09-21');
    expect(chaveDoDia(MANHA_SEGUINTE, FUSO_PADRAO)).toBe('2026-09-22');
    // o que o app fazia antes: os dois caíam no mesmo dia
    expect(TREINO_DA_NOITE.toISOString().slice(0, 10)).toBe(MANHA_SEGUINTE.toISOString().slice(0, 10));
  });

  it('a hora local também é a de quem treinou', () => {
    expect(horaLocal(TREINO_DA_NOITE, FUSO_PADRAO)).toBe(21);
    expect(horaLocal(MANHA_SEGUINTE, FUSO_PADRAO)).toBe(10);
  });

  it('o começo do dia é meia-noite no fuso da pessoa', () => {
    const inicio = inicioDoDia(TREINO_DA_NOITE, FUSO_PADRAO);
    expect(inicio.toISOString()).toBe('2026-09-21T03:00:00.000Z'); // 00:00 em São Paulo
    expect(chaveDoDia(inicio, FUSO_PADRAO)).toBe('2026-09-21');
  });

  it('a semana começa na segunda-feira local', () => {
    // 21/09/2026 é uma segunda-feira
    expect(diaDaSemana(TREINO_DA_NOITE, FUSO_PADRAO)).toBe(0);
    expect(inicioDaSemana(TREINO_DA_NOITE, FUSO_PADRAO).toISOString()).toBe('2026-09-21T03:00:00.000Z');

    // domingo 27/09 às 22h em São Paulo ainda pertence à semana que começou dia 21
    const domingoANoite = new Date('2026-09-28T01:00:00.000Z');
    expect(diaDaSemana(domingoANoite, FUSO_PADRAO)).toBe(6);
    expect(inicioDaSemana(domingoANoite, FUSO_PADRAO).toISOString()).toBe('2026-09-21T03:00:00.000Z');

    // segunda 28/09 de manhã já abre a semana seguinte
    const segundaDeManha = new Date('2026-09-28T13:00:00.000Z');
    expect(inicioDaSemana(segundaDeManha, FUSO_PADRAO).toISOString()).toBe('2026-09-28T03:00:00.000Z');
  });

  it('o mês vira na virada local, não na do servidor', () => {
    // 30/09/2026 às 22h em São Paulo = 01/10 01:00 UTC
    const ultimaNoiteDoMes = new Date('2026-10-01T01:00:00.000Z');
    expect(chaveDoMes(ultimaNoiteDoMes, FUSO_PADRAO)).toBe('2026-09');
    expect(inicioDoMes(ultimaNoiteDoMes, FUSO_PADRAO).toISOString()).toBe('2026-09-01T03:00:00.000Z');
  });

  it('somar dias e meses mantém a meia-noite local', () => {
    const inicio = inicioDoDia(MANHA_SEGUINTE, FUSO_PADRAO);
    expect(chaveDoDia(somarDias(inicio, -1, FUSO_PADRAO), FUSO_PADRAO)).toBe('2026-09-21');
    expect(chaveDoDia(somarDias(inicio, 5, FUSO_PADRAO), FUSO_PADRAO)).toBe('2026-09-27');
    expect(chaveDoMes(somarMeses(MANHA_SEGUINTE, -2, FUSO_PADRAO), FUSO_PADRAO)).toBe('2026-07');
  });

  it('funciona para quem está em outro fuso', () => {
    // o mesmo instante, para alguém em Lisboa (UTC+1), já é dia 22
    expect(chaveDoDia(TREINO_DA_NOITE, 'Europe/Lisbon')).toBe('2026-09-22');
    // e para alguém em Los Angeles (UTC-7), ainda é dia 21 de tarde
    expect(chaveDoDia(TREINO_DA_NOITE, 'America/Los_Angeles')).toBe('2026-09-21');
    expect(horaLocal(TREINO_DA_NOITE, 'America/Los_Angeles')).toBe(17);
  });

  it('atravessa o horário de verão sem escorregar de dia', () => {
    // Nova York entra no horário de verão em 08/03/2026
    const sabadoAntes = new Date('2026-03-07T17:00:00.000Z'); // 12:00 em NY (UTC-5)
    const segundaDepois = new Date('2026-03-09T16:00:00.000Z'); // 12:00 em NY (UTC-4)

    expect(chaveDoDia(sabadoAntes, 'America/New_York')).toBe('2026-03-07');
    expect(chaveDoDia(segundaDepois, 'America/New_York')).toBe('2026-03-09');
    expect(chaveDoDia(inicioDoDia(segundaDepois, 'America/New_York'), 'America/New_York')).toBe('2026-03-09');

    // a semana de segunda 09/03 começa depois da virada do relógio
    expect(inicioDaSemana(segundaDepois, 'America/New_York').toISOString()).toBe('2026-03-09T04:00:00.000Z');
    // e voltar sete dias cai na segunda anterior, ainda no horário antigo
    const semanaAnterior = somarDias(inicioDaSemana(segundaDepois, 'America/New_York'), -7, 'America/New_York');
    expect(chaveDoDia(semanaAnterior, 'America/New_York')).toBe('2026-03-02');
    expect(semanaAnterior.toISOString()).toBe('2026-03-02T05:00:00.000Z');
  });

  it('fuso inválido não derruba nada — cai no padrão', () => {
    expect(fusoValido('Marte/Olympus')).toBe(FUSO_PADRAO);
    expect(fusoValido(null)).toBe(FUSO_PADRAO);
    expect(fusoValido('Europe/Lisbon')).toBe('Europe/Lisbon');
    expect(chaveDoDia(TREINO_DA_NOITE, 'Marte/Olympus')).toBe('2026-09-21');
  });
});
