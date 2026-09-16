import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../lib/jwt';
import { unauthorized } from '../lib/errors';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

/**
 * Exige um access token válido. Todas as rotas de dados do usuário passam por
 * aqui; os handlers sempre filtram pelo `req.userId`, garantindo que ninguém
 * leia ou altere dados de outra conta.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(unauthorized('Token de acesso ausente'));

  try {
    const payload = verifyAccessToken(header.slice(7));
    req.userId = payload.sub;
    req.userEmail = payload.email;
    next();
  } catch {
    next(unauthorized('Token inválido ou expirado'));
  }
}

/** Autenticação opcional (ex.: rotina compartilhada por link público). */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = verifyAccessToken(header.slice(7));
      req.userId = payload.sub;
      req.userEmail = payload.email;
    } catch {
      /* token inválido em rota opcional é simplesmente ignorado */
    }
  }
  next();
}

/** Atalho para handlers: id do usuário autenticado (garantido por requireAuth). */
export const userId = (req: Request): string => {
  if (!req.userId) throw unauthorized();
  return req.userId;
};
