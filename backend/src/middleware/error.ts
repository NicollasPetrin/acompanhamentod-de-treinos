import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';
import { isTest } from '../env';

/** Rota inexistente → 404 padronizado. */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    erro: { codigo: 'rota_nao_encontrada', mensagem: `Rota não encontrada: ${req.method} ${req.path}` },
  });
}

/** Tratamento central de erros — toda resposta de erro tem o mesmo formato. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(422).json({
      erro: {
        codigo: 'validacao',
        mensagem: 'Dados inválidos',
        campos: err.flatten().fieldErrors,
      },
    });
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({
      erro: { codigo: err.code, mensagem: err.message, detalhes: err.details },
    });
  }

  const anyErr = err as { code?: string; message?: string };
  // Violação de unicidade do Prisma
  if (anyErr?.code === 'P2002') {
    return res.status(409).json({ erro: { codigo: 'conflito', mensagem: 'Registro já existente' } });
  }
  if (anyErr?.code === 'P2025') {
    return res.status(404).json({ erro: { codigo: 'nao_encontrado', mensagem: 'Registro não encontrado' } });
  }
  if (anyErr?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ erro: { codigo: 'arquivo_grande', mensagem: 'Arquivo muito grande' } });
  }

  if (!isTest) console.error('Erro não tratado:', err);
  return res.status(500).json({
    erro: { codigo: 'erro_interno', mensagem: 'Erro interno do servidor' },
  });
}
