import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, Calculator, ChevronDown, Dumbbell, ListChecks, Play, Ruler, Smartphone,
  Target, Timer, TrendingUp, Trophy, Users, UsersRound, WifiOff,
} from 'lucide-react';
import { Botao, Cartao, TituloSecao } from '../components/ui';

interface Tutorial {
  id: string;
  icone: typeof Play;
  titulo: string;
  resumo: string;
  passos: ReactNode[];
  dica?: string;
}

/**
 * Tutoriais curtos, em passos, escritos para quem nunca usou o app.
 * Ficam em /app/ajuda e são o primeiro destino do cartão de boas-vindas.
 */
const TUTORIAIS: Tutorial[] = [
  {
    id: 'primeiros-passos',
    icone: BookOpen,
    titulo: 'Primeiros passos',
    resumo: 'O caminho mais curto do zero até o primeiro treino registrado.',
    passos: [
      <>Monte sua ficha em <strong>Rotinas → Nova</strong>. O assistente pergunta quantos dias você treina e já sugere uma divisão pronta.</>,
      <>Marque a rotina como <strong>ativa</strong>: é ela que aparece na tela inicial.</>,
      <>Na academia, toque no botão verde <strong>▶</strong> da barra de baixo ou em <strong>Iniciar</strong> no dia que você vai treinar.</>,
      <>Vá marcando cada série concluída. No fim, toque em <strong>Finalizar</strong> para ver o resumo.</>,
    ],
    dica: 'Não precisa montar tudo de uma vez. Dá para começar com um modelo pronto e ir ajustando a cada treino.',
  },
  {
    id: 'montar-rotina',
    icone: ListChecks,
    titulo: 'Montar sua rotina',
    resumo: 'Dias de treino, exercícios, séries e descanso do seu jeito.',
    passos: [
      <>Em <strong>Rotinas</strong>, crie uma nova ou use um <strong>modelo pronto</strong> (ABC, Push/Pull/Legs, Full Body…).</>,
      <>Dentro da rotina, cada <strong>dia</strong> é um treino: Treino A, Treino B, Push, Pernas — o nome é seu.</>,
      <>Em cada dia, toque em <strong>Adicionar exercício</strong>. Se o movimento não estiver na lista, use <strong>Cadastrar exercício novo</strong> ali mesmo.</>,
      <>Toque no exercício para ajustar <strong>séries, faixa de repetições, carga sugerida, descanso</strong> e técnicas como superset ou drop set.</>,
      <>Para mudar a ordem, arraste pelo ícone <strong>⠿</strong> à esquerda.</>,
    ],
    dica: 'Duplicar um dia é mais rápido que montar de novo: use o ícone de cópia no cabeçalho do dia.',
  },
  {
    id: 'registrar-treino',
    icone: Timer,
    titulo: 'Registrar o treino',
    resumo: 'A tela que você usa de verdade na academia, com uma mão só.',
    passos: [
      <>As séries já vêm preenchidas com o <strong>peso e as repetições da última vez</strong> — normalmente é só conferir.</>,
      <>Toque no campo para corrigir a carga ou as repetições. Vírgula funciona: <strong>42,5</strong>.</>,
      <>Toque no <strong>✓</strong> para marcar a série. O <strong>cronômetro de descanso</strong> começa sozinho e avisa com som e vibração.</>,
      <>Precisa de mais uma série? <strong>+ Série</strong>. Fazendo aquecimento ou drop set? Os botões ao lado marcam o tipo.</>,
      <>Use o ícone de <strong>anotação</strong> no exercício para registrar coisas como &quot;senti o ombro&quot; ou &quot;subir carga na próxima&quot;.</>,
      <>No fim, <strong>Finalizar</strong> mostra duração, volume, recordes e os grupos musculares que você trabalhou.</>,
    ],
    dica: 'Fechou o app no meio do treino? Nada se perde: ao voltar, o treino continua de onde parou.',
  },
  {
    id: 'recordes',
    icone: Trophy,
    titulo: 'Recordes (PR) e 1RM',
    resumo: 'O que o app considera recorde e de onde sai o 1RM estimado.',
    passos: [
      <>Ao concluir uma série, o app compara com tudo que você já fez naquele exercício e avisa na hora se bateu recorde.</>,
      <>São quatro tipos: <strong>carga</strong> (peso mais alto), <strong>repetições</strong>, <strong>volume</strong> (peso × reps) e <strong>1RM estimado</strong>.</>,
      <>Séries de <strong>aquecimento não contam</strong> como recorde — nem entram no volume do treino.</>,
      <>O <strong>1RM</strong> é uma estimativa do quanto você levantaria em uma repetição só, calculada pela fórmula de Epley.</>,
    ],
    dica: 'O quadro completo fica em Mais → Recordes e conquistas.',
  },
  {
    id: 'evolucao',
    icone: TrendingUp,
    titulo: 'Acompanhar a evolução',
    resumo: 'Gráficos, medidas e metas.',
    passos: [
      <>Em <strong>Progresso</strong> você vê volume por semana, frequência, comparativo com o mês passado e a distribuição por grupo muscular.</>,
      <>Abrindo um exercício na biblioteca, aparecem os gráficos de <strong>carga e 1RM</strong> daquele movimento.</>,
      <>Em <strong>Medidas</strong>, registre peso, percentual de gordura e circunferências — e tire fotos de progresso para comparar lado a lado.</>,
      <>Em <strong>Metas</strong>, crie objetivos como &quot;supino 100 kg&quot; ou &quot;treinar 4x por semana&quot;: a barra de progresso se atualiza sozinha.</>,
    ],
  },
  {
    id: 'offline',
    icone: WifiOff,
    titulo: 'Sem internet e no celular',
    resumo: 'Instalar como aplicativo e treinar mesmo sem sinal.',
    passos: [
      <>No celular, abra o site no navegador e escolha <strong>&quot;Adicionar à tela de início&quot;</strong>. Ele passa a abrir como aplicativo, em tela cheia.</>,
      <>Sem sinal na academia? Pode registrar normalmente: o treino fica salvo no aparelho.</>,
      <>Quando a conexão voltar, o envio acontece sozinho — uma faixa no topo avisa quando há treinos esperando.</>,
    ],
  },
  {
    id: 'amigos-e-grupos',
    icone: UsersRound,
    titulo: 'Amigos e grupos de treino',
    resumo: 'Ver o treino da galera sem precisar mandar print no zap.',
    passos: [
      <>Todo mundo tem um <strong>nome de usuário</strong> (aquele @ no topo da tela de Amigos). Passe o seu para a galera — dá para copiar ou compartilhar com um toque.</>,
      <>Em <strong>Amigos</strong>, digite o nome de usuário da pessoa e mande o convite. Ela aceita e pronto.</>,
      <>Em <strong>Grupos de treino</strong>, toque em <strong>Criar grupo</strong> e dê um nome (&quot;Galera da academia&quot;, &quot;Segunda a sexta&quot;…).</>,
      <>O grupo ganha um <strong>código de 6 letras</strong>. Mande para os amigos: quem tiver o código entra. Amigos do app dá para convidar direto, sem código.</>,
      <>A partir daí não precisa fazer mais nada: <strong>todo treino que alguém finalizar aparece sozinho no mural do grupo</strong>, com duração, volume, grupos musculares e recordes.</>,
      <>A aba <strong>Ranking da semana</strong> mostra quem treinou mais — a contagem zera toda segunda-feira.</>,
      <>O mural mostra o resumo, nunca a carga série a série. Para pausar sem sair do grupo, desligue <strong>Treinos nos grupos</strong> em Perfil e configurações.</>,
    ],
    dica: 'Não gostou do seu @? Troque quando quiser em Perfil e configurações — ele precisa só ser diferente do de todo mundo.',
  },
  {
    id: 'dupla',
    icone: Users,
    titulo: 'Treino em dupla',
    resumo: 'Duas pessoas registrando no mesmo celular.',
    passos: [
      <>Durante o treino, toque no ícone de <strong>duas pessoas</strong> no topo.</>,
      <>Use <strong>Entrar com outra conta</strong> para adicionar a segunda pessoa (a sua continua salva no aparelho).</>,
      <>A partir daí, é um toque para alternar: cada um registra na própria conta e mantém o próprio treino em andamento.</>,
    ],
  },
  {
    id: 'extras',
    icone: Calculator,
    titulo: 'Recursos que ajudam',
    resumo: 'Calculadoras, favoritos, compartilhamento e backup.',
    passos: [
      <><strong>Calculadoras</strong>: 1RM com tabela de percentuais, quantas anilhas pôr de cada lado da barra e conversão kg ↔ lb.</>,
      <><strong>Favoritos</strong>: a estrela na biblioteca deixa seus exercícios preferidos sempre à mão.</>,
      <><strong>Compartilhar rotina</strong>: gere um link e mande para um amigo — ele copia a ficha para a conta dele.</>,
      <><strong>Seus dados</strong>: em Configurações dá para exportar tudo em CSV ou JSON, e importar do Strong e do Hevy.</>,
    ],
  },
];

export default function Ajuda() {
  const [aberto, setAberto] = useState<string | null>(TUTORIAIS[0].id);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold">Como usar</h1>
        <p className="mt-1 text-texto-suave">
          Tutoriais curtos para tirar o máximo do app. Leva uns 5 minutos no total.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-2">
        <Link to="/app/rotinas/nova">
          <Botao larguraTotal icone={<Dumbbell size={18} />}>
            Criar minha rotina
          </Botao>
        </Link>
        <Link to="/app/treino">
          <Botao variante="secundario" larguraTotal icone={<Play size={18} />}>
            Treino livre
          </Botao>
        </Link>
      </section>

      <section className="flex flex-col gap-2.5">
        {TUTORIAIS.map((tutorial) => {
          const expandido = aberto === tutorial.id;
          return (
            <Cartao key={tutorial.id} className="p-0 overflow-hidden">
              <button
                onClick={() => setAberto(expandido ? null : tutorial.id)}
                aria-expanded={expandido}
                className="flex w-full items-start gap-3 p-4 text-left"
              >
                <tutorial.icone size={22} className="mt-0.5 shrink-0 text-primaria" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{tutorial.titulo}</span>
                  <span className="block text-sm text-texto-suave">{tutorial.resumo}</span>
                </span>
                <ChevronDown
                  size={20}
                  className={`shrink-0 text-texto-suave transition-transform ${expandido ? 'rotate-180' : ''}`}
                  aria-hidden
                />
              </button>

              {expandido && (
                <div className="border-t border-borda px-4 py-4">
                  <ol className="flex flex-col gap-3">
                    {tutorial.passos.map((passo, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primaria/15 text-xs font-bold text-primaria">
                          {i + 1}
                        </span>
                        <span className="text-[15px] leading-relaxed text-texto-suave">{passo}</span>
                      </li>
                    ))}
                  </ol>

                  {tutorial.dica && (
                    <p className="mt-3 rounded-xl border border-primaria/30 bg-primaria/10 px-3 py-2 text-sm text-texto-suave">
                      💡 {tutorial.dica}
                    </p>
                  )}
                </div>
              )}
            </Cartao>
          );
        })}
      </section>

      <section>
        <TituloSecao titulo="Atalhos" />
        <div className="grid grid-cols-2 gap-2">
          <Link to="/app/exercicios">
            <Botao variante="secundario" larguraTotal icone={<BookOpen size={18} />}>
              Exercícios
            </Botao>
          </Link>
          <Link to="/app/ferramentas">
            <Botao variante="secundario" larguraTotal icone={<Calculator size={18} />}>
              Calculadoras
            </Botao>
          </Link>
          <Link to="/app/medidas">
            <Botao variante="secundario" larguraTotal icone={<Ruler size={18} />}>
              Medidas
            </Botao>
          </Link>
          <Link to="/app/metas">
            <Botao variante="secundario" larguraTotal icone={<Target size={18} />}>
              Metas
            </Botao>
          </Link>
          <Link to="/app/grupos">
            <Botao variante="secundario" larguraTotal icone={<UsersRound size={18} />}>
              Grupos
            </Botao>
          </Link>
          <Link to="/app/amigos">
            <Botao variante="secundario" larguraTotal icone={<Users size={18} />}>
              Amigos
            </Botao>
          </Link>
        </div>
      </section>

      <p className="flex items-center justify-center gap-2 text-center text-sm text-texto-suave">
        <Smartphone size={15} aria-hidden />
        Dica: instale o app pelo menu do navegador para abrir em tela cheia.
      </p>
    </div>
  );
}
