@echo off
REM ---------------------------------------------------------------------------
REM  Treinos - inicializacao com um clique (Windows)
REM  Instala dependencias, prepara o banco e sobe API + site.
REM ---------------------------------------------------------------------------
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  ============================================
echo   Treinos - acompanhamento de academia
echo  ============================================
echo.

REM --- Node.js instalado? ----------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
  echo  [ERRO] Node.js nao encontrado.
  echo  Instale a versao LTS em https://nodejs.org e rode este arquivo de novo.
  echo.
  pause
  exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do echo  Node.js %%v encontrado.

REM --- Backend ---------------------------------------------------------------
echo.
echo  [1/4] Instalando dependencias da API (pode demorar na primeira vez)...
cd backend
if not exist node_modules (
  call npm install --no-audit --no-fund || goto :erro
) else (
  echo  ja instaladas.
)

if not exist .env (
  copy .env.example .env >nul
  echo  Arquivo .env criado.
)

echo.
echo  [2/4] Preparando o banco de dados...
call npx prisma migrate deploy || goto :erro
call npx prisma generate || goto :erro

if not exist prisma\dev.db (
  echo  banco nao encontrado, criando...
)
echo.
echo  [3/4] Populando exercicios e usuario de demonstracao...
call npm run seed || goto :erro

REM --- Frontend --------------------------------------------------------------
echo.
echo  [4/4] Instalando dependencias do site...
cd ..\frontend
if not exist node_modules (
  call npm install --no-audit --no-fund || goto :erro
) else (
  echo  ja instaladas.
)

REM --- Sobe os dois servidores ----------------------------------------------
cd ..
echo.
echo  Iniciando a API (porta 3333) e o site (porta 5173)...
start "Treinos - API" cmd /k "cd /d "%~dp0backend" && npm run dev"
timeout /t 5 /nobreak >nul
start "Treinos - Site" cmd /k "cd /d "%~dp0frontend" && npm run dev"
timeout /t 6 /nobreak >nul

echo.
echo  ============================================
echo   Tudo pronto!
echo.
echo   Site:  http://localhost:5173
echo   API:   http://localhost:3333/api/docs
echo.
echo   Login: demo@treinos.app
echo   Senha: Demo1234
echo  ============================================
echo.
echo  Abrindo o navegador...
start "" http://localhost:5173
echo.
echo  Para parar, feche as duas janelas "Treinos - API" e "Treinos - Site".
pause
exit /b 0

:erro
echo.
echo  [ERRO] Alguma etapa falhou. Confira a mensagem acima.
pause
exit /b 1
