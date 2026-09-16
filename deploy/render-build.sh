#!/usr/bin/env bash
# ---------------------------------------------------------------------------
#  Build de produção (Render)
#  Compila o site, compila a API, cria as tabelas no PostgreSQL e popula a
#  biblioteca de exercícios.
#
#  Também serve para testar o caminho de produção na sua máquina:
#    DATABASE_URL="postgresql://..." ./deploy/render-build.sh
# ---------------------------------------------------------------------------
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
cd "$RAIZ"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL não definida. No Render ela vem do banco PostgreSQL do blueprint."
  exit 1
fi

# O Prisma carrega backend/.env e ele venceria a variável de ambiente, apontando
# o build para o SQLite de desenvolvimento. Guardamos o arquivo durante o build.
restaurar_env() {
  if [ -f "$RAIZ/backend/.env.build-bak" ]; then
    mv "$RAIZ/backend/.env.build-bak" "$RAIZ/backend/.env"
  fi
}
trap restaurar_env EXIT
if [ -f "$RAIZ/backend/.env" ]; then
  mv "$RAIZ/backend/.env" "$RAIZ/backend/.env.build-bak"
fi

echo "▶ Compilando o site…"
cd "$RAIZ/frontend"
npm ci
npm run build

echo "▶ Preparando a API…"
cd "$RAIZ/backend"
npm ci
node scripts/preparar-producao.js

echo "▶ Sincronizando o banco…"
npx prisma generate --schema=prisma/schema.producao.prisma
npx prisma db push --schema=prisma/schema.producao.prisma --skip-generate

echo "▶ Compilando a API…"
npm run build

echo "▶ Populando exercícios…"
npm run seed

# Rodando na sua máquina: devolve o Prisma Client para o SQLite de
# desenvolvimento, senão os testes e o `npm run dev` passam a reclamar do
# provider.
#
# A pista de que estamos num ambiente local é o .env que guardamos no início
# (servidor de produção não tem esse arquivo). Antes isto dependia da variável
# RENDER, que só existe no Render — em outra hospedagem o cliente voltava para
# SQLite e a aplicação subia sem conseguir falar com o PostgreSQL.
if [ -f "$RAIZ/backend/.env.build-bak" ]; then
  echo "▶ Restaurando o Prisma Client de desenvolvimento (SQLite)…"
  npx prisma generate >/dev/null
fi

echo "✅ Build concluído."
