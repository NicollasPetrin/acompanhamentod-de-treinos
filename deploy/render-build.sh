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

# Antes de mexer no banco, mostra no log exatamente qual SQL será aplicado.
# Assim, se um dia uma alteração for destrutiva de verdade, dá para ver no
# build em vez de descobrir depois — o --accept-data-loss abaixo não avisa.
URL_DDL="${DIRECT_URL:-$DATABASE_URL}"
if [ -n "$URL_DDL" ]; then
  echo "— Alterações pendentes no banco:"
  npx prisma migrate diff \
    --from-url "$URL_DDL" \
    --to-schema-datamodel prisma/schema.producao.prisma \
    --script || echo "  (não foi possível calcular o diff; seguindo mesmo assim)"
fi

# --accept-data-loss: o `db push` interrompe o build diante de qualquer aviso,
# inclusive o de "vou criar um índice único" — que é apenas um aviso, já que o
# PostgreSQL aceita vários NULL numa coluna única. Sem a flag, toda coluna nova
# com @unique derruba o deploy.
npx prisma db push --schema=prisma/schema.producao.prisma --skip-generate --accept-data-loss

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
