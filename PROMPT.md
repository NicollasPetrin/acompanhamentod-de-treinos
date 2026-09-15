# Prompt — Site de Acompanhamento de Treinos de Academia

Crie um site completo de acompanhamento de treinos de academia, em português do Brasil, com foco em uso pelo celular (mobile-first), mas funcionando bem também no desktop. O objetivo é que o usuário consiga montar suas rotinas, registrar cada treino rapidamente enquanto está na academia e acompanhar sua evolução ao longo do tempo.

## Stack sugerida

- **Frontend:** React (Vite) + TypeScript + Tailwind CSS
- **Backend:** Node.js com Express (ou Next.js com API routes)
- **Banco de dados:** PostgreSQL com Prisma ORM (SQLite aceitável para desenvolvimento)
- **Autenticação:** JWT com refresh token, senhas com bcrypt
- **Gráficos:** Recharts ou Chart.js
- **PWA:** instalável no celular, com funcionamento offline básico (registrar treino sem internet e sincronizar depois)

Se preferir outra stack equivalente, tudo bem, desde que mantenha a separação clara entre frontend, API e banco.

---

## 1. Contas e perfil

- Cadastro com nome, e-mail e senha (validação de força da senha)
- Login, logout e "manter conectado"
- Recuperação de senha por e-mail (token com expiração)
- Perfil do usuário: foto, data de nascimento, sexo, altura, peso atual, objetivo (hipertrofia, emagrecimento, força, condicionamento), nível (iniciante, intermediário, avançado)
- Preferências: unidade de peso (kg/lb), tema claro/escuro, dias da semana que treina, tempo de descanso padrão
- Exclusão de conta com confirmação

## 2. Biblioteca de exercícios

- Banco pré-cadastrado com pelo menos 150 exercícios, cada um com:
  - Nome, grupo muscular principal e secundários
  - Equipamento (barra, halter, máquina, cabo, peso corporal, kettlebell, elástico)
  - Tipo (força, cardio, alongamento, mobilidade)
  - Instruções de execução em texto e imagem/GIF ilustrativo
- Busca com filtros por grupo muscular, equipamento e tipo
- Usuário pode criar exercícios personalizados (privados) e marcar favoritos
- Cada exercício tem uma página com o histórico do usuário nele: melhor carga, melhor série, gráfico de evolução, 1RM estimado

## 3. Rotinas (fichas de treino)

- Criar rotinas com nome, descrição e objetivo
- Cada rotina é dividida em **dias de treino** (ex.: Treino A – Peito e Tríceps, Treino B – Costas e Bíceps, Treino C – Pernas)
- Em cada dia, adicionar exercícios com: número de séries, faixa de repetições (ex.: 8–12), carga sugerida, tempo de descanso, observações
- Suporte a técnicas: superset, bi-set, drop set, rest-pause, séries de aquecimento
- Reordenar exercícios por arrastar e soltar
- Duplicar rotina, duplicar dia, arquivar rotina antiga
- Definir uma rotina como **ativa** — ela aparece na tela inicial
- Templates prontos para começar rápido (ABC, ABCD, Push/Pull/Legs, Upper/Lower, Full Body)
- Compartilhar rotina por link público; quem receber pode copiar para a própria conta

## 4. Registro de treino (a tela mais importante)

- Botão "Iniciar treino" a partir de um dia da rotina ativa, ou treino livre do zero
- Tela otimizada para uso rápido na academia:
  - Lista de exercícios do dia com as séries já preenchidas com os valores da última vez (peso e reps)
  - Marcar cada série como concluída com um toque; editar peso/reps inline
  - Adicionar ou remover séries e exercícios durante o treino
  - Timer de descanso que inicia automaticamente ao concluir uma série, com notificação sonora/vibração
  - Cronômetro total do treino
  - Campo de anotação por exercício e por treino (ex.: "senti dor no ombro", "aumentar carga na próxima")
  - Indicador de RPE/esforço percebido opcional (1–10)
- Ao concluir a série, mostrar se houve **recorde pessoal** (PR) de carga, reps ou volume
- Finalizar treino: resumo com duração, volume total (kg levantados), séries concluídas, PRs batidos e grupos musculares trabalhados
- Salvar treino como rascunho se o usuário fechar o app; retomar depois
- Funciona offline e sincroniza ao reconectar

## 5. Histórico e progresso

- Calendário mensal com os dias treinados marcados (e qual treino foi feito)
- Lista de treinos passados com detalhes completos; possibilidade de editar ou excluir
- Dashboard de progresso com gráficos:
  - Evolução de carga por exercício
  - Volume semanal total e por grupo muscular
  - Frequência de treinos por semana/mês
  - Distribuição de séries por grupo muscular (identificar desequilíbrios)
- Quadro de recordes pessoais (PRs) por exercício
- Comparação "este mês vs. mês passado"
- Sequência de treinos (streak) e conquistas/badges (ex.: 10 treinos, 100 kg no supino, 30 dias seguidos)

## 6. Medidas corporais

- Registrar peso corporal, percentual de gordura e medidas (braço, peito, cintura, quadril, coxa, panturrilha)
- Gráficos de evolução de cada medida
- Fotos de progresso com data, comparação lado a lado

## 7. Metas

- Criar metas como: "Supino 100 kg até dezembro", "Treinar 4x por semana", "Chegar a 80 kg de peso corporal"
- Barra de progresso automática com base nos registros
- Notificação ao atingir a meta

## 8. Extras de qualidade

- Lembretes de treino (notificação push nos dias configurados)
- Exportar dados em CSV/JSON e importar de outros apps (Strong, Hevy)
- Calculadora de 1RM e de anilhas (quanto colocar de cada lado da barra)
- Modo "treino em dupla": dois usuários registrando no mesmo aparelho
- Página de configurações com tudo centralizado

---

## Modelo de dados (mínimo)

- `users` — id, nome, e-mail, senha_hash, perfil, preferências, criado_em
- `exercises` — id, nome, grupo_muscular, grupos_secundários[], equipamento, tipo, instruções, imagem_url, criado_por (null = global)
- `routines` — id, user_id, nome, descrição, objetivo, ativa, arquivada
- `routine_days` — id, routine_id, nome, ordem
- `routine_exercises` — id, routine_day_id, exercise_id, ordem, séries, reps_min, reps_max, carga_sugerida, descanso_seg, técnica, observações
- `workouts` — id, user_id, routine_day_id (nullable), iniciado_em, finalizado_em, duração, notas, status (em_andamento / concluído)
- `workout_exercises` — id, workout_id, exercise_id, ordem, notas
- `workout_sets` — id, workout_exercise_id, ordem, peso, reps, rpe, tipo (normal / aquecimento / drop), concluída, é_pr
- `body_measurements` — id, user_id, data, peso, gordura_pct, medidas (json), fotos[]
- `goals` — id, user_id, tipo, exercise_id (nullable), valor_alvo, prazo, concluída
- `personal_records` — id, user_id, exercise_id, tipo (carga / reps / volume / 1rm), valor, workout_set_id, data

## Telas principais

1. Landing page com apresentação e botões de cadastro/login
2. Cadastro / Login / Recuperar senha
3. **Home** — rotina ativa, próximo treino sugerido, botão "Iniciar treino", resumo da semana, streak
4. Rotinas — lista, criar/editar rotina, editar dia, buscar exercício
5. **Treino em andamento** — tela de registro rápido
6. Resumo pós-treino
7. Histórico — calendário + lista
8. Progresso — gráficos e PRs
9. Biblioteca de exercícios + detalhe do exercício
10. Medidas corporais
11. Metas
12. Perfil e configurações

## Requisitos não funcionais

- Interface em português do Brasil, textos claros, botões grandes para uso com uma mão
- Tema escuro por padrão (academia costuma ter iluminação ruim para telas claras)
- Acessível (contraste, labels, navegação por teclado)
- Responsivo de 360px até desktop
- API REST documentada (Swagger/OpenAPI) com validação de entrada e tratamento de erros
- Cada usuário só acessa os próprios dados (autorização em todas as rotas)
- Testes automatizados nas regras críticas: cálculo de PR, 1RM, volume, autenticação
- Seed com exercícios e um usuário de demonstração já com rotina e histórico preenchidos
- README explicando como rodar localmente (instalação, variáveis de ambiente, seed, testes)

## Entrega

Entregue o projeto organizado em pastas (`frontend/`, `backend/`), com código comentado onde for necessário, migrations do banco, seed de exercícios e instruções de execução. Priorize, nesta ordem: autenticação → rotinas → registro de treino → histórico/progresso → demais funcionalidades.
