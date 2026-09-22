import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/global-setup.ts'],
    // SQLite não gosta de escrita concorrente — os arquivos rodam em série
    fileParallelism: false,
    env: {
      // Os testes rodam com o relógio em UTC, como o servidor de produção —
      // é assim que erros de fuso aparecem aqui em vez de na academia.
      TZ: 'UTC',
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./test.db',
      JWT_ACCESS_SECRET: 'segredo-de-teste-acesso-1234567890',
      JWT_REFRESH_SECRET: 'segredo-de-teste-refresh-1234567890',
    },
    include: ['tests/**/*.test.ts'],
  },
});
