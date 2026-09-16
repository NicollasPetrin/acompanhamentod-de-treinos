/**
 * Gera o schema de produção a partir do schema de desenvolvimento.
 *
 * Localmente o projeto usa SQLite (zero configuração); em produção, PostgreSQL.
 * Como o Prisma não aceita variável de ambiente no `provider`, o build troca
 * essa única linha — o resto do schema é idêntico, porque nenhum recurso
 * exclusivo de um banco é usado.
 */
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const origem = path.join(raiz, 'prisma', 'schema.prisma');
const destino = path.join(raiz, 'prisma', 'schema.producao.prisma');

const schema = fs.readFileSync(origem, 'utf8');

// A troca precisa acontecer dentro do bloco `datasource` — o texto
// `provider = "sqlite"` também aparece no comentário do topo do arquivo.
const blocoDatasource = /(datasource\s+db\s*\{[^}]*?provider\s*=\s*)"sqlite"/;
if (!blocoDatasource.test(schema)) {
  console.error('❌ Não encontrei `provider = "sqlite"` no bloco datasource de prisma/schema.prisma');
  process.exit(1);
}

let producao = schema.replace(blocoDatasource, '$1"postgresql"');

// Bancos serverless (Neon, Supabase) entregam duas URLs: uma com pool de
// conexões, para a aplicação, e uma direta, para criar/alterar tabelas. Quando
// DIRECT_URL existir, o Prisma usa cada uma no seu lugar.
if (process.env.DIRECT_URL) {
  producao = producao.replace(
    /(datasource\s+db\s*\{[^}]*?url\s*=\s*env\("DATABASE_URL"\))/,
    '$1\n  directUrl = env("DIRECT_URL")',
  );
  console.info('ℹ️  DIRECT_URL detectada: o schema de produção vai usá-la para migrações.');
}

fs.writeFileSync(destino, producao);

// Confere o resultado antes de seguir: um build apontando para o banco errado
// falharia lá na frente, com mensagem bem menos clara.
const datasourceGerado = producao.match(/datasource\s+db\s*\{[^}]*\}/)?.[0] ?? '';
if (!datasourceGerado.includes('"postgresql"')) {
  console.error('❌ O schema gerado não ficou com o provider PostgreSQL.');
  process.exit(1);
}

console.info('✅ prisma/schema.producao.prisma gerado (PostgreSQL)');
