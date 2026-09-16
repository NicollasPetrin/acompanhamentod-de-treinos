import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

type Origem = 'body' | 'query' | 'params';

/**
 * Valida e normaliza a entrada com Zod. O resultado do parse substitui o
 * objeto original, garantindo que os handlers recebam dados já tipados.
 */
export const validate =
  (schema: ZodSchema, origem: Origem = 'body') =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[origem]);
    if (!result.success) return next(result.error);
    if (origem === 'query') {
      // req.query é somente-leitura no Express 5; guardamos em req.validatedQuery
      (req as Request & { validatedQuery?: unknown }).validatedQuery = result.data;
    } else {
      req[origem] = result.data as never;
    }
    next();
  };

/** Acessa a query já validada (com defaults aplicados). */
export const getQuery = <T>(req: Request): T =>
  ((req as Request & { validatedQuery?: unknown }).validatedQuery ?? req.query) as T;
