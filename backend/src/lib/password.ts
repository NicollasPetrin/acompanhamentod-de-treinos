import bcrypt from 'bcryptjs';

const ROUNDS = 10;

export const hashPassword = (plain: string) => bcrypt.hash(plain, ROUNDS);
export const comparePassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

export interface PasswordStrength {
  score: number; // 0 a 4
  valid: boolean;
  problemas: string[];
}

/**
 * Regras de força de senha usadas tanto no cadastro quanto na troca de senha.
 * Mínimo: 8 caracteres, com letra e número.
 */
export function checkPasswordStrength(password: string): PasswordStrength {
  const problemas: string[] = [];
  if (password.length < 8) problemas.push('Use pelo menos 8 caracteres');
  if (!/[a-zA-Z]/.test(password)) problemas.push('Inclua ao menos uma letra');
  if (!/[0-9]/.test(password)) problemas.push('Inclua ao menos um número');
  if (/^(.)\1+$/.test(password)) problemas.push('Evite repetir o mesmo caractere');

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  return { score: Math.min(score, 4), valid: problemas.length === 0, problemas };
}
