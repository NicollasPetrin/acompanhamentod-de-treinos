import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, userId } from '../middleware/auth';
import { getQuery, validate } from '../middleware/validate';
import { serializeMeasurement } from '../lib/serialize';
import { parseJson, toJson } from '../lib/json';
import { badRequest, notFound } from '../lib/errors';
import { uploadImagem, urlPublica } from '../lib/upload';

export const measurementsRouter = Router();
measurementsRouter.use(requireAuth);

/** Medidas suportadas (em cm), além de peso e % de gordura. */
export const MEDIDAS = ['braco', 'antebraco', 'peito', 'cintura', 'quadril', 'coxa', 'panturrilha', 'pescoco', 'ombros'] as const;

const medidaSchema = z.object({
  date: z.coerce.date().default(() => new Date()),
  weightKg: z.number().min(20).max(400).nullable().optional(),
  bodyFatPct: z.number().min(1).max(70).nullable().optional(),
  measures: z.record(z.enum(MEDIDAS), z.number().min(1).max(300)).default({}),
  notes: z.string().max(1000).nullable().optional(),
});

/** GET /api/medidas — lista as medidas do usuário (mais recentes primeiro). */
measurementsRouter.get(
  '/',
  validate(z.object({ de: z.coerce.date().optional(), ate: z.coerce.date().optional() }), 'query'),
  async (req, res, next) => {
    try {
      const { de, ate } = getQuery<{ de?: Date; ate?: Date }>(req);
      const registros = await prisma.bodyMeasurement.findMany({
        where: {
          userId: userId(req),
          ...(de || ate ? { date: { ...(de ? { gte: de } : {}), ...(ate ? { lte: ate } : {}) } } : {}),
        },
        orderBy: { date: 'desc' },
      });
      res.json(registros.map(serializeMeasurement));
    } catch (err) {
      next(err);
    }
  },
);

/** GET /api/medidas/evolucao — séries temporais para os gráficos. */
measurementsRouter.get('/evolucao', async (req, res, next) => {
  try {
    const registros = await prisma.bodyMeasurement.findMany({
      where: { userId: userId(req) },
      orderBy: { date: 'asc' },
    });

    const series: Record<string, Array<{ date: Date; valor: number }>> = { peso: [], gordura: [] };
    for (const m of MEDIDAS) series[m] = [];

    for (const r of registros) {
      if (r.weightKg != null) series.peso.push({ date: r.date, valor: r.weightKg });
      if (r.bodyFatPct != null) series.gordura.push({ date: r.date, valor: r.bodyFatPct });
      const medidas = parseJson<Record<string, number>>(r.measures, {});
      for (const [chave, valor] of Object.entries(medidas)) {
        if (series[chave] && typeof valor === 'number') series[chave].push({ date: r.date, valor });
      }
    }

    res.json(series);
  } catch (err) {
    next(err);
  }
});

/** POST /api/medidas — registra peso, % de gordura e medidas. */
measurementsRouter.post('/', validate(medidaSchema), async (req, res, next) => {
  try {
    const uid = userId(req);
    const body = req.body as z.infer<typeof medidaSchema>;
    const registro = await prisma.bodyMeasurement.create({
      data: {
        userId: uid,
        date: body.date,
        weightKg: body.weightKg ?? null,
        bodyFatPct: body.bodyFatPct ?? null,
        measures: toJson(body.measures),
        notes: body.notes ?? null,
      },
    });

    // Mantém o peso atual do perfil em sincronia com a última medição
    if (body.weightKg) {
      await prisma.user.update({ where: { id: uid }, data: { weightKg: body.weightKg } });
    }

    res.status(201).json(serializeMeasurement(registro));
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/medidas/:id */
measurementsRouter.patch('/:id', validate(medidaSchema.partial()), async (req, res, next) => {
  try {
    const atual = await prisma.bodyMeasurement.findFirst({
      where: { id: req.params.id, userId: userId(req) },
    });
    if (!atual) throw notFound('Medida não encontrada');

    const { measures, ...resto } = req.body as Partial<z.infer<typeof medidaSchema>>;
    const registro = await prisma.bodyMeasurement.update({
      where: { id: atual.id },
      data: { ...resto, ...(measures ? { measures: toJson(measures) } : {}) },
    });
    res.json(serializeMeasurement(registro));
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/medidas/:id */
measurementsRouter.delete('/:id', async (req, res, next) => {
  try {
    const atual = await prisma.bodyMeasurement.findFirst({
      where: { id: req.params.id, userId: userId(req) },
    });
    if (!atual) throw notFound('Medida não encontrada');
    await prisma.bodyMeasurement.delete({ where: { id: atual.id } });
    res.json({ mensagem: 'Registro excluído' });
  } catch (err) {
    next(err);
  }
});

/** POST /api/medidas/:id/fotos — anexa foto de progresso (campo `foto`). */
measurementsRouter.post('/:id/fotos', uploadImagem.single('foto'), async (req, res, next) => {
  try {
    const atual = await prisma.bodyMeasurement.findFirst({
      where: { id: req.params.id, userId: userId(req) },
    });
    if (!atual) throw notFound('Medida não encontrada');
    if (!req.file) throw badRequest('Envie um arquivo no campo "foto"');

    const fotos = parseJson<string[]>(atual.photos, []);
    fotos.push(urlPublica(req.file.filename));

    const registro = await prisma.bodyMeasurement.update({
      where: { id: atual.id },
      data: { photos: toJson(fotos) },
    });
    res.status(201).json(serializeMeasurement(registro));
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/medidas/:id/fotos — remove uma foto pelo caminho. */
measurementsRouter.delete('/:id/fotos', validate(z.object({ url: z.string().min(1) })), async (req, res, next) => {
  try {
    const atual = await prisma.bodyMeasurement.findFirst({
      where: { id: req.params.id, userId: userId(req) },
    });
    if (!atual) throw notFound('Medida não encontrada');

    const { url } = req.body as { url: string };
    const fotos = parseJson<string[]>(atual.photos, []).filter((f) => f !== url);
    const registro = await prisma.bodyMeasurement.update({
      where: { id: atual.id },
      data: { photos: toJson(fotos) },
    });
    res.json(serializeMeasurement(registro));
  } catch (err) {
    next(err);
  }
});
