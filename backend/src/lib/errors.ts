/** Erro de aplicação com status HTTP e código legível pelo frontend. */
export class AppError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, message: string, code = 'erro', details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (msg: string, details?: unknown) =>
  new AppError(400, msg, 'requisicao_invalida', details);
export const unauthorized = (msg = 'Não autenticado') => new AppError(401, msg, 'nao_autenticado');
export const forbidden = (msg = 'Acesso negado') => new AppError(403, msg, 'acesso_negado');
export const notFound = (msg = 'Registro não encontrado') => new AppError(404, msg, 'nao_encontrado');
export const conflict = (msg: string) => new AppError(409, msg, 'conflito');
