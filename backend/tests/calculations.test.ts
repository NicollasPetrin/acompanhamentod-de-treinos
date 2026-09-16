import { describe, expect, it } from 'vitest';
import {
  arredondar,
  calcularAnilhas,
  calcularStreakDias,
  detectarRecordes,
  estimar1RM,
  kgParaLb,
  lbParaKg,
  progressoMeta,
  repsEstimadas,
  resumirSeries,
  valorDoRecorde,
  volumeDaSerie,
  volumeTotal,
} from '../src/utils/calculations';

describe('1RM estimado', () => {
  it('devolve a própria carga quando são 1 repetição', () => {
    expect(estimar1RM(100, 1)).toBe(100);
    expect(estimar1RM(100, 1, 'brzycki')).toBe(100);
  });

  it('usa a fórmula de Epley por padrão', () => {
    // 100 × (1 + 10/30) = 133,33
    expect(estimar1RM(100, 10)).toBeCloseTo(133.33, 2);
    expect(estimar1RM(80, 5)).toBeCloseTo(93.33, 2);
  });

  it('usa a fórmula de Brzycki quando pedida', () => {
    // 100 × 36 / (37 − 10) = 133,33
    expect(estimar1RM(100, 10, 'brzycki')).toBeCloseTo(133.33, 2);
    expect(estimar1RM(100, 5, 'brzycki')).toBeCloseTo(112.5, 2);
  });

  it('protege contra entradas inválidas', () => {
    expect(estimar1RM(0, 10)).toBe(0);
    expect(estimar1RM(100, 0)).toBe(0);
    expect(estimar1RM(-50, 5)).toBe(0);
    expect(estimar1RM(100, 40, 'brzycki')).toBe(0);
    expect(estimar1RM(Number.NaN, 5)).toBe(0);
  });

  it('estima repetições a partir do 1RM', () => {
    expect(repsEstimadas(100, 100)).toBe(1);
    expect(repsEstimadas(133.33, 100)).toBe(10);
    expect(repsEstimadas(100, 120)).toBe(0);
  });
});

describe('volume', () => {
  it('multiplica carga por repetições', () => {
    expect(volumeDaSerie({ weight: 80, reps: 10 })).toBe(800);
  });

  it('ignora séries de aquecimento e não concluídas', () => {
    expect(volumeDaSerie({ weight: 40, reps: 15, type: 'aquecimento' })).toBe(0);
    expect(volumeDaSerie({ weight: 80, reps: 10, completed: false })).toBe(0);
  });

  it('soma o volume de várias séries', () => {
    const series = [
      { weight: 40, reps: 12, type: 'aquecimento' as const, completed: true },
      { weight: 80, reps: 10, completed: true },
      { weight: 80, reps: 8, completed: true },
      { weight: 90, reps: 6, completed: false },
    ];
    expect(volumeTotal(series)).toBe(800 + 640);
  });

  it('resume séries concluídas, repetições e carga máxima', () => {
    const resumo = resumirSeries([
      { weight: 40, reps: 12, type: 'aquecimento', completed: true },
      { weight: 100, reps: 5, completed: true },
      { weight: 90, reps: 8, completed: true },
      { weight: 110, reps: 3, completed: false },
    ]);
    expect(resumo.seriesConcluidas).toBe(3);
    expect(resumo.repeticoes).toBe(13);
    expect(resumo.volume).toBe(500 + 720);
    expect(resumo.cargaMaxima).toBe(100);
  });
});

describe('detecção de recordes pessoais', () => {
  it('considera tudo recorde quando não há marcas anteriores', () => {
    expect(detectarRecordes({ weight: 60, reps: 10, completed: true })).toEqual([
      'carga',
      'reps',
      'volume',
      '1rm',
    ]);
  });

  it('só marca PR quando o valor supera a marca anterior', () => {
    // Marcas vindas de uma série de 100 kg × 10 (volume 1000, 1RM 133,33)
    const melhores = { carga: 100, reps: 10, volume: 1000, '1rm': 133.33 };
    expect(detectarRecordes({ weight: 100, reps: 10, completed: true }, melhores)).toEqual([]);
    expect(detectarRecordes({ weight: 105, reps: 5, completed: true }, melhores)).toEqual(['carga']);
    expect(detectarRecordes({ weight: 90, reps: 12, completed: true }, melhores)).toContain('reps');
  });

  it('detecta PR de volume e de 1RM separadamente', () => {
    const melhores = { carga: 100, reps: 12, volume: 800, '1rm': 130 };
    // 90 × 11 = 990 de volume e 1RM estimado 123 → só volume
    expect(detectarRecordes({ weight: 90, reps: 11, completed: true }, melhores)).toEqual(['volume']);
  });

  it('nunca gera PR em aquecimento ou série não concluída', () => {
    expect(detectarRecordes({ weight: 200, reps: 10, type: 'aquecimento', completed: true })).toEqual([]);
    expect(detectarRecordes({ weight: 200, reps: 10, completed: false })).toEqual([]);
    expect(detectarRecordes({ weight: 200, reps: 0, completed: true })).toEqual([]);
  });

  it('calcula o valor de cada tipo de recorde', () => {
    const serie = { weight: 100, reps: 5, completed: true };
    expect(valorDoRecorde('carga', serie)).toBe(100);
    expect(valorDoRecorde('reps', serie)).toBe(5);
    expect(valorDoRecorde('volume', serie)).toBe(500);
    expect(valorDoRecorde('1rm', serie)).toBeCloseTo(116.67, 2);
  });
});

describe('calculadora de anilhas', () => {
  it('distribui as anilhas por lado, da mais pesada para a mais leve', () => {
    const resultado = calcularAnilhas(100, 20);
    expect(resultado.possivel).toBe(true);
    // 40 kg por lado: a estratégia gulosa usa a anilha de 25 e depois a de 15
    expect(resultado.porLado).toEqual([
      { anilha: 25, quantidade: 1 },
      { anilha: 15, quantidade: 1 },
    ]);
    expect(resultado.pesoAlcancado).toBe(100);
  });

  it('respeita o conjunto de anilhas informado', () => {
    const resultado = calcularAnilhas(100, 20, [20, 10, 5]);
    expect(resultado.porLado).toEqual([{ anilha: 20, quantidade: 2 }]);
    expect(resultado.pesoAlcancado).toBe(100);
  });

  it('combina anilhas diferentes', () => {
    const resultado = calcularAnilhas(67.5, 20);
    expect(resultado.possivel).toBe(true);
    expect(resultado.porLado).toEqual([
      { anilha: 20, quantidade: 1 },
      { anilha: 2.5, quantidade: 1 },
      { anilha: 1.25, quantidade: 1 },
    ]);
  });

  it('avisa quando o peso alvo não é exato', () => {
    const resultado = calcularAnilhas(61, 20);
    expect(resultado.possivel).toBe(false);
    expect(resultado.diferenca).toBeGreaterThan(0);
  });

  it('avisa quando o alvo é menor que a barra', () => {
    expect(calcularAnilhas(15, 20).possivel).toBe(false);
  });
});

describe('utilidades', () => {
  it('converte kg e lb', () => {
    expect(kgParaLb(100)).toBeCloseTo(220.46, 2);
    expect(lbParaKg(220.46)).toBeCloseTo(100, 2);
  });

  it('arredonda sem ruído de ponto flutuante', () => {
    expect(arredondar(0.1 + 0.2)).toBe(0.3);
  });

  it('calcula a sequência de dias treinados', () => {
    const hoje = new Date('2026-09-15T12:00:00');
    const dias = [
      new Date('2026-09-15T08:00:00'),
      new Date('2026-09-14T08:00:00'),
      new Date('2026-09-13T08:00:00'),
      new Date('2026-09-10T08:00:00'),
    ];
    expect(calcularStreakDias(dias, hoje)).toBe(3);
    expect(calcularStreakDias([], hoje)).toBe(0);
  });

  it('mantém a sequência quando ainda não treinou hoje', () => {
    const hoje = new Date('2026-09-15T12:00:00');
    const dias = [new Date('2026-09-14T08:00:00'), new Date('2026-09-13T08:00:00')];
    expect(calcularStreakDias(dias, hoje)).toBe(2);
  });

  it('calcula o progresso de metas', () => {
    expect(progressoMeta(75, 100, 50)).toBe(50);
    expect(progressoMeta(120, 100, 50)).toBe(100);
    expect(progressoMeta(40, 100, 50)).toBe(0);
  });
});
