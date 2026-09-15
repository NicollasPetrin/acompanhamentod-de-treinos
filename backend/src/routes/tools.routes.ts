import { Router } from 'express';
import { z } from 'zod';
import { getQuery, validate } from '../middleware/validate';
import {
  ANILHAS_PADRAO_KG,
  calcularAnilhas,
  estimar1RM,
  kgParaLb,
  lbParaKg,
  repsEstimadas,
  arredondar,
} from '../utils/calculations';

export const toolsRouter = Router();

/**
 * GET /api/ferramentas/1rm?peso=100&reps=5
 * Calculadora de 1RM com as duas fórmulas e a tabela de percentuais.
 */
toolsRouter.get(
  '/1rm',
  validate(
    z.object({
      peso: z.coerce.number().min(0).max(2000),
      reps: z.coerce.number().int().min(1).max(50),
      formula: z.enum(['epley', 'brzycki']).default('epley'),
    }),
    'query',
  ),
  (req, res) => {
    const { peso, reps, formula } = getQuery<{ peso: number; reps: number; formula: 'epley' | 'brzycki' }>(req);
    const umRm = estimar1RM(peso, reps, formula);

    const percentuais = [95, 90, 85, 80, 75, 70, 65, 60, 55, 50].map((pct) => {
      const carga = arredondar((umRm * pct) / 100, 1);
      return { percentual: pct, carga, repsEstimadas: repsEstimadas(umRm, carga) };
    });

    res.json({
      umRm,
      epley: estimar1RM(peso, reps, 'epley'),
      brzycki: estimar1RM(peso, reps, 'brzycki'),
      percentuais,
    });
  },
);

/**
 * GET /api/ferramentas/anilhas?peso=100&barra=20
 * Quantas anilhas colocar de cada lado da barra.
 */
toolsRouter.get(
  '/anilhas',
  validate(
    z.object({
      peso: z.coerce.number().min(0).max(1000),
      barra: z.coerce.number().min(0).max(50).default(20),
      anilhas: z.string().optional(),
    }),
    'query',
  ),
  (req, res) => {
    const { peso, barra, anilhas } = getQuery<{ peso: number; barra: number; anilhas?: string }>(req);
    const disponiveis = anilhas
      ? anilhas
          .split(',')
          .map((a) => Number(a.trim()))
          .filter((a) => Number.isFinite(a) && a > 0)
      : ANILHAS_PADRAO_KG;

    res.json(calcularAnilhas(peso, barra, disponiveis.length ? disponiveis : ANILHAS_PADRAO_KG));
  },
);

/** GET /api/ferramentas/conversao?valor=100&de=kg&para=lb */
toolsRouter.get(
  '/conversao',
  validate(
    z.object({
      valor: z.coerce.number(),
      de: z.enum(['kg', 'lb']),
      para: z.enum(['kg', 'lb']),
    }),
    'query',
  ),
  (req, res) => {
    const { valor, de, para } = getQuery<{ valor: number; de: 'kg' | 'lb'; para: 'kg' | 'lb' }>(req);
    const resultado = de === para ? valor : de === 'kg' ? kgParaLb(valor) : lbParaKg(valor);
    res.json({ valor, de, para, resultado: arredondar(resultado, 2) });
  },
);
