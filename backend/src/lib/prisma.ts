import { PrismaClient } from '@prisma/client';
import { isProd } from '../env';

/**
 * Instância única do Prisma. Em desenvolvimento reaproveitamos a instância
 * guardada no `globalThis` para não estourar o limite de conexões a cada
 * hot-reload do tsx.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProd ? ['error'] : ['error', 'warn'],
  });

if (!isProd) globalForPrisma.prisma = prisma;
