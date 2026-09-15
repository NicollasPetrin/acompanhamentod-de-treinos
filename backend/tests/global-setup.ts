import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Cria um banco SQLite limpo (test.db) antes da suíte rodar.
 * Roda uma única vez, independentemente da quantidade de arquivos de teste.
 */
export default function setup() {
  const dbPath = path.resolve(__dirname, '..', 'prisma', 'test.db');
  if (fs.existsSync(dbPath)) fs.rmSync(dbPath);

  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
    stdio: 'ignore',
  });
}
