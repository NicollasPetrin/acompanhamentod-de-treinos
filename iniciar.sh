#!/usr/bin/env bash
# ---------------------------------------------------------------------------
#  Treinos — inicialização com um comando (Linux e macOS)
#  Instala dependências, prepara o banco e sobe API + site.
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"

echo
echo "============================================"
echo " Treinos — acompanhamento de academia"
echo "============================================"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "[ERRO] Node.js não encontrado. Instale a versão LTS em https://nodejs.org"
  exit 1
fi
echo "Node.js $(node -v) encontrado."

# --- Backend ---------------------------------------------------------------
echo
echo "[1/4] Dependências da API..."
cd backend
[ -d node_modules ] || npm install --no-audit --no-fund
[ -f .env ] || { cp .env.example .env && echo "Arquivo .env criado."; }

echo
echo "[2/4] Banco de dados..."
npx prisma migrate deploy
npx prisma generate

echo
echo "[3/4] Exercícios e usuário de demonstração..."
npm run seed

# --- Frontend --------------------------------------------------------------
echo
echo "[4/4] Dependências do site..."
cd ../frontend
[ -d node_modules ] || npm install --no-audit --no-fund

# --- Sobe os dois servidores ------------------------------------------------
cd ..
echo
echo "Iniciando API (3333) e site (5173)..."

npm --prefix backend run dev &
API_PID=$!
sleep 4
npm --prefix frontend run dev &
WEB_PID=$!

# Encerra os dois juntos ao apertar Ctrl+C
trap 'kill $API_PID $WEB_PID 2>/dev/null || true' INT TERM EXIT

sleep 4
echo
echo "============================================"
echo " Tudo pronto!"
echo
echo " Site:  http://localhost:5173"
echo " API:   http://localhost:3333/api/docs"
echo
echo " Login: demo@treinos.app"
echo " Senha: Demo1234"
echo "============================================"
echo
echo "Pressione Ctrl+C para parar os dois servidores."

wait
