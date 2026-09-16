# 🏋️ Treinos — acompanhamento de treinos de academia

Aplicação web completa (PWA) para montar rotinas de treino, registrar cada série
na academia em segundos e acompanhar a evolução ao longo do tempo. Interface em
**português do Brasil**, pensada primeiro para o celular (mobile-first), com tema
escuro por padrão e funcionamento **offline**.

> **Conta de demonstração:** `demo@treinos.app` / `Demo1234`
> (já vem com rotina ativa, 8 semanas de histórico, medidas, metas e recordes)

---

## Índice

- [O que o app faz](#o-que-o-app-faz)
- [Stack](#stack)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Como rodar localmente](#como-rodar-localmente)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Banco de dados e seed](#banco-de-dados-e-seed)
- [Testes automatizados](#testes-automatizados)
- [Documentação da API](#documentação-da-api)
- [Como funciona o modo offline](#como-funciona-o-modo-offline)
- [Regras de cálculo](#regras-de-cálculo)
- [Decisões de projeto](#decisões-de-projeto)
- [Limitações conhecidas](#limitações-conhecidas)

---

## O que o app faz

**Contas e perfil**
- Cadastro com validação de força de senha, login com "manter conectado", logout
- Recuperação de senha por e-mail (token com expiração de 1 hora e uso único)
- Perfil: foto, data de nascimento, sexo, altura, peso, objetivo e nível
- Preferências: unidade (kg/lb), tema claro/escuro, dias de treino, descanso padrão
- Exclusão de conta com dupla confirmação (senha + digitar `EXCLUIR`)

**Biblioteca de exercícios**
- 178 exercícios pré-cadastrados com grupo muscular principal e secundários,
  equipamento, tipo e instruções de execução
- Ilustração gerada pelo próprio servidor (SVG com os músculos destacados,
  vista frontal e posterior) — sem depender de serviços externos
- Busca com filtros por grupo muscular, equipamento e tipo; favoritos
- Exercícios personalizados (privados de cada usuário)
- Página do exercício com histórico, melhor carga, melhor série, 1RM estimado
  e gráficos de evolução

**Rotinas (fichas de treino)**
- Rotinas com nome, descrição e objetivo, divididas em dias (Treino A, B, C…)
- Por exercício: séries, faixa de repetições, carga sugerida, descanso, observações
- Técnicas: superset, bi-set, drop set, rest-pause e séries de aquecimento
- Reordenar exercícios arrastando (mouse, toque e **teclado**)
- Duplicar rotina, duplicar dia, arquivar, definir rotina ativa
- Modelos prontos: ABC, ABCD, Push/Pull/Legs, Upper/Lower e Full Body
- Compartilhamento por link público; quem recebe pode copiar para a própria conta

**Registro de treino** (a tela mais importante)
- Inicia a partir de um dia da rotina ativa ou como treino livre
- Séries já preenchidas com os valores da última vez naquele exercício
- Um toque marca a série; edição de peso/reps inline com teclado numérico
- Cronômetro de descanso automático com som e vibração + cronômetro total
- Adicionar/remover séries e exercícios durante o treino, RPE por série
- Anotações por exercício e por treino
- Aviso de **recorde pessoal (PR)** na hora — carga, repetições, volume ou 1RM
- Resumo pós-treino: duração, volume, séries, PRs, conquistas e grupos trabalhados
- Rascunho salvo automaticamente: fechou o app, retoma de onde parou

**Histórico e progresso**
- Calendário mensal com os dias treinados
- Lista de treinos com detalhes, edição e exclusão (recordes recalculados)
- Gráficos: volume semanal, frequência mensal, distribuição por grupo muscular,
  evolução de carga e de 1RM por exercício
- Quadro de recordes pessoais, comparativo "este mês vs. mês passado"
- Sequência de treinos (streak) e 14 conquistas

**Medidas, metas e extras**
- Medidas corporais (peso, % de gordura e 9 circunferências) com gráficos
- Fotos de progresso com comparação lado a lado
- Metas com barra de progresso automática (carga, 1RM, peso corporal, frequência…)
- Lembretes de treino por notificação nos dias e horário configurados
- **Treino em dupla**: duas contas conectadas no mesmo aparelho, com troca
  rápida durante o treino — cada pessoa registra na própria conta e mantém o
  próprio rascunho
- Exportação em CSV/JSON e importação do **Strong** e do **Hevy**
- Calculadoras de 1RM (Epley/Brzycki, com tabela de percentuais), de anilhas
  (quanto colocar de cada lado da barra) e conversor kg ↔ lb

---

## Stack

| Camada    | Tecnologias |
|-----------|-------------|
| Frontend  | React 18 + TypeScript + Vite + Tailwind CSS + React Router + TanStack Query + Recharts + dnd-kit + vite-plugin-pwa |
| Backend   | Node.js + Express + TypeScript + Zod + JWT (access + refresh) + bcrypt + Swagger UI |
| Banco     | Prisma ORM — SQLite por padrão, PostgreSQL com uma linha de configuração |
| Testes    | Vitest + Supertest (backend) |

---

## Estrutura de pastas

```
.
├── iniciar.bat / iniciar.sh    # sobe tudo com um clique (Windows / Linux-macOS)
├── render.yaml                 # blueprint de deploy (serviço web + PostgreSQL)
├── deploy/render-build.sh      # build de produção
├── backend/
│   ├── prisma/
│   │   ├── migrations/         # migrations versionadas
│   │   ├── schema.prisma       # modelo de dados
│   │   └── seed.ts             # exercícios + usuário de demonstração
│   ├── src/
│   │   ├── app.ts              # montagem do Express (middlewares, rotas, docs)
│   │   ├── server.ts           # subida do servidor
│   │   ├── env.ts              # variáveis de ambiente validadas com Zod
│   │   ├── data/               # biblioteca de exercícios e templates de rotina
│   │   ├── docs/openapi.ts     # especificação OpenAPI 3
│   │   ├── lib/                # prisma, jwt, senha, e-mail, upload, CSV, SVG
│   │   ├── middleware/         # autenticação, validação e tratamento de erros
│   │   ├── routes/             # auth, usuários, exercícios, rotinas, treinos…
│   │   ├── services/           # recordes, conquistas e metas
│   │   └── utils/calculations.ts  # 1RM, volume, PR, anilhas, streak
│   └── tests/                  # testes automatizados
└── frontend/
    ├── public/                 # ícones do PWA
    └── src/
        ├── components/         # UI, layout, gráficos, cronômetro, seletores
        ├── lib/                # api, auth, offline, sessão de treino, cálculos
        └── pages/              # 17 telas da aplicação
```

---

## Como rodar localmente

Pré-requisitos: **Node.js 20+** e npm ([nodejs.org](https://nodejs.org) — confira com `node -v`).

### Jeito rápido (um clique)

Na raiz do projeto:

- **Windows:** dê dois cliques em **`iniciar.bat`**
- **Linux/macOS:** rode **`./iniciar.sh`**

O script instala as dependências, cria o banco, popula os exercícios e o usuário
de demonstração e sobe a API e o site. Ao final, o navegador abre em
**http://localhost:5173** — entre com `demo@treinos.app` / `Demo1234`.

### Passo a passo (manual)

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env          # ajuste se quiser (funciona sem alterar nada)
npx prisma migrate dev        # cria o banco SQLite e aplica as migrations
npm run seed                  # popula exercícios + usuário de demonstração
npm run dev                   # http://localhost:3333
```

### 2. Frontend (em outro terminal)

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

O Vite já faz proxy de `/api` e `/uploads` para `http://localhost:3333`, então não
é preciso configurar URL de API.

Acesse **http://localhost:5173** e entre com `demo@treinos.app` / `Demo1234`.

### Build de produção

```bash
cd frontend && npm run build   # gera frontend/dist
cd ../backend && npm run build && npm start
```

Em produção o backend serve a API **e** os arquivos estáticos do frontend
(`frontend/dist`), então basta publicar um processo em `http://localhost:3333`.

---

## Variáveis de ambiente

Arquivo `backend/.env` (veja `backend/.env.example`):

| Variável | Padrão | Para que serve |
|---|---|---|
| `NODE_ENV` | `development` | Ambiente de execução |
| `PORT` | `3333` | Porta da API |
| `DATABASE_URL` | `file:./dev.db` | Conexão do banco (SQLite ou PostgreSQL) |
| `JWT_ACCESS_SECRET` | *(troque em produção)* | Assinatura do access token |
| `JWT_REFRESH_SECRET` | *(troque em produção)* | Assinatura do refresh token |
| `ACCESS_TOKEN_TTL` | `15m` | Validade do access token |
| `REFRESH_TOKEN_TTL_DAYS` | `30` | Validade do refresh com "manter conectado" |
| `REFRESH_TOKEN_SHORT_TTL_DAYS` | `1` | Validade do refresh sem "manter conectado" |
| `APP_URL` | `http://localhost:5173` | Base dos links enviados por e-mail |
| `CORS_ORIGINS` | `http://localhost:5173,…` | Origens liberadas no CORS |
| `UPLOAD_DIR` / `MAX_UPLOAD_MB` | `uploads` / `5` | Fotos de perfil e de progresso |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | — | Envio de e-mail; **sem SMTP configurado o e-mail é impresso no console**, o que já permite testar a recuperação de senha |

---

## Banco de dados e seed

O schema (`backend/prisma/schema.prisma`) cobre o modelo pedido:
`users`, `exercises`, `routines`, `routine_days`, `routine_exercises`,
`workouts`, `workout_exercises`, `workout_sets`, `body_measurements`, `goals`,
`personal_records` — mais `refresh_tokens`, `password_reset_tokens`,
`favorite_exercises` e `achievements`.

```bash
npx prisma migrate dev     # cria/atualiza o banco
npm run seed               # 178 exercícios + usuário demo com histórico
npx prisma studio          # inspeciona os dados no navegador
```

### Usando PostgreSQL

1. Em `backend/prisma/schema.prisma`, troque `provider = "sqlite"` por
   `provider = "postgresql"`.
2. Ajuste a `DATABASE_URL`:
   `postgresql://usuario:senha@localhost:5432/treinos?schema=public`
3. Rode `npx prisma migrate dev --name init` e `npm run seed`.

Nenhum recurso exclusivo de um banco é usado — listas e objetos são guardados
como JSON em colunas de texto —, então o schema roda igual nos dois.

---

## Testes automatizados

```bash
cd backend
npm test          # 61 testes
```

Cobrem as regras críticas:

- **`tests/calculations.test.ts`** — 1RM (Epley e Brzycki), volume (aquecimento e
  séries não concluídas não contam), detecção de PR, calculadora de anilhas,
  streak, progresso de metas e conversão kg/lb
- **`tests/auth.test.ts`** — cadastro, senha fraca, e-mail duplicado, login,
  rotação e reuso de refresh token, logout, recuperação de senha (token expirado,
  uso único) e exclusão de conta
- **`tests/workouts.test.ts`** — fluxo completo do treino, PR em tempo real,
  finalização (volume, séries, grupos musculares), recálculo de recordes ao
  excluir treino, sincronização offline idempotente e **autorização**
  (um usuário nunca lê ou altera dados de outro)
- **`tests/goals-routines.test.ts`** — progresso automático de metas (inclusive
  metas de emagrecimento), templates, rotina ativa única, compartilhamento por
  link e reordenação de exercícios

Os testes usam um SQLite separado (`prisma/test.db`), recriado a cada execução.

---

## Documentação da API

Com o backend rodando:

- **Swagger UI:** http://localhost:3333/api/docs
- **OpenAPI JSON:** http://localhost:3333/api/docs.json

Todas as rotas (exceto `/api/auth/*` e a leitura de rotina compartilhada) exigem
`Authorization: Bearer <accessToken>`, e **cada consulta é filtrada pelo usuário
do token** — ninguém acessa dados de outra conta. Entradas são validadas com Zod
e os erros seguem sempre o mesmo formato:

```json
{ "erro": { "codigo": "nao_encontrado", "mensagem": "Registro não encontrado" } }
```

---

## Como funciona o modo offline

1. O service worker (vite-plugin-pwa) guarda o app e as respostas de leitura da
   API em cache, então o app abre mesmo sem rede.
2. O treino em andamento fica no **IndexedDB**: cada toque atualiza o estado
   local primeiro — nada na tela espera a rede.
3. Com internet, as alterações são replicadas na API em segundo plano.
4. Sem internet (ou se alguma chamada falhar), o treino finalizado entra numa
   **fila de sincronização** e é enviado assim que a conexão volta, pelo endpoint
   `POST /api/treinos/sincronizar`.
5. A sincronização é **idempotente** pelo par `(usuário, clientId)`: reenviar o
   mesmo treino não duplica nada, e um treino que começou online e terminou
   offline substitui o rascunho que ficou no servidor.
6. Os recordes pessoais são detectados no aparelho (mesma fórmula do backend),
   então o aviso de PR aparece na hora, com ou sem internet.
7. Rascunhos e fila de sincronização são guardados **por usuário**, e o cache
   das respostas da API é apagado ao entrar, sair e trocar de conta — no treino
   em dupla ninguém vê os dados da outra pessoa, nem offline.

Para instalar no celular: abra o site no navegador e escolha
*"Adicionar à tela de início"*.

---

## Regras de cálculo

| Regra | Implementação |
|---|---|
| **1RM estimado** | Epley (`carga × (1 + reps/30)`, padrão) e Brzycki (`carga × 36 / (37 − reps)`); com 1 repetição devolve a própria carga |
| **Volume** | `carga × repetições`, somando apenas séries **concluídas** e **não** de aquecimento |
| **Recorde (PR)** | Compara a série com as melhores marcas anteriores do exercício em quatro tipos (carga, repetições, volume e 1RM). O valor precisa ser *estritamente maior*; aquecimento e séries não concluídas nunca geram PR |
| **Consolidação** | Durante o treino o PR é provisório (feedback imediato). Ao finalizar, os recordes do exercício são **recalculados do zero** em ordem cronológica — assim editar ou excluir um treino nunca deixa recorde órfão |
| **Anilhas** | Estratégia gulosa, da anilha mais pesada para a mais leve, avisando quando o peso exato não é possível |
| **Streak** | Dias consecutivos com treino, tolerando o dia de hoje ainda sem treino |

As mesmas funções existem no frontend (`src/lib/calculos.ts`) para o modo offline.

---

## Decisões de projeto

- **SQLite como padrão** — roda sem Docker nem servidor de banco; a troca para
  PostgreSQL é uma linha, e o schema foi escrito para ser portável.
- **Estado local primeiro na tela de treino** — na academia a conexão é ruim e
  cada toque precisa responder na hora; o servidor é atualizado em segundo plano.
- **Refresh token com rotação e hash no banco** — o token cru só existe no
  cliente; reutilizar um token já usado derruba todas as sessões daquela conta.
- **Ilustrações geradas pelo servidor** — SVG com os músculos destacados, sem
  depender de banco de imagens externo ou de arquivos binários no repositório.
- **Português nas rotas e nas mensagens, inglês nos campos** — as URLs e os textos
  de erro são em pt-BR; os campos JSON mantêm os nomes do modelo de dados, o que
  evita uma camada de tradução entre API e banco.
- **Tema escuro por padrão** — academia costuma ter iluminação ruim para telas
  claras; o tema claro está a um toque nas configurações.
- **Acessibilidade** — alvos de toque de 44px+, foco visível, `aria-label` nos
  controles só com ícone, tabelas com cabeçalho, avisos anunciados por leitor de
  tela, arrastar e soltar operável pelo teclado e contraste conferido nos dois temas.

---

## Deploy (Render)

O projeto sobe como **um único serviço**: a API serve o site já compilado, e o
banco vira PostgreSQL gerenciado. O arquivo [`render.yaml`](render.yaml) descreve
tudo (serviço web + banco), então o Render monta o ambiente sozinho.

1. Acesse [dashboard.render.com](https://dashboard.render.com) e entre com o GitHub.
2. **New + → Blueprint** e escolha este repositório.
3. O Render lê o `render.yaml` e propõe criar dois recursos: o serviço **treinos**
   e o banco **treinos-db**. Confirme em **Apply**.
4. Aguarde o build (uns 3 a 5 minutos na primeira vez). Ele compila o site,
   compila a API, cria as tabelas no PostgreSQL e popula os 178 exercícios.
5. Abra a URL que o Render mostrar (algo como `https://treinos.onrender.com`) e
   entre com `demo@treinos.app` / `Demo1234`.

Os segredos de JWT são gerados automaticamente pelo Render e a URL pública é
detectada via `RENDER_EXTERNAL_URL` — não é preciso configurar variável nenhuma
à mão. Para enviar e-mails de recuperação de senha de verdade, adicione
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` e `SMTP_PASS` nas variáveis do serviço.

### O que o build faz

`deploy/render-build.sh` executa, nesta ordem:

```
frontend: npm ci && npm run build          → frontend/dist
backend:  npm ci
          node scripts/preparar-producao.js  → schema com provider PostgreSQL
          prisma generate + prisma db push   → cria as tabelas
          npm run build                      → dist/server.js
          npm run seed                       → exercícios + usuário demo
```

O mesmo script roda na sua máquina, caso queira testar o caminho de produção
antes de publicar:

```bash
DATABASE_URL="postgresql://usuario:senha@localhost:5432/treinos" ./deploy/render-build.sh
cd backend && NODE_ENV=production node dist/server.js
```

### Pontos de atenção no plano gratuito

- O serviço **hiberna após 15 minutos sem acesso**; a primeira visita depois
  disso demora alguns segundos para responder.
- O **PostgreSQL gratuito do Render expira** (hoje, 30 dias). Para uso contínuo,
  troque para um plano pago ou aponte a `DATABASE_URL` para outro Postgres
  gerenciado (Neon e Supabase têm plano gratuito sem prazo).
- O disco é efêmero: **fotos de perfil e de progresso são perdidas** a cada
  deploy ou reinício. Para mantê-las, adicione um disco persistente (plano pago)
  ou troque o upload por um storage de objetos (S3, Cloudflare R2, Vercel Blob).
- O seed **não sobrescreve** dados existentes: se o usuário de demonstração já
  existir, ele é preservado (use `RECRIAR_DEMO=true npm run seed` para recriar).

### Outras hospedagens

O mesmo formato funciona em qualquer serviço que rode Node com um Postgres ao
lado — Railway, Fly.io, Koyeb, VPS com PM2. Basta usar o `deploy/render-build.sh`
como build e `cd backend && node dist/server.js` como comando de início.

---

## Limitações conhecidas

- **Notificações**: os lembretes usam a Notification API e disparam com o app
  aberto ou em segundo plano. Notificações com o app completamente fechado
  exigiriam Web Push com chaves VAPID e um serviço de push — não incluído.
- **Importação**: o CSV do Strong e do Hevy é reconhecido automaticamente.
  Exercícios cujo nome não casa com a biblioteca viram exercícios personalizados
  (há um dicionário com os nomes mais comuns em inglês).
- **Uploads** ficam em disco (`backend/uploads`). Para produção em várias
  instâncias, troque por um storage de objetos (S3 ou equivalente).
- **Treino em dupla**: as duas pessoas alternam entre as contas no mesmo
  aparelho (cada uma com seu treino e seu rascunho), mas as duas telas não
  ficam visíveis ao mesmo tempo — é uma troca, não uma tela dividida.
