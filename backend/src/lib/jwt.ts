import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../env';

export interface AccessTokenPayload {
  sub: string;
  email: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

/**
 * Refresh token: JWT assinado (permite validar assinatura/expiração sem ir ao
 * banco) + hash guardado no banco (permite revogar, fazer rotação e detectar
 * reuso). O valor cru só existe no cliente.
 */
export function signRefreshToken(userId: string, days: number): { token: string; expiresAt: Date } {
  const jti = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const token = jwt.sign({ sub: userId, jti }, env.JWT_REFRESH_SECRET, {
    expiresIn: `${days}d`,
  } as SignOptions);
  return { token, expiresAt };
}

export function verifyRefreshToken(token: string): { sub: string; jti: string } {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as { sub: string; jti: string };
}

export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');
