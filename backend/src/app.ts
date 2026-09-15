import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';

import { corsOrigins, env, isTest } from './env';
import { errorHandler, notFoundHandler } from './middleware/error';
import { openapiDocument } from './docs/openapi';
import { authRouter } from './routes/auth.routes';
import { usersRouter } from './routes/users.routes';
import { exercisesRouter } from './routes/exercises.routes';
import { routinesRouter } from './routes/routines.routes';
import { workoutsRouter } from './routes/workouts.routes';
import { progressRouter } from './routes/progress.routes';
import { measurementsRouter } from './routes/measurements.routes';
import { goalsRouter } from './routes/goals.routes';
import { toolsRouter } from './routes/tools.routes';
import { dataRouter } from './routes/data.routes';
import { uploadDir } from './lib/upload';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(
    helmet({
      // As imagens de upload e os SVGs gerados são consumidos pelo frontend
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || corsOrigins.includes(origin)) return cb(null, true);
        cb(new Error('Origem não permitida pelo CORS'));
      },
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  if (!isTest) app.use(morgan('dev'));

  // Arquivos enviados pelos usuários (fotos de perfil e de progresso)
  app.use('/uploads', express.static(uploadDir, { maxAge: '7d' }));

  app.get('/api/saude', (_req, res) =>
    res.json({ status: 'ok', ambiente: env.NODE_ENV, horario: new Date().toISOString() }),
  );

  // Documentação
  app.get('/api/docs.json', (_req, res) => res.json(openapiDocument));
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(openapiDocument, {
      customSiteTitle: 'API — Acompanhamento de Treinos',
    }),
  );

  // Rotas
  app.use('/api/auth', authRouter);
  app.use('/api/usuarios', usersRouter);
  app.use('/api/exercicios', exercisesRouter);
  app.use('/api/rotinas', routinesRouter);
  app.use('/api/treinos', workoutsRouter);
  app.use('/api/progresso', progressRouter);
  app.use('/api/medidas', measurementsRouter);
  app.use('/api/metas', goalsRouter);
  app.use('/api/ferramentas', toolsRouter);
  app.use('/api/dados', dataRouter);

  // Em produção o build do frontend é servido pelo mesmo processo (opcional)
  const frontendDist = path.resolve(process.cwd(), '..', 'frontend', 'dist');
  app.use(express.static(frontendDist, { index: false, fallthrough: true }));

  app.use('/api', notFoundHandler);
  app.get('*', (req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
      if (err) notFoundHandler(req, res);
    });
  });

  app.use(errorHandler);

  return app;
}
