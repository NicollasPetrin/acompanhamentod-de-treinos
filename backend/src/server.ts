import { createApp } from './app';
import { env } from './env';
import { prisma } from './lib/prisma';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.info(`\n🏋️  API rodando em http://localhost:${env.PORT}`);
  console.info(`📚 Documentação em http://localhost:${env.PORT}/api/docs\n`);
});

/** Encerramento gracioso: fecha o servidor e a conexão com o banco. */
const encerrar = async (sinal: string) => {
  console.info(`\nRecebido ${sinal}, encerrando...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on('SIGINT', () => void encerrar('SIGINT'));
process.on('SIGTERM', () => void encerrar('SIGTERM'));
