/**
 * Helpers para trabalhar com colunas que guardam JSON em texto.
 * Mantêm o schema portável entre SQLite e PostgreSQL.
 */
export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

export const toJson = (value: unknown): string => JSON.stringify(value ?? null);
