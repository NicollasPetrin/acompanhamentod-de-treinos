/**
 * Documentação OpenAPI 3.0 da API, servida em /api/docs (Swagger UI) e
 * /api/docs.json (especificação crua).
 */
import { env } from '../env';

const bearer = [{ bearerAuth: [] }];

const ref = (nome: string) => ({ $ref: `#/components/schemas/${nome}` });

const respostaErro = (descricao: string) => ({
  description: descricao,
  content: { 'application/json': { schema: ref('Erro') } },
});

const jsonBody = (schema: unknown, obrigatorio = true) => ({
  required: obrigatorio,
  content: { 'application/json': { schema } },
});

const ok = (schema: unknown, descricao = 'Sucesso') => ({
  description: descricao,
  content: { 'application/json': { schema } },
});

const param = (name: string, descricao: string, tipo = 'string', local: 'path' | 'query' = 'path') => ({
  name,
  in: local,
  required: local === 'path',
  description: descricao,
  schema: { type: tipo },
});

export const openapiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'API — Acompanhamento de Treinos',
    version: '1.0.0',
    description: [
      'API REST do app de acompanhamento de treinos de academia.',
      '',
      '**Autenticação:** todas as rotas (exceto `/auth/*` e a leitura de rotina compartilhada)',
      'exigem o header `Authorization: Bearer <accessToken>`.',
      'O access token dura 15 minutos; use `POST /auth/refresh` com o refresh token para renovar.',
      '',
      '**Autorização:** cada usuário só enxerga e altera os próprios dados — todas as consultas',
      'são filtradas pelo id extraído do token.',
    ].join('\n'),
  },
  servers: [{ url: `http://localhost:${env.PORT}/api`, description: 'Desenvolvimento' }],
  tags: [
    { name: 'Auth', description: 'Cadastro, login, refresh e recuperação de senha' },
    { name: 'Usuário', description: 'Perfil, preferências e exclusão de conta' },
    { name: 'Exercícios', description: 'Biblioteca, favoritos e histórico por exercício' },
    { name: 'Rotinas', description: 'Fichas de treino, dias, exercícios, templates e compartilhamento' },
    { name: 'Treinos', description: 'Registro de treino, séries, finalização e sincronização offline' },
    { name: 'Progresso', description: 'Dashboards, gráficos, recordes e conquistas' },
    { name: 'Medidas', description: 'Medidas corporais e fotos de progresso' },
    { name: 'Metas', description: 'Metas com progresso automático' },
    { name: 'Ferramentas', description: 'Calculadoras de 1RM, anilhas e conversão de unidades' },
    { name: 'Dados', description: 'Exportação e importação (CSV/JSON)' },
    { name: 'Amigos', description: 'Convites de amizade' },
    { name: 'Grupos', description: 'Grupos de treino, mural automático e ranking' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Erro: {
        type: 'object',
        properties: {
          erro: {
            type: 'object',
            properties: {
              codigo: { type: 'string', example: 'nao_encontrado' },
              mensagem: { type: 'string', example: 'Registro não encontrado' },
              campos: { type: 'object', additionalProperties: { type: 'array', items: { type: 'string' } } },
            },
          },
        },
      },
      Usuario: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          username: { type: 'string', nullable: true, description: 'Apelido público, sem @' },
          photoUrl: { type: 'string', nullable: true },
          birthDate: { type: 'string', format: 'date-time', nullable: true },
          sex: { type: 'string', enum: ['masculino', 'feminino', 'outro'], nullable: true },
          heightCm: { type: 'number', nullable: true },
          weightKg: { type: 'number', nullable: true },
          goal: { type: 'string', enum: ['hipertrofia', 'emagrecimento', 'forca', 'condicionamento'], nullable: true },
          level: { type: 'string', enum: ['iniciante', 'intermediario', 'avancado'], nullable: true },
          weightUnit: { type: 'string', enum: ['kg', 'lb'] },
          theme: { type: 'string', enum: ['dark', 'light'] },
          trainingDays: { type: 'array', items: { type: 'string' } },
          defaultRestSec: { type: 'integer' },
          timeZone: {
            type: 'string',
            nullable: true,
            example: 'America/Sao_Paulo',
            description:
              'Fuso do aparelho (IANA), enviado pelo app. Define onde começa e termina o dia da pessoa nas contagens por dia, semana e mês. Sem ele, vale America/Sao_Paulo.',
          },
        },
      },
      Sessao: {
        type: 'object',
        properties: {
          usuario: ref('Usuario'),
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
          expiresAt: { type: 'string', format: 'date-time' },
        },
      },
      Exercicio: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string', example: 'Supino reto com barra' },
          muscleGroup: { type: 'string', example: 'peito' },
          secondaryMuscles: { type: 'array', items: { type: 'string' } },
          equipment: { type: 'string', example: 'barra' },
          type: { type: 'string', enum: ['forca', 'cardio', 'alongamento', 'mobilidade'] },
          instructions: { type: 'string' },
          imageUrl: { type: 'string' },
          isUnilateral: { type: 'boolean' },
          createdById: { type: 'string', nullable: true, description: 'null = exercício global' },
          favorito: { type: 'boolean' },
        },
      },
      Serie: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          order: { type: 'integer' },
          weight: { type: 'number' },
          reps: { type: 'integer' },
          rpe: { type: 'integer', nullable: true, minimum: 1, maximum: 10 },
          type: { type: 'string', enum: ['normal', 'aquecimento', 'drop', 'rest_pause', 'falha'] },
          completed: { type: 'boolean' },
          isPr: { type: 'boolean' },
          prTypes: { type: 'array', items: { type: 'string', enum: ['carga', 'reps', 'volume', '1rm'] } },
        },
      },
      Treino: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          routineDayId: { type: 'string', nullable: true },
          startedAt: { type: 'string', format: 'date-time' },
          finishedAt: { type: 'string', format: 'date-time', nullable: true },
          durationSec: { type: 'integer', nullable: true },
          status: { type: 'string', enum: ['em_andamento', 'concluido'] },
          notes: { type: 'string', nullable: true },
          rpe: { type: 'integer', nullable: true },
          totalVolume: { type: 'number' },
          totalSets: { type: 'integer' },
          totalReps: { type: 'integer' },
          exercises: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                order: { type: 'integer' },
                notes: { type: 'string', nullable: true },
                exercise: ref('Exercicio'),
                sets: { type: 'array', items: ref('Serie') },
              },
            },
          },
        },
      },
      Rotina: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          goal: { type: 'string', nullable: true },
          isActive: { type: 'boolean' },
          archived: { type: 'boolean' },
          shareSlug: { type: 'string', nullable: true },
          days: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string', example: 'Treino A — Peito e Tríceps' },
                order: { type: 'integer' },
                exercises: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      order: { type: 'integer' },
                      sets: { type: 'integer' },
                      repsMin: { type: 'integer' },
                      repsMax: { type: 'integer' },
                      suggestedLoad: { type: 'number', nullable: true },
                      restSec: { type: 'integer' },
                      technique: {
                        type: 'string',
                        enum: ['normal', 'superset', 'biset', 'dropset', 'rest_pause', 'aquecimento'],
                      },
                      notes: { type: 'string', nullable: true },
                      exercise: ref('Exercicio'),
                    },
                  },
                },
              },
            },
          },
        },
      },
      Medida: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          date: { type: 'string', format: 'date-time' },
          weightKg: { type: 'number', nullable: true },
          bodyFatPct: { type: 'number', nullable: true },
          measures: { type: 'object', additionalProperties: { type: 'number' } },
          photos: { type: 'array', items: { type: 'string' } },
          notes: { type: 'string', nullable: true },
        },
      },
      Meta: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string', example: 'Supino 100 kg até dezembro' },
          type: { type: 'string', enum: ['carga', '1rm', 'reps', 'peso_corporal', 'frequencia', 'volume'] },
          exerciseId: { type: 'string', nullable: true },
          targetValue: { type: 'number' },
          startValue: { type: 'number', nullable: true },
          deadline: { type: 'string', format: 'date-time', nullable: true },
          completed: { type: 'boolean' },
          currentValue: { type: 'number' },
          progress: { type: 'number', description: 'Progresso em % (0 a 100)' },
        },
      },
      ResumoTreino: {
        type: 'object',
        properties: {
          treino: ref('Treino'),
          duracaoSeg: { type: 'integer' },
          volumeTotal: { type: 'number' },
          seriesConcluidas: { type: 'integer' },
          repeticoesTotais: { type: 'integer' },
          exerciciosRealizados: { type: 'integer' },
          gruposMusculares: { type: 'object', additionalProperties: { type: 'integer' } },
          recordes: { type: 'array', items: { type: 'object' } },
          conquistas: { type: 'array', items: { type: 'object' } },
        },
      },
    },
  },
  security: bearer,
  paths: {
    '/auth/registrar': {
      post: {
        tags: ['Auth'],
        summary: 'Cria uma conta',
        security: [],
        requestBody: jsonBody({
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            name: { type: 'string', example: 'Maria Silva' },
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8, description: 'Mínimo 8 caracteres, com letra e número' },
          },
        }),
        responses: {
          201: ok(ref('Sessao'), 'Conta criada'),
          400: respostaErro('Senha fraca'),
          409: respostaErro('E-mail já cadastrado'),
          422: respostaErro('Dados inválidos'),
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Autentica o usuário',
        security: [],
        requestBody: jsonBody({
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
            rememberMe: { type: 'boolean', description: '"Manter conectado" — refresh token de 30 dias' },
          },
        }),
        responses: { 200: ok(ref('Sessao')), 401: respostaErro('Credenciais inválidas') },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Renova o access token (com rotação do refresh token)',
        security: [],
        requestBody: jsonBody({
          type: 'object',
          required: ['refreshToken'],
          properties: { refreshToken: { type: 'string' } },
        }),
        responses: { 200: ok(ref('Sessao')), 401: respostaErro('Sessão expirada') },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Encerra a sessão atual',
        security: [],
        requestBody: jsonBody({ type: 'object', properties: { refreshToken: { type: 'string' } } }, false),
        responses: { 200: ok({ type: 'object' }) },
      },
    },
    '/auth/esqueci-senha': {
      post: {
        tags: ['Auth'],
        summary: 'Envia e-mail com link de recuperação (token válido por 1 hora)',
        security: [],
        requestBody: jsonBody({ type: 'object', required: ['email'], properties: { email: { type: 'string' } } }),
        responses: { 200: ok({ type: 'object' }, 'Resposta genérica, mesmo se o e-mail não existir') },
      },
    },
    '/auth/redefinir-senha': {
      post: {
        tags: ['Auth'],
        summary: 'Redefine a senha com o token recebido por e-mail',
        security: [],
        requestBody: jsonBody({
          type: 'object',
          required: ['token', 'password'],
          properties: { token: { type: 'string' }, password: { type: 'string', minLength: 8 } },
        }),
        responses: { 200: ok({ type: 'object' }), 400: respostaErro('Token inválido ou expirado') },
      },
    },
    '/usuarios/eu': {
      get: { tags: ['Usuário'], summary: 'Dados do usuário autenticado', responses: { 200: ok(ref('Usuario')) } },
      patch: {
        tags: ['Usuário'],
        summary: 'Atualiza o perfil',
        requestBody: jsonBody(ref('Usuario')),
        responses: { 200: ok(ref('Usuario')) },
      },
      delete: {
        tags: ['Usuário'],
        summary: 'Exclui a conta (exige senha e a confirmação "EXCLUIR")',
        requestBody: jsonBody({
          type: 'object',
          required: ['password', 'confirmacao'],
          properties: { password: { type: 'string' }, confirmacao: { type: 'string', example: 'EXCLUIR' } },
        }),
        responses: { 200: ok({ type: 'object' }), 400: respostaErro('Senha incorreta ou confirmação inválida') },
      },
    },
    '/usuarios/eu/preferencias': {
      patch: {
        tags: ['Usuário'],
        summary: 'Atualiza preferências (unidade, tema, dias de treino, descanso padrão)',
        requestBody: jsonBody({
          type: 'object',
          properties: {
            weightUnit: { type: 'string', enum: ['kg', 'lb'] },
            theme: { type: 'string', enum: ['dark', 'light'] },
            trainingDays: { type: 'array', items: { type: 'string', enum: ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'] } },
            defaultRestSec: { type: 'integer' },
            remindersOn: { type: 'boolean' },
            reminderTime: { type: 'string', example: '18:30' },
          },
        }),
        responses: { 200: ok(ref('Usuario')) },
      },
    },
    '/usuarios/eu/foto': {
      post: {
        tags: ['Usuário'],
        summary: 'Envia a foto de perfil',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: { type: 'object', properties: { foto: { type: 'string', format: 'binary' } } },
            },
          },
        },
        responses: { 200: ok(ref('Usuario')) },
      },
    },
    '/usuarios/eu/senha': {
      patch: {
        tags: ['Usuário'],
        summary: 'Troca a senha',
        requestBody: jsonBody({
          type: 'object',
          required: ['senhaAtual', 'novaSenha'],
          properties: { senhaAtual: { type: 'string' }, novaSenha: { type: 'string', minLength: 8 } },
        }),
        responses: { 200: ok({ type: 'object' }), 400: respostaErro('Senha atual incorreta') },
      },
    },
    '/usuarios/username-livre': {
      get: {
        tags: ['Usuário'],
        summary: 'Diz se um nome de usuário está disponível',
        parameters: [param('username', 'Apelido a verificar', 'string', 'query')],
        responses: { 200: ok({ type: 'object', properties: { username: { type: 'string' }, livre: { type: 'boolean' }, motivo: { type: 'string', nullable: true } } }) },
      },
    },
    '/exercicios': {
      get: {
        tags: ['Exercícios'],
        summary: 'Biblioteca de exercícios com busca e filtros',
        parameters: [
          param('busca', 'Texto para busca no nome', 'string', 'query'),
          param('grupo', 'Grupo muscular', 'string', 'query'),
          param('equipamento', 'Equipamento', 'string', 'query'),
          param('tipo', 'força | cardio | alongamento | mobilidade', 'string', 'query'),
          param('favoritos', 'Somente favoritos', 'boolean', 'query'),
          param('meus', 'Somente exercícios personalizados', 'boolean', 'query'),
          param('pagina', 'Página (padrão 1)', 'integer', 'query'),
          param('limite', 'Itens por página (padrão 50)', 'integer', 'query'),
        ],
        responses: {
          200: ok({
            type: 'object',
            properties: {
              total: { type: 'integer' },
              itens: { type: 'array', items: ref('Exercicio') },
            },
          }),
        },
      },
      post: {
        tags: ['Exercícios'],
        summary: 'Cria exercício personalizado',
        requestBody: jsonBody(ref('Exercicio')),
        responses: { 201: ok(ref('Exercicio')) },
      },
    },
    '/exercicios/filtros': {
      get: {
        tags: ['Exercícios'],
        summary: 'Opções de grupos musculares, equipamentos e tipos',
        responses: { 200: ok({ type: 'object' }) },
      },
    },
    '/exercicios/{id}': {
      get: {
        tags: ['Exercícios'],
        summary: 'Detalhe do exercício',
        parameters: [param('id', 'ID do exercício')],
        responses: { 200: ok(ref('Exercicio')), 404: respostaErro('Não encontrado') },
      },
      patch: {
        tags: ['Exercícios'],
        summary: 'Edita exercício personalizado',
        parameters: [param('id', 'ID do exercício')],
        requestBody: jsonBody(ref('Exercicio')),
        responses: { 200: ok(ref('Exercicio')), 403: respostaErro('Exercício de outro usuário') },
      },
      delete: {
        tags: ['Exercícios'],
        summary: 'Exclui exercício personalizado',
        parameters: [param('id', 'ID do exercício')],
        responses: { 200: ok({ type: 'object' }) },
      },
    },
    '/exercicios/{id}/historico': {
      get: {
        tags: ['Exercícios'],
        summary: 'Histórico do usuário no exercício (melhor carga, 1RM, evolução)',
        parameters: [param('id', 'ID do exercício')],
        responses: { 200: ok({ type: 'object' }) },
      },
    },
    '/exercicios/{id}/favorito': {
      post: {
        tags: ['Exercícios'],
        summary: 'Marca como favorito',
        parameters: [param('id', 'ID do exercício')],
        responses: { 200: ok({ type: 'object' }) },
      },
      delete: {
        tags: ['Exercícios'],
        summary: 'Desmarca favorito',
        parameters: [param('id', 'ID do exercício')],
        responses: { 200: ok({ type: 'object' }) },
      },
    },
    '/rotinas': {
      get: {
        tags: ['Rotinas'],
        summary: 'Lista as rotinas do usuário',
        parameters: [param('arquivadas', 'Listar arquivadas', 'boolean', 'query')],
        responses: { 200: ok({ type: 'array', items: ref('Rotina') }) },
      },
      post: {
        tags: ['Rotinas'],
        summary: 'Cria uma rotina (opcionalmente já com dias e exercícios)',
        requestBody: jsonBody(ref('Rotina')),
        responses: { 201: ok(ref('Rotina')) },
      },
    },
    '/rotinas/ativa': {
      get: { tags: ['Rotinas'], summary: 'Rotina ativa', responses: { 200: ok(ref('Rotina')) } },
    },
    '/rotinas/templates': {
      get: {
        tags: ['Rotinas'],
        summary: 'Templates prontos (ABC, ABCD, PPL, Upper/Lower, Full Body)',
        responses: { 200: ok({ type: 'array', items: { type: 'object' } }) },
      },
    },
    '/rotinas/templates/{slug}/aplicar': {
      post: {
        tags: ['Rotinas'],
        summary: 'Cria uma rotina a partir de um template',
        parameters: [param('slug', 'Slug do template (ex.: abc, push-pull-legs)')],
        responses: { 201: ok(ref('Rotina')) },
      },
    },
    '/rotinas/{id}': {
      get: { tags: ['Rotinas'], summary: 'Detalhe da rotina', parameters: [param('id', 'ID')], responses: { 200: ok(ref('Rotina')) } },
      patch: { tags: ['Rotinas'], summary: 'Edita a rotina', parameters: [param('id', 'ID')], requestBody: jsonBody(ref('Rotina')), responses: { 200: ok(ref('Rotina')) } },
      delete: { tags: ['Rotinas'], summary: 'Exclui a rotina', parameters: [param('id', 'ID')], responses: { 200: ok({ type: 'object' }) } },
    },
    '/rotinas/{id}/ativar': {
      post: { tags: ['Rotinas'], summary: 'Define como rotina ativa', parameters: [param('id', 'ID')], responses: { 200: ok(ref('Rotina')) } },
    },
    '/rotinas/{id}/arquivar': {
      post: { tags: ['Rotinas'], summary: 'Arquiva/desarquiva', parameters: [param('id', 'ID')], responses: { 200: ok(ref('Rotina')) } },
    },
    '/rotinas/{id}/duplicar': {
      post: { tags: ['Rotinas'], summary: 'Duplica a rotina', parameters: [param('id', 'ID')], responses: { 201: ok(ref('Rotina')) } },
    },
    '/rotinas/{id}/compartilhar': {
      post: { tags: ['Rotinas'], summary: 'Gera link público', parameters: [param('id', 'ID')], responses: { 200: ok({ type: 'object' }) } },
      delete: { tags: ['Rotinas'], summary: 'Revoga o link público', parameters: [param('id', 'ID')], responses: { 200: ok({ type: 'object' }) } },
    },
    '/rotinas/compartilhadas/{slug}': {
      get: {
        tags: ['Rotinas'],
        summary: 'Lê uma rotina compartilhada (público)',
        security: [],
        parameters: [param('slug', 'Slug do compartilhamento')],
        responses: { 200: ok(ref('Rotina')) },
      },
    },
    '/rotinas/compartilhadas/{slug}/copiar': {
      post: {
        tags: ['Rotinas'],
        summary: 'Copia a rotina compartilhada para a própria conta',
        parameters: [param('slug', 'Slug do compartilhamento')],
        responses: { 201: ok(ref('Rotina')) },
      },
    },
    '/rotinas/{id}/dias': {
      post: { tags: ['Rotinas'], summary: 'Adiciona um dia de treino', parameters: [param('id', 'ID da rotina')], requestBody: jsonBody({ type: 'object', properties: { name: { type: 'string' } } }), responses: { 201: ok({ type: 'object' }) } },
    },
    '/rotinas/{id}/dias/reordenar': {
      patch: {
        tags: ['Rotinas'],
        summary: 'Reordena os dias (arrastar e soltar)',
        parameters: [param('id', 'ID da rotina')],
        requestBody: jsonBody({ type: 'object', properties: { ordem: { type: 'array', items: { type: 'string' } } } }),
        responses: { 200: ok(ref('Rotina')) },
      },
    },
    '/rotinas/dias/{diaId}': {
      patch: { tags: ['Rotinas'], summary: 'Edita o dia', parameters: [param('diaId', 'ID do dia')], requestBody: jsonBody({ type: 'object' }), responses: { 200: ok({ type: 'object' }) } },
      delete: { tags: ['Rotinas'], summary: 'Exclui o dia', parameters: [param('diaId', 'ID do dia')], responses: { 200: ok({ type: 'object' }) } },
    },
    '/rotinas/dias/{diaId}/duplicar': {
      post: { tags: ['Rotinas'], summary: 'Duplica o dia', parameters: [param('diaId', 'ID do dia')], responses: { 201: ok({ type: 'object' }) } },
    },
    '/rotinas/dias/{diaId}/exercicios': {
      post: {
        tags: ['Rotinas'],
        summary: 'Adiciona exercício ao dia',
        parameters: [param('diaId', 'ID do dia')],
        requestBody: jsonBody({
          type: 'object',
          required: ['exerciseId'],
          properties: {
            exerciseId: { type: 'string' },
            sets: { type: 'integer' },
            repsMin: { type: 'integer' },
            repsMax: { type: 'integer' },
            restSec: { type: 'integer' },
            technique: { type: 'string' },
            suggestedLoad: { type: 'number' },
            notes: { type: 'string' },
          },
        }),
        responses: { 201: ok({ type: 'object' }) },
      },
    },
    '/rotinas/dias/{diaId}/exercicios/reordenar': {
      patch: {
        tags: ['Rotinas'],
        summary: 'Reordena os exercícios do dia',
        parameters: [param('diaId', 'ID do dia')],
        requestBody: jsonBody({ type: 'object', properties: { ordem: { type: 'array', items: { type: 'string' } } } }),
        responses: { 200: ok({ type: 'array', items: { type: 'object' } }) },
      },
    },
    '/rotinas/exercicios/{itemId}': {
      patch: { tags: ['Rotinas'], summary: 'Edita séries/reps/descanso/técnica', parameters: [param('itemId', 'ID do item')], requestBody: jsonBody({ type: 'object' }), responses: { 200: ok({ type: 'object' }) } },
      delete: { tags: ['Rotinas'], summary: 'Remove o exercício da rotina', parameters: [param('itemId', 'ID do item')], responses: { 200: ok({ type: 'object' }) } },
    },
    '/treinos/iniciar': {
      post: {
        tags: ['Treinos'],
        summary: 'Inicia um treino (de um dia da rotina ou livre)',
        description: 'As séries já vêm preenchidas com os valores usados da última vez naquele exercício.',
        requestBody: jsonBody({
          type: 'object',
          properties: {
            routineDayId: { type: 'string', nullable: true },
            name: { type: 'string' },
            clientId: { type: 'string', description: 'ID gerado no cliente (idempotência offline)' },
          },
        }),
        responses: { 201: ok(ref('Treino')), 409: respostaErro('Já existe treino em andamento') },
      },
    },
    '/treinos/em-andamento': {
      get: { tags: ['Treinos'], summary: 'Rascunho do treino atual', responses: { 200: ok(ref('Treino')) } },
    },
    '/treinos': {
      get: {
        tags: ['Treinos'],
        summary: 'Histórico de treinos (paginado)',
        parameters: [
          param('de', 'Data inicial (ISO)', 'string', 'query'),
          param('ate', 'Data final (ISO)', 'string', 'query'),
          param('pagina', 'Página', 'integer', 'query'),
          param('limite', 'Itens por página', 'integer', 'query'),
        ],
        responses: { 200: ok({ type: 'object', properties: { total: { type: 'integer' }, itens: { type: 'array', items: ref('Treino') } } }) },
      },
    },
    '/treinos/calendario': {
      get: {
        tags: ['Treinos'],
        summary: 'Dias treinados no mês',
        parameters: [param('mes', 'Mês no formato AAAA-MM', 'string', 'query')],
        responses: { 200: ok({ type: 'object' }) },
      },
    },
    '/treinos/{id}': {
      get: { tags: ['Treinos'], summary: 'Detalhe do treino', parameters: [param('id', 'ID')], responses: { 200: ok(ref('Treino')) } },
      patch: { tags: ['Treinos'], summary: 'Edita nome, notas, RPE ou data', parameters: [param('id', 'ID')], requestBody: jsonBody({ type: 'object' }), responses: { 200: ok(ref('Treino')) } },
      delete: { tags: ['Treinos'], summary: 'Exclui o treino e recalcula recordes', parameters: [param('id', 'ID')], responses: { 200: ok({ type: 'object' }) } },
    },
    '/treinos/{id}/exercicios': {
      post: { tags: ['Treinos'], summary: 'Adiciona exercício durante o treino', parameters: [param('id', 'ID do treino')], requestBody: jsonBody({ type: 'object', required: ['exerciseId'], properties: { exerciseId: { type: 'string' }, sets: { type: 'integer' } } }), responses: { 201: ok({ type: 'object' }) } },
    },
    '/treinos/exercicios/{itemId}': {
      patch: { tags: ['Treinos'], summary: 'Anotação por exercício', parameters: [param('itemId', 'ID')], requestBody: jsonBody({ type: 'object', properties: { notes: { type: 'string' } } }), responses: { 200: ok({ type: 'object' }) } },
      delete: { tags: ['Treinos'], summary: 'Remove exercício do treino', parameters: [param('itemId', 'ID')], responses: { 200: ok({ type: 'object' }) } },
    },
    '/treinos/exercicios/{itemId}/series': {
      post: { tags: ['Treinos'], summary: 'Adiciona série', parameters: [param('itemId', 'ID do exercício no treino')], requestBody: jsonBody({ type: 'object', properties: { weight: { type: 'number' }, reps: { type: 'integer' }, type: { type: 'string' } } }), responses: { 201: ok(ref('Serie')) } },
    },
    '/treinos/series/{setId}': {
      patch: {
        tags: ['Treinos'],
        summary: 'Edita a série e marca como concluída',
        description: 'Ao concluir, a resposta traz os recordes pessoais batidos pela série.',
        parameters: [param('setId', 'ID da série')],
        requestBody: jsonBody({
          type: 'object',
          properties: {
            weight: { type: 'number' },
            reps: { type: 'integer' },
            rpe: { type: 'integer' },
            type: { type: 'string' },
            completed: { type: 'boolean' },
          },
        }),
        responses: {
          200: ok({
            type: 'object',
            properties: { serie: ref('Serie'), recordes: { type: 'array', items: { type: 'object' } } },
          }),
        },
      },
      delete: { tags: ['Treinos'], summary: 'Remove a série', parameters: [param('setId', 'ID da série')], responses: { 200: ok({ type: 'object' }) } },
    },
    '/treinos/{id}/finalizar': {
      post: {
        tags: ['Treinos'],
        summary: 'Finaliza o treino e devolve o resumo',
        parameters: [param('id', 'ID do treino')],
        requestBody: jsonBody({
          type: 'object',
          properties: {
            notes: { type: 'string' },
            rpe: { type: 'integer' },
            descartarSeriesNaoConcluidas: { type: 'boolean', default: true },
          },
        }, false),
        responses: { 200: ok(ref('ResumoTreino')) },
      },
    },
    '/treinos/{id}/resumo': {
      get: { tags: ['Treinos'], summary: 'Resumo do treino', parameters: [param('id', 'ID')], responses: { 200: ok(ref('ResumoTreino')) } },
    },
    '/treinos/{id}/descartar': {
      post: { tags: ['Treinos'], summary: 'Descarta o rascunho em andamento', parameters: [param('id', 'ID')], responses: { 200: ok({ type: 'object' }) } },
    },
    '/treinos/sincronizar': {
      post: {
        tags: ['Treinos'],
        summary: 'Sincroniza treinos registrados offline',
        description: 'Idempotente pelo par (usuário, clientId): reenviar o mesmo treino não duplica.',
        requestBody: jsonBody({
          type: 'object',
          properties: { treinos: { type: 'array', items: { type: 'object' } } },
        }),
        responses: { 200: ok({ type: 'object' }) },
      },
    },
    '/progresso/resumo': {
      get: { tags: ['Progresso'], summary: 'Resumo da tela inicial (streak, semana, próximo treino)', responses: { 200: ok({ type: 'object' }) } },
    },
    '/progresso/volume-semanal': {
      get: { tags: ['Progresso'], summary: 'Volume por semana', parameters: [param('semanas', 'Qtde de semanas (padrão 12)', 'integer', 'query')], responses: { 200: ok({ type: 'array', items: { type: 'object' } }) } },
    },
    '/progresso/grupos-musculares': {
      get: { tags: ['Progresso'], summary: 'Distribuição de séries por grupo muscular', parameters: [param('dias', 'Janela em dias (padrão 30)', 'integer', 'query')], responses: { 200: ok({ type: 'array', items: { type: 'object' } }) } },
    },
    '/progresso/frequencia': {
      get: { tags: ['Progresso'], summary: 'Frequência por mês e média semanal', parameters: [param('meses', 'Qtde de meses (padrão 6)', 'integer', 'query')], responses: { 200: ok({ type: 'object' }) } },
    },
    '/progresso/comparativo': {
      get: { tags: ['Progresso'], summary: 'Este mês vs. mês passado', responses: { 200: ok({ type: 'object' }) } },
    },
    '/progresso/recordes': {
      get: { tags: ['Progresso'], summary: 'Quadro de recordes pessoais', responses: { 200: ok({ type: 'array', items: { type: 'object' } }) } },
    },
    '/progresso/conquistas': {
      get: { tags: ['Progresso'], summary: 'Conquistas obtidas e bloqueadas', responses: { 200: ok({ type: 'object' }) } },
    },
    '/medidas': {
      get: { tags: ['Medidas'], summary: 'Lista as medidas corporais', responses: { 200: ok({ type: 'array', items: ref('Medida') }) } },
      post: { tags: ['Medidas'], summary: 'Registra peso, gordura e medidas', requestBody: jsonBody(ref('Medida')), responses: { 201: ok(ref('Medida')) } },
    },
    '/medidas/evolucao': {
      get: { tags: ['Medidas'], summary: 'Séries temporais de cada medida', responses: { 200: ok({ type: 'object' }) } },
    },
    '/medidas/{id}': {
      patch: { tags: ['Medidas'], summary: 'Edita o registro', parameters: [param('id', 'ID')], requestBody: jsonBody(ref('Medida')), responses: { 200: ok(ref('Medida')) } },
      delete: { tags: ['Medidas'], summary: 'Exclui o registro', parameters: [param('id', 'ID')], responses: { 200: ok({ type: 'object' }) } },
    },
    '/medidas/{id}/fotos': {
      post: {
        tags: ['Medidas'],
        summary: 'Anexa foto de progresso',
        parameters: [param('id', 'ID')],
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: { type: 'object', properties: { foto: { type: 'string', format: 'binary' } } } } },
        },
        responses: { 201: ok(ref('Medida')) },
      },
      delete: { tags: ['Medidas'], summary: 'Remove uma foto', parameters: [param('id', 'ID')], requestBody: jsonBody({ type: 'object', properties: { url: { type: 'string' } } }), responses: { 200: ok(ref('Medida')) } },
    },
    '/metas': {
      get: { tags: ['Metas'], summary: 'Metas com progresso calculado', responses: { 200: ok({ type: 'array', items: ref('Meta') }) } },
      post: { tags: ['Metas'], summary: 'Cria meta', requestBody: jsonBody(ref('Meta')), responses: { 201: ok(ref('Meta')) } },
    },
    '/metas/{id}': {
      patch: { tags: ['Metas'], summary: 'Edita meta', parameters: [param('id', 'ID')], requestBody: jsonBody(ref('Meta')), responses: { 200: ok(ref('Meta')) } },
      delete: { tags: ['Metas'], summary: 'Exclui meta', parameters: [param('id', 'ID')], responses: { 200: ok({ type: 'object' }) } },
    },
    '/ferramentas/1rm': {
      get: {
        tags: ['Ferramentas'],
        summary: 'Calculadora de 1RM (Epley e Brzycki) com tabela de percentuais',
        parameters: [
          param('peso', 'Carga usada', 'number', 'query'),
          param('reps', 'Repetições', 'integer', 'query'),
          param('formula', 'epley | brzycki', 'string', 'query'),
        ],
        responses: { 200: ok({ type: 'object' }) },
      },
    },
    '/ferramentas/anilhas': {
      get: {
        tags: ['Ferramentas'],
        summary: 'Calculadora de anilhas por lado da barra',
        parameters: [
          param('peso', 'Peso alvo total', 'number', 'query'),
          param('barra', 'Peso da barra (padrão 20)', 'number', 'query'),
          param('anilhas', 'Anilhas disponíveis separadas por vírgula', 'string', 'query'),
        ],
        responses: { 200: ok({ type: 'object' }) },
      },
    },
    '/ferramentas/conversao': {
      get: {
        tags: ['Ferramentas'],
        summary: 'Conversão kg ↔ lb',
        parameters: [
          param('valor', 'Valor', 'number', 'query'),
          param('de', 'kg | lb', 'string', 'query'),
          param('para', 'kg | lb', 'string', 'query'),
        ],
        responses: { 200: ok({ type: 'object' }) },
      },
    },
    '/dados/exportar': {
      get: {
        tags: ['Dados'],
        summary: 'Exporta todos os dados do usuário',
        parameters: [param('formato', 'json | csv', 'string', 'query')],
        responses: { 200: { description: 'Arquivo JSON ou CSV' } },
      },
    },
    '/dados/importar': {
      post: {
        tags: ['Dados'],
        summary: 'Importa treinos de CSV do Strong ou do Hevy',
        requestBody: jsonBody({
          type: 'object',
          required: ['csv'],
          properties: {
            csv: { type: 'string', description: 'Conteúdo do arquivo CSV' },
            origem: { type: 'string', enum: ['strong', 'hevy', 'auto'], default: 'auto' },
          },
        }),
        responses: { 200: ok({ type: 'object' }) },
      },
    },
    '/amigos': {
      get: { tags: ['Amigos'], summary: 'Amigos e convites (recebidos e enviados)', responses: { 200: ok({ type: 'object' }) } },
      post: {
        tags: ['Amigos'],
        summary: 'Convida alguém pelo nome de usuário (aceita na hora se o convite for mútuo)',
        requestBody: jsonBody({
          type: 'object',
          required: ['username'],
          properties: { username: { type: 'string', example: 'brunolima', description: 'Com ou sem @; maiúsculas e acentos são normalizados' } },
        }),
        responses: { 201: ok({ type: 'object' }), 404: respostaErro('Ninguém usa esse nome de usuário'), 409: respostaErro('Convite ou amizade já existe') },
      },
    },
    '/amigos/{id}/aceitar': {
      post: { tags: ['Amigos'], summary: 'Aceita um convite recebido', parameters: [param('id', 'ID do convite')], responses: { 200: ok({ type: 'object' }) } },
    },
    '/amigos/{id}': {
      delete: {
        tags: ['Amigos'],
        summary: 'Recusa o convite, cancela o que você enviou ou desfaz a amizade',
        parameters: [param('id', 'ID do convite/amizade')],
        responses: { 200: ok({ type: 'object' }) },
      },
    },
    '/grupos': {
      get: { tags: ['Grupos'], summary: 'Grupos do usuário', responses: { 200: ok({ type: 'array', items: { type: 'object' } }) } },
      post: {
        tags: ['Grupos'],
        summary: 'Cria um grupo (quem cria vira dono)',
        requestBody: jsonBody({ type: 'object', required: ['name'], properties: { name: { type: 'string' }, description: { type: 'string', nullable: true } } }),
        responses: { 201: ok({ type: 'object' }) },
      },
    },
    '/grupos/entrar': {
      post: {
        tags: ['Grupos'],
        summary: 'Entra num grupo pelo código de convite',
        requestBody: jsonBody({ type: 'object', required: ['codigo'], properties: { codigo: { type: 'string', example: 'K7F3QP' } } }),
        responses: { 201: ok({ type: 'object' }), 404: respostaErro('Código inválido') },
      },
    },
    '/grupos/atividade': {
      get: {
        tags: ['Grupos'],
        summary: 'Últimos treinos dos amigos, somando todos os grupos',
        parameters: [param('limite', 'Quantidade (padrão 5)', 'integer', 'query')],
        responses: { 200: ok({ type: 'array', items: { type: 'object' } }) },
      },
    },
    '/grupos/{id}': {
      get: { tags: ['Grupos'], summary: 'Grupo, ranking da semana e convidados', parameters: [param('id', 'ID')], responses: { 200: ok({ type: 'object' }) } },
      patch: { tags: ['Grupos'], summary: 'Edita nome e descrição (dono)', parameters: [param('id', 'ID')], requestBody: jsonBody({ type: 'object' }), responses: { 200: ok({ type: 'object' }) } },
      delete: { tags: ['Grupos'], summary: 'Exclui o grupo (dono)', parameters: [param('id', 'ID')], responses: { 200: ok({ type: 'object' }) } },
    },
    '/grupos/{id}/mural': {
      get: {
        tags: ['Grupos'],
        summary: 'Treinos concluídos pelos membros, do mais recente ao mais antigo',
        description: 'Derivado dos treinos: assim que alguém finaliza (ou sincroniza um treino feito offline), ele aparece aqui sozinho.',
        parameters: [
          param('id', 'ID do grupo'),
          param('limite', 'Quantidade (padrão 20)', 'integer', 'query'),
          param('antesDe', 'Pagina para trás a partir desta data', 'string', 'query'),
        ],
        responses: { 200: ok({ type: 'array', items: { type: 'object' } }) },
      },
    },
    '/grupos/{id}/codigo': {
      post: { tags: ['Grupos'], summary: 'Gera um código novo e invalida o anterior (dono)', parameters: [param('id', 'ID')], responses: { 200: ok({ type: 'object' }) } },
    },
    '/grupos/{id}/convidar': {
      post: {
        tags: ['Grupos'],
        summary: 'Convida um amigo para o grupo',
        parameters: [param('id', 'ID do grupo')],
        requestBody: jsonBody({ type: 'object', required: ['userId'], properties: { userId: { type: 'string' } } }),
        responses: { 201: ok({ type: 'object' }), 403: respostaErro('Só amigos podem ser convidados') },
      },
    },
    '/grupos/{id}/aceitar': {
      post: { tags: ['Grupos'], summary: 'Aceita o convite para o grupo', parameters: [param('id', 'ID')], responses: { 200: ok({ type: 'object' }) } },
    },
    '/grupos/{id}/membros/{userId}': {
      delete: {
        tags: ['Grupos'],
        summary: 'Sai do grupo, ou o dono remove um membro',
        parameters: [param('id', 'ID do grupo'), param('userId', 'ID da pessoa')],
        responses: { 200: ok({ type: 'object' }) },
      },
    },
  },
};
