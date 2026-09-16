import { z } from 'zod';

/**
 * Booleano vindo da query string.
 *
 * `z.coerce.boolean()` não serve aqui: ele usa `Boolean("false")`, que é
 * `true` — ou seja, `?arquivadas=false` seria lido como verdadeiro. Este
 * schema entende as formas que o frontend realmente envia.
 */
export const booleanoDaQuery = z.preprocess((valor) => {
  if (typeof valor === 'boolean') return valor;
  if (typeof valor === 'string') {
    const texto = valor.trim().toLowerCase();
    if (['true', '1', 'sim'].includes(texto)) return true;
    if (['false', '0', 'nao', 'não', ''].includes(texto)) return false;
  }
  return valor;
}, z.boolean());
