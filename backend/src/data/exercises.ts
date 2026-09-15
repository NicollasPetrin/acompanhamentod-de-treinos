/**
 * Banco de exercícios global (seed). Cada item vira uma linha em `exercises`
 * com `createdById = null`, ou seja, visível para todos os usuários.
 *
 * Tupla: [nome, grupoMuscular, gruposSecundarios, equipamento, tipo, instruções, unilateral?]
 */
export type GrupoMuscular =
  | 'peito'
  | 'costas'
  | 'ombros'
  | 'biceps'
  | 'triceps'
  | 'antebraco'
  | 'quadriceps'
  | 'posterior'
  | 'gluteos'
  | 'panturrilha'
  | 'abdomen'
  | 'corpo_todo'
  | 'cardio';

export type Equipamento =
  | 'barra'
  | 'halter'
  | 'maquina'
  | 'cabo'
  | 'peso_corporal'
  | 'kettlebell'
  | 'elastico'
  | 'outro';

export type TipoExercicio = 'forca' | 'cardio' | 'alongamento' | 'mobilidade';

type Linha = [
  nome: string,
  grupo: GrupoMuscular,
  secundarios: GrupoMuscular[],
  equipamento: Equipamento,
  tipo: TipoExercicio,
  instrucoes: string,
  unilateral?: boolean,
];

export interface ExercicioSeed {
  name: string;
  muscleGroup: GrupoMuscular;
  secondaryMuscles: GrupoMuscular[];
  equipment: Equipamento;
  type: TipoExercicio;
  instructions: string;
  isUnilateral: boolean;
}

const LINHAS: Linha[] = [
  // ----------------------------------------------------------------- PEITO
  ['Supino reto com barra', 'peito', ['triceps', 'ombros'], 'barra', 'forca', 'Deitado no banco, pegada um pouco mais aberta que os ombros. Desça a barra controlada até a linha do mamilo, encostando de leve, e empurre até estender os cotovelos sem travar.'],
  ['Supino inclinado com barra', 'peito', ['ombros', 'triceps'], 'barra', 'forca', 'Banco a 30–45°. Desça a barra até a parte alta do peito e empurre para cima, mantendo os ombros presos no banco.'],
  ['Supino declinado com barra', 'peito', ['triceps'], 'barra', 'forca', 'Banco declinado, prenda os pés. Desça a barra até a parte baixa do peito e empurre, focando na porção inferior do peitoral.'],
  ['Supino reto com halteres', 'peito', ['triceps', 'ombros'], 'halter', 'forca', 'Halteres na linha do peito, palmas para frente. Desça até sentir alongamento e suba unindo levemente os halteres no topo.'],
  ['Supino inclinado com halteres', 'peito', ['ombros', 'triceps'], 'halter', 'forca', 'Banco a 30–45°. Desça os halteres ao lado do peito alto, cotovelos a ~45° do tronco, e empurre para cima.'],
  ['Supino declinado com halteres', 'peito', ['triceps'], 'halter', 'forca', 'Banco declinado. Controle a descida até a parte baixa do peito e empurre sem deixar os halteres se afastarem do corpo.'],
  ['Crucifixo reto com halteres', 'peito', ['ombros'], 'halter', 'forca', 'Cotovelos levemente flexionados e fixos. Abra os braços em arco até a altura do peito e volte contraindo o peitoral.'],
  ['Crucifixo inclinado com halteres', 'peito', ['ombros'], 'halter', 'forca', 'Mesmo movimento do crucifixo, com o banco a 30–45°, enfatizando a porção superior do peitoral.'],
  ['Crossover no cabo', 'peito', ['ombros'], 'cabo', 'forca', 'Polias altas, um pé à frente. Traga as mãos à frente do corpo em arco, cruzando levemente, e volte controlando.'],
  ['Crossover baixo no cabo', 'peito', ['ombros'], 'cabo', 'forca', 'Polias baixas. Suba as mãos em diagonal até a altura do peito, contraindo a parte superior do peitoral.'],
  ['Voador (peck deck)', 'peito', ['ombros'], 'maquina', 'forca', 'Costas apoiadas, cotovelos na altura dos ombros. Junte os braços à frente e volte devagar até sentir o alongamento.'],
  ['Supino na máquina', 'peito', ['triceps', 'ombros'], 'maquina', 'forca', 'Ajuste o banco para as manoplas ficarem na linha do peito. Empurre à frente e volte controlando sem bater o peso.'],
  ['Flexão de braço', 'peito', ['triceps', 'abdomen'], 'peso_corporal', 'forca', 'Mãos na largura dos ombros, corpo alinhado. Desça até o peito quase tocar o chão e empurre mantendo o abdômen firme.'],
  ['Flexão de braço inclinada', 'peito', ['triceps'], 'peso_corporal', 'forca', 'Mãos apoiadas em um banco. Versão mais fácil da flexão, ideal para iniciantes ou séries de alto volume.'],
  ['Flexão de braço declinada', 'peito', ['ombros', 'triceps'], 'peso_corporal', 'forca', 'Pés elevados no banco. Aumenta a carga sobre a porção superior do peitoral e os ombros.'],
  ['Mergulho em paralelas (peito)', 'peito', ['triceps', 'ombros'], 'peso_corporal', 'forca', 'Tronco inclinado à frente e cotovelos abertos. Desça até os ombros ficarem na linha dos cotovelos e empurre.'],
  ['Pullover com halter', 'peito', ['costas', 'triceps'], 'halter', 'forca', 'Deitado no banco, segure um halter com as duas mãos. Leve os braços para trás da cabeça em arco e volte contraindo peito e dorsais.'],

  // ---------------------------------------------------------------- COSTAS
  ['Barra fixa (pegada pronada)', 'costas', ['biceps', 'antebraco'], 'peso_corporal', 'forca', 'Pegada aberta, palmas para frente. Puxe até o queixo passar da barra levando os cotovelos para baixo e para trás.'],
  ['Barra fixa (pegada supinada)', 'costas', ['biceps'], 'peso_corporal', 'forca', 'Palmas voltadas para você, pegada na largura dos ombros. Maior participação do bíceps.'],
  ['Barra fixa neutra', 'costas', ['biceps', 'antebraco'], 'peso_corporal', 'forca', 'Pegada paralela. Puxe o peito em direção às mãos mantendo os ombros para baixo.'],
  ['Puxada frente na polia', 'costas', ['biceps'], 'cabo', 'forca', 'Sentado, pegada aberta. Puxe a barra até a parte alta do peito inclinando levemente o tronco; volte controlando.'],
  ['Puxada supinada na polia', 'costas', ['biceps'], 'cabo', 'forca', 'Pegada supinada na largura dos ombros. Puxe até o peito, mantendo os cotovelos junto ao corpo.'],
  ['Puxada triângulo (neutra)', 'costas', ['biceps'], 'cabo', 'forca', 'Com o triângulo, puxe até o peito mantendo o tronco estável. Ótimo para foco em dorsais.'],
  ['Remada curvada com barra', 'costas', ['biceps', 'posterior'], 'barra', 'forca', 'Tronco inclinado ~45°, coluna neutra. Puxe a barra até o abdômen e volte sem arredondar as costas.'],
  ['Remada curvada supinada', 'costas', ['biceps'], 'barra', 'forca', 'Pegada supinada, cotovelos rentes ao corpo. Puxe até o umbigo, contraindo as escápulas.'],
  ['Remada cavalinho (T-bar)', 'costas', ['biceps'], 'maquina', 'forca', 'Peito apoiado ou barra no canto do rack. Puxe até o tronco e segure meio segundo na contração.'],
  ['Remada unilateral com halter', 'costas', ['biceps'], 'halter', 'forca', 'Joelho e mão apoiados no banco. Puxe o halter até o quadril levando o cotovelo para trás.', true],
  ['Remada sentada na polia', 'costas', ['biceps', 'posterior'], 'cabo', 'forca', 'Costas eretas, joelhos semiflexionados. Puxe o triângulo até o abdômen juntando as escápulas.'],
  ['Remada baixa unilateral na polia', 'costas', ['biceps'], 'cabo', 'forca', 'Puxe a manopla até o quadril de um lado só, permitindo mais amplitude na escápula.', true],
  ['Remada máquina', 'costas', ['biceps'], 'maquina', 'forca', 'Peito apoiado no suporte. Puxe as manoplas para trás e controle a volta.'],
  ['Pulldown com braços estendidos', 'costas', ['triceps', 'abdomen'], 'cabo', 'forca', 'Em pé, braços quase retos. Empurre a barra da altura do rosto até as coxas usando as dorsais.'],
  ['Levantamento terra convencional', 'costas', ['posterior', 'gluteos', 'antebraco'], 'barra', 'forca', 'Barra junto à canela, coluna neutra. Estenda quadril e joelhos ao mesmo tempo, terminando em pé sem hiperextensão.'],
  ['Levantamento terra sumô', 'costas', ['quadriceps', 'gluteos'], 'barra', 'forca', 'Pés bem afastados, mãos por dentro das pernas. Empurre o chão mantendo o peito alto.'],
  ['Encolhimento com barra', 'costas', ['antebraco'], 'barra', 'forca', 'Braços estendidos, suba os ombros em direção às orelhas e segure a contração no topo.'],
  ['Encolhimento com halteres', 'costas', ['antebraco'], 'halter', 'forca', 'Mesmo movimento do encolhimento com barra, com maior amplitude por lado.'],
  ['Face pull', 'costas', ['ombros'], 'cabo', 'forca', 'Corda na altura do rosto. Puxe separando as mãos e girando os ombros para fora — excelente para a saúde do manguito.'],
  ['Hiperextensão lombar', 'costas', ['gluteos', 'posterior'], 'maquina', 'forca', 'Na cadeira romana, desça o tronco controlado e suba até alinhar com as pernas, sem hiperestender.'],
  ['Good morning', 'costas', ['posterior', 'gluteos'], 'barra', 'forca', 'Barra nas costas, joelhos levemente flexionados. Leve o quadril para trás descendo o tronco e volte com a lombar neutra.'],

  // ---------------------------------------------------------------- OMBROS
  ['Desenvolvimento militar com barra', 'ombros', ['triceps'], 'barra', 'forca', 'Em pé ou sentado, barra na altura das clavículas. Empurre acima da cabeça sem arquear a lombar.'],
  ['Desenvolvimento com halteres', 'ombros', ['triceps'], 'halter', 'forca', 'Halteres na altura das orelhas, cotovelos levemente à frente. Empurre até quase estender e volte controlando.'],
  ['Desenvolvimento Arnold', 'ombros', ['triceps'], 'halter', 'forca', 'Comece com as palmas voltadas para você e gire os punhos durante a subida, recrutando as três porções do deltoide.'],
  ['Desenvolvimento na máquina', 'ombros', ['triceps'], 'maquina', 'forca', 'Costas apoiadas, manoplas na altura dos ombros. Empurre para cima sem travar os cotovelos.'],
  ['Elevação lateral com halteres', 'ombros', [], 'halter', 'forca', 'Cotovelos levemente flexionados. Suba os braços até a linha dos ombros liderando com os cotovelos, sem impulso.'],
  ['Elevação lateral na polia', 'ombros', [], 'cabo', 'forca', 'Polia baixa, um braço por vez. Tensão constante em toda a amplitude.', true],
  ['Elevação lateral na máquina', 'ombros', [], 'maquina', 'forca', 'Ajuste o assento para o eixo do ombro. Suba até a linha dos ombros e desça devagar.'],
  ['Elevação frontal com halteres', 'ombros', ['peito'], 'halter', 'forca', 'Suba os braços à frente até a altura dos olhos, alternando ou juntos, sem balançar o tronco.'],
  ['Elevação frontal com anilha', 'ombros', [], 'outro', 'forca', 'Segure a anilha pelas laterais e suba à frente até a altura dos olhos.'],
  ['Crucifixo inverso com halteres', 'ombros', ['costas'], 'halter', 'forca', 'Tronco inclinado à frente. Abra os braços em arco até a linha dos ombros, contraindo o deltoide posterior.'],
  ['Crucifixo inverso na máquina', 'ombros', ['costas'], 'maquina', 'forca', 'Peito apoiado. Abra os braços para trás e volte controlando sem usar impulso.'],
  ['Remada alta com barra', 'ombros', ['costas'], 'barra', 'forca', 'Pegada na largura dos ombros. Puxe a barra até a altura do peito liderando com os cotovelos.'],
  ['Remada alta na polia', 'ombros', ['costas'], 'cabo', 'forca', 'Com corda ou barra na polia baixa, puxe até o peito mantendo os cotovelos altos.'],
  ['Desenvolvimento com kettlebell', 'ombros', ['triceps', 'abdomen'], 'kettlebell', 'forca', 'Kettlebell apoiado no antebraço, na posição rack. Empurre acima da cabeça mantendo o core firme.', true],
  ['Elevação lateral com elástico', 'ombros', [], 'elastico', 'forca', 'Pise no elástico e abra os braços até a linha dos ombros — ótimo para aquecimento.'],
  ['Rotação externa com elástico', 'ombros', [], 'elastico', 'mobilidade', 'Cotovelo junto ao corpo a 90°. Gire o antebraço para fora, fortalecendo o manguito rotador.', true],
  ['Desenvolvimento por trás da nuca', 'ombros', ['triceps'], 'barra', 'forca', 'Movimento avançado: exige boa mobilidade. Desça a barra até a nuca com controle e empurre.'],

  // ---------------------------------------------------------------- BÍCEPS
  ['Rosca direta com barra', 'biceps', ['antebraco'], 'barra', 'forca', 'Cotovelos junto ao corpo. Suba a barra sem balançar o tronco e desça controlando até quase estender.'],
  ['Rosca direta com barra W', 'biceps', ['antebraco'], 'barra', 'forca', 'A barra W reduz o estresse nos punhos. Mesma execução da rosca direta.'],
  ['Rosca alternada com halteres', 'biceps', ['antebraco'], 'halter', 'forca', 'Suba um halter por vez girando o punho (supinação) durante a subida.', true],
  ['Rosca martelo', 'biceps', ['antebraco'], 'halter', 'forca', 'Pegada neutra (polegar para cima). Ênfase no braquial e no braquiorradial.'],
  ['Rosca concentrada', 'biceps', [], 'halter', 'forca', 'Sentado, cotovelo apoiado na parte interna da coxa. Suba com controle e contraia no topo.', true],
  ['Rosca Scott com barra W', 'biceps', [], 'barra', 'forca', 'No banco Scott, braços totalmente apoiados. Desça até quase estender e suba sem tirar os cotovelos do apoio.'],
  ['Rosca Scott na máquina', 'biceps', [], 'maquina', 'forca', 'Ajuste o assento para o cotovelo alinhar com o eixo. Amplitude completa e volta lenta.'],
  ['Rosca inversa', 'biceps', ['antebraco'], 'barra', 'forca', 'Pegada pronada. Trabalha bíceps e antebraços; use cargas menores.'],
  ['Rosca na polia baixa', 'biceps', ['antebraco'], 'cabo', 'forca', 'Tensão constante do início ao fim. Mantenha os cotovelos fixos ao lado do tronco.'],
  ['Rosca no cabo com corda', 'biceps', ['antebraco'], 'cabo', 'forca', 'Pegada neutra na corda, gire levemente os punhos para fora no topo.'],
  ['Rosca 21', 'biceps', [], 'barra', 'forca', 'Sete repetições na metade baixa, sete na metade alta e sete completas, sem descanso.'],
  ['Rosca inclinada com halteres', 'biceps', [], 'halter', 'forca', 'Banco a 45°, braços pendurados. Maior alongamento da porção longa do bíceps.'],
  ['Rosca com elástico', 'biceps', ['antebraco'], 'elastico', 'forca', 'Pise no elástico e faça a rosca — resistência progressiva, boa para treinar em casa.'],

  // --------------------------------------------------------------- TRÍCEPS
  ['Tríceps na polia com barra', 'triceps', [], 'cabo', 'forca', 'Cotovelos junto ao corpo. Estenda os braços até embaixo e volte até 90° sem abrir os cotovelos.'],
  ['Tríceps na polia com corda', 'triceps', [], 'cabo', 'forca', 'Ao final da extensão, separe as pontas da corda para aumentar a contração.'],
  ['Tríceps testa com barra W', 'triceps', [], 'barra', 'forca', 'Deitado, desça a barra até a testa flexionando só os cotovelos e estenda de volta.'],
  ['Tríceps testa com halteres', 'triceps', [], 'halter', 'forca', 'Mesma execução da testa com barra, permitindo pegada neutra e mais conforto nos cotovelos.'],
  ['Tríceps francês unilateral', 'triceps', [], 'halter', 'forca', 'Halter acima da cabeça, cotovelo apontando ao teto. Desça atrás da cabeça e estenda.', true],
  ['Tríceps francês com barra', 'triceps', [], 'barra', 'forca', 'Sentado, barra acima da cabeça. Desça atrás da nuca e estenda mantendo os cotovelos parados.'],
  ['Tríceps coice com halter', 'triceps', [], 'halter', 'forca', 'Tronco inclinado, braço colado ao corpo. Estenda o cotovelo para trás e segure a contração.', true],
  ['Tríceps banco', 'triceps', ['ombros'], 'peso_corporal', 'forca', 'Mãos no banco atrás do corpo. Desça flexionando os cotovelos a 90° e empurre de volta.'],
  ['Mergulho em paralelas (tríceps)', 'triceps', ['peito', 'ombros'], 'peso_corporal', 'forca', 'Tronco ereto e cotovelos rentes ao corpo para focar no tríceps.'],
  ['Supino fechado', 'triceps', ['peito', 'ombros'], 'barra', 'forca', 'Pegada na largura dos ombros, cotovelos junto ao tronco. Desça até o peito e empurre.'],
  ['Tríceps na máquina', 'triceps', [], 'maquina', 'forca', 'Ajuste o assento, cotovelos apoiados. Estenda os braços e volte devagar.'],
  ['Extensão de tríceps acima da cabeça na polia', 'triceps', [], 'cabo', 'forca', 'De costas para a polia, corda acima da cabeça. Estende os braços à frente — ótimo alongamento da porção longa.'],
  ['Tríceps com elástico', 'triceps', [], 'elastico', 'forca', 'Prenda o elástico em um ponto alto e faça a extensão dos cotovelos.'],

  // ----------------------------------------------------------- QUADRÍCEPS
  ['Agachamento livre com barra', 'quadriceps', ['gluteos', 'posterior', 'abdomen'], 'barra', 'forca', 'Barra no trapézio, pés na largura dos ombros. Desça até a coxa ficar paralela (ou além) mantendo joelhos alinhados aos pés.'],
  ['Agachamento frontal', 'quadriceps', ['abdomen', 'gluteos'], 'barra', 'forca', 'Barra apoiada nos deltoides frontais, cotovelos altos. Tronco mais ereto e maior ênfase no quadríceps.'],
  ['Agachamento no Smith', 'quadriceps', ['gluteos'], 'maquina', 'forca', 'Pés levemente à frente. A guia dá estabilidade para focar na amplitude.'],
  ['Agachamento búlgaro', 'quadriceps', ['gluteos', 'posterior'], 'halter', 'forca', 'Pé de trás apoiado no banco. Desça até o joelho de trás quase tocar o chão.', true],
  ['Agachamento goblet', 'quadriceps', ['gluteos', 'abdomen'], 'halter', 'forca', 'Segure o halter junto ao peito. Ótimo para aprender o padrão do agachamento.'],
  ['Agachamento hack', 'quadriceps', ['gluteos'], 'maquina', 'forca', 'Costas apoiadas no carrinho. Desça controlado e empurre com o meio do pé.'],
  ['Leg press 45°', 'quadriceps', ['gluteos', 'posterior'], 'maquina', 'forca', 'Pés na largura dos ombros na plataforma. Desça até 90° sem tirar o quadril do apoio e empurre sem travar os joelhos.'],
  ['Leg press horizontal', 'quadriceps', ['gluteos'], 'maquina', 'forca', 'Sentado, empurre a plataforma mantendo a lombar apoiada.'],
  ['Cadeira extensora', 'quadriceps', [], 'maquina', 'forca', 'Estenda os joelhos até quase travar, segure um instante e desça controlando.'],
  ['Afundo com halteres', 'quadriceps', ['gluteos'], 'halter', 'forca', 'Dê um passo à frente e desça até o joelho de trás quase tocar o chão. Volte empurrando com o calcanhar da frente.', true],
  ['Afundo caminhando', 'quadriceps', ['gluteos', 'posterior'], 'halter', 'forca', 'Alterne as pernas avançando pela sala, mantendo o tronco ereto.', true],
  ['Passada no Smith', 'quadriceps', ['gluteos'], 'maquina', 'forca', 'Passada estática com a barra guiada, facilitando o equilíbrio.', true],
  ['Agachamento sumô com halter', 'quadriceps', ['gluteos', 'posterior'], 'halter', 'forca', 'Pés bem afastados e pontas para fora. Desça entre as pernas segurando o halter.'],
  ['Agachamento livre sem peso', 'quadriceps', ['gluteos'], 'peso_corporal', 'forca', 'Ideal para aquecimento e iniciantes. Desça controlando, peito aberto.'],
  ['Sissy squat', 'quadriceps', [], 'peso_corporal', 'forca', 'Joelhos à frente e quadril estendido — alongamento intenso do reto femoral. Avance devagar.'],
  ['Step-up no banco', 'quadriceps', ['gluteos'], 'halter', 'forca', 'Suba no banco com uma perna empurrando com o calcanhar e desça controlando.', true],

  // --------------------------------------------------- POSTERIOR E GLÚTEOS
  ['Stiff com barra', 'posterior', ['gluteos', 'costas'], 'barra', 'forca', 'Joelhos levemente flexionados, leve o quadril para trás descendo a barra rente às pernas até sentir o alongamento.'],
  ['Stiff com halteres', 'posterior', ['gluteos'], 'halter', 'forca', 'Mesma execução do stiff com barra, com halteres ao lado das pernas.'],
  ['Levantamento terra romeno', 'posterior', ['gluteos', 'costas'], 'barra', 'forca', 'Descida controlada com quadril para trás, barra colada ao corpo, subida contraindo os glúteos.'],
  ['Mesa flexora', 'posterior', ['panturrilha'], 'maquina', 'forca', 'Deitado, flexione os joelhos levando os calcanhares aos glúteos sem tirar o quadril do apoio.'],
  ['Cadeira flexora sentada', 'posterior', [], 'maquina', 'forca', 'Sentado, flexione os joelhos e segure a contração por um segundo.'],
  ['Flexora em pé', 'posterior', [], 'maquina', 'forca', 'Uma perna por vez, flexione o joelho levando o calcanhar ao glúteo.', true],
  ['Elevação pélvica (hip thrust)', 'gluteos', ['posterior'], 'barra', 'forca', 'Costas apoiadas no banco, barra sobre o quadril. Suba até alinhar tronco e coxas e contraia os glúteos no topo.'],
  ['Ponte de glúteo', 'gluteos', ['posterior'], 'peso_corporal', 'forca', 'Deitado, pés no chão. Suba o quadril contraindo os glúteos e desça sem encostar totalmente.'],
  ['Coice na polia', 'gluteos', ['posterior'], 'cabo', 'forca', 'Tornozeleira presa na polia baixa. Leve a perna para trás estendendo o quadril.', true],
  ['Abdução de quadril na máquina', 'gluteos', [], 'maquina', 'forca', 'Sentado, abra as pernas contra a resistência e volte devagar.'],
  ['Adução de quadril na máquina', 'quadriceps', ['gluteos'], 'maquina', 'forca', 'Feche as pernas contra a resistência, controlando a volta.'],
  ['Abdução de quadril com elástico', 'gluteos', [], 'elastico', 'forca', 'Elástico acima dos joelhos. Caminhe lateralmente ou faça aberturas — ótimo para ativação.'],
  ['Cadeira abdutora com inclinação', 'gluteos', [], 'maquina', 'forca', 'Incline o tronco à frente na abdutora para enfatizar o glúteo médio.'],
  ['Bom dia com kettlebell', 'posterior', ['gluteos', 'costas'], 'kettlebell', 'forca', 'Kettlebell junto ao peito, quadril para trás com coluna neutra.'],
  ['Swing com kettlebell', 'gluteos', ['posterior', 'costas', 'abdomen'], 'kettlebell', 'forca', 'Movimento explosivo de quadril: o kettlebell sobe pela força do quadril, não dos braços.'],
  ['Nordic curl', 'posterior', ['gluteos'], 'peso_corporal', 'forca', 'Pés presos, desça o tronco à frente freando com os isquiotibiais. Exercício avançado.'],

  // ----------------------------------------------------------- PANTURRILHA
  ['Panturrilha em pé na máquina', 'panturrilha', [], 'maquina', 'forca', 'Suba na ponta dos pés ao máximo e desça até alongar bem, sem quicar.'],
  ['Panturrilha sentado', 'panturrilha', [], 'maquina', 'forca', 'Joelhos flexionados enfatizam o sóleo. Amplitude completa e pausa no topo.'],
  ['Panturrilha no leg press', 'panturrilha', [], 'maquina', 'forca', 'Apoie as pontas dos pés na base da plataforma e empurre com os tornozelos.'],
  ['Panturrilha unilateral com halter', 'panturrilha', [], 'halter', 'forca', 'Uma perna por vez, apoiado em um degrau para maior amplitude.', true],
  ['Panturrilha no Smith', 'panturrilha', [], 'maquina', 'forca', 'Barra guiada nas costas e pés em um step. Controle a descida.'],
  ['Elevação de panturrilha no step', 'panturrilha', [], 'peso_corporal', 'forca', 'Só com o peso do corpo, em alto volume. Desça até alongar por completo.'],

  // --------------------------------------------------------------- ABDÔMEN
  ['Abdominal supra', 'abdomen', [], 'peso_corporal', 'forca', 'Deitado, suba o tronco encurtando a barriga sem puxar o pescoço.'],
  ['Abdominal infra (elevação de pernas)', 'abdomen', [], 'peso_corporal', 'forca', 'Deitado, suba as pernas retas e leve o quadril levemente do chão.'],
  ['Elevação de pernas na barra', 'abdomen', ['antebraco'], 'peso_corporal', 'forca', 'Pendurado na barra, suba as pernas até a altura do quadril sem balançar.'],
  ['Abdominal na polia (crunch ajoelhado)', 'abdomen', [], 'cabo', 'forca', 'Ajoelhado com a corda atrás da cabeça, flexione o tronco levando os cotovelos aos joelhos.'],
  ['Abdominal na máquina', 'abdomen', [], 'maquina', 'forca', 'Sentado, flexione o tronco contra a resistência e volte controlando.'],
  ['Prancha isométrica', 'abdomen', ['ombros'], 'peso_corporal', 'forca', 'Antebraços e pontas dos pés no chão, corpo alinhado. Segure o tempo alvo contraindo abdômen e glúteos.'],
  ['Prancha lateral', 'abdomen', ['ombros'], 'peso_corporal', 'forca', 'Apoio em um antebraço, quadril elevado e corpo alinhado.', true],
  ['Abdominal bicicleta', 'abdomen', [], 'peso_corporal', 'forca', 'Alterne cotovelo e joelho opostos em movimento contínuo e controlado.'],
  ['Abdominal remador', 'abdomen', ['quadriceps'], 'peso_corporal', 'forca', 'Suba tronco e pernas ao mesmo tempo, formando um V.'],
  ['Russian twist', 'abdomen', [], 'outro', 'forca', 'Sentado com o tronco inclinado, gire o tronco de um lado ao outro segurando um peso.'],
  ['Ab wheel (roda abdominal)', 'abdomen', ['ombros', 'costas'], 'outro', 'forca', 'Role a roda à frente mantendo o abdômen contraído e a lombar neutra. Avance a amplitude aos poucos.'],
  ['Mountain climber', 'abdomen', ['cardio'], 'peso_corporal', 'cardio', 'Na posição de prancha alta, leve os joelhos ao peito alternadamente em ritmo acelerado.'],
  ['Dead bug', 'abdomen', [], 'peso_corporal', 'mobilidade', 'Deitado, estenda braço e perna opostos mantendo a lombar colada no chão.'],
  ['Pallof press', 'abdomen', ['ombros'], 'cabo', 'forca', 'Em pé de lado para a polia, empurre a manopla à frente resistindo à rotação do tronco.', true],
  ['Prancha com elevação de braço', 'abdomen', ['ombros'], 'peso_corporal', 'forca', 'Na prancha, levante um braço por vez sem girar o quadril.'],
  ['Abdominal canivete', 'abdomen', ['quadriceps'], 'peso_corporal', 'forca', 'Deitado, suba tronco e pernas simultaneamente tocando as mãos nos pés.'],

  // ------------------------------------------------------------- ANTEBRAÇO
  ['Rosca de punho', 'antebraco', [], 'barra', 'forca', 'Antebraços apoiados, flexione os punhos para cima com amplitude total.'],
  ['Rosca de punho inversa', 'antebraco', [], 'barra', 'forca', 'Pegada pronada, estenda os punhos para cima. Trabalha os extensores.'],
  ['Farmer walk', 'antebraco', ['corpo_todo'], 'halter', 'forca', 'Caminhe segurando halteres pesados, ombros para trás e abdômen firme.'],
  ['Pegada morta na barra', 'antebraco', ['costas'], 'peso_corporal', 'forca', 'Fique pendurado na barra o máximo de tempo possível para fortalecer a pegada.'],
  ['Rolagem de punho com corda', 'antebraco', [], 'outro', 'forca', 'Enrole a corda com um peso na ponta girando o bastão com os punhos.'],
  ['Rosca martelo na polia', 'antebraco', ['biceps'], 'cabo', 'forca', 'Com corda, pegada neutra e cotovelos fixos.'],

  // ------------------------------------------------------- CORPO TODO / LPO
  ['Clean (levantamento olímpico)', 'corpo_todo', ['costas', 'quadriceps', 'ombros'], 'barra', 'forca', 'Puxada explosiva do chão até a posição de rack nos ombros. Técnica antes de carga.'],
  ['Power clean', 'corpo_todo', ['costas', 'quadriceps'], 'barra', 'forca', 'Versão do clean recebida com quadril acima do paralelo, focada em potência.'],
  ['Snatch', 'corpo_todo', ['ombros', 'costas'], 'barra', 'forca', 'Do chão até acima da cabeça em um movimento só, com pegada bem aberta.'],
  ['Thruster', 'corpo_todo', ['quadriceps', 'ombros'], 'barra', 'forca', 'Agachamento frontal seguido de desenvolvimento em um movimento contínuo.'],
  ['Burpee', 'corpo_todo', ['cardio', 'peito'], 'peso_corporal', 'cardio', 'Agache, jogue os pés para trás, faça uma flexão, volte e salte com as mãos acima da cabeça.'],
  ['Clean and press', 'corpo_todo', ['ombros', 'costas'], 'barra', 'forca', 'Clean seguido de desenvolvimento acima da cabeça.'],
  ['Turkish get-up', 'corpo_todo', ['abdomen', 'ombros'], 'kettlebell', 'forca', 'Do chão até em pé segurando o kettlebell acima da cabeça, passo a passo.', true],
  ['Kettlebell clean', 'corpo_todo', ['costas', 'gluteos'], 'kettlebell', 'forca', 'Leve o kettlebell do chão à posição rack usando a extensão de quadril.', true],
  ['Wall ball', 'corpo_todo', ['quadriceps', 'ombros'], 'outro', 'cardio', 'Agache com a bola no peito e lance na parede no alvo alto, recebendo em novo agachamento.'],
  ['Battle rope', 'corpo_todo', ['ombros', 'cardio'], 'outro', 'cardio', 'Ondas alternadas ou simultâneas com as cordas, mantendo o tronco estável.'],

  // ----------------------------------------------------------------- CARDIO
  ['Esteira — caminhada', 'cardio', ['quadriceps'], 'maquina', 'cardio', 'Ritmo confortável, com ou sem inclinação. Ótimo para aquecimento e cardio de baixa intensidade.'],
  ['Esteira — corrida', 'cardio', ['quadriceps', 'panturrilha'], 'maquina', 'cardio', 'Corrida contínua no ritmo alvo. Controle passadas e respiração.'],
  ['Esteira — HIIT', 'cardio', ['quadriceps'], 'maquina', 'cardio', 'Alterne tiros intensos (20–40s) com recuperação ativa (60–90s).'],
  ['Bicicleta ergométrica', 'cardio', ['quadriceps'], 'maquina', 'cardio', 'Ajuste o selim na altura do quadril. Mantenha cadência constante.'],
  ['Bicicleta spinning', 'cardio', ['quadriceps', 'gluteos'], 'maquina', 'cardio', 'Trabalhe com variações de carga e cadência, em pé ou sentado.'],
  ['Elíptico', 'cardio', ['corpo_todo'], 'maquina', 'cardio', 'Movimento de baixo impacto envolvendo braços e pernas.'],
  ['Escada (simulador)', 'cardio', ['gluteos', 'quadriceps'], 'maquina', 'cardio', 'Suba em ritmo constante sem apoiar o peso do corpo nos braços.'],
  ['Remo ergômetro', 'cardio', ['costas', 'quadriceps'], 'maquina', 'cardio', 'Sequência: pernas, tronco, braços — e o inverso na volta.'],
  ['Pular corda', 'cardio', ['panturrilha'], 'outro', 'cardio', 'Saltos curtos na ponta dos pés, girando a corda com os punhos.'],
  ['Corrida ao ar livre', 'cardio', ['quadriceps', 'panturrilha'], 'peso_corporal', 'cardio', 'Registre tempo e distância percorrida.'],
  ['Caminhada ao ar livre', 'cardio', [], 'peso_corporal', 'cardio', 'Cardio leve para recuperação ativa e gasto calórico.'],
  ['Natação', 'cardio', ['corpo_todo'], 'outro', 'cardio', 'Cardio de baixo impacto que envolve o corpo inteiro.'],
  ['Sprint na bicicleta assault', 'cardio', ['corpo_todo'], 'maquina', 'cardio', 'Tiros de alta intensidade envolvendo braços e pernas.'],

  // ----------------------------------------------- ALONGAMENTO / MOBILIDADE
  ['Alongamento de peitoral na parede', 'peito', ['ombros'], 'peso_corporal', 'alongamento', 'Antebraço na parede a 90°, gire o tronco para o lado oposto e segure 30 segundos.', true],
  ['Alongamento de dorsal na barra', 'costas', [], 'peso_corporal', 'alongamento', 'Pendurado na barra, relaxe os ombros e deixe a coluna alongar.'],
  ['Alongamento de isquiotibiais sentado', 'posterior', [], 'peso_corporal', 'alongamento', 'Sentado com a perna estendida, incline o tronco à frente mantendo a coluna longa.'],
  ['Alongamento de quadríceps em pé', 'quadriceps', [], 'peso_corporal', 'alongamento', 'Segure o pé junto ao glúteo mantendo os joelhos alinhados.', true],
  ['Alongamento de glúteo deitado', 'gluteos', [], 'peso_corporal', 'alongamento', 'Deitado, cruze o tornozelo sobre o joelho oposto e puxe a coxa em direção ao peito.', true],
  ['Alongamento de panturrilha na parede', 'panturrilha', [], 'peso_corporal', 'alongamento', 'Perna de trás estendida e calcanhar no chão, empurre a parede.', true],
  ['Alongamento de tríceps', 'triceps', ['ombros'], 'peso_corporal', 'alongamento', 'Cotovelo apontando para cima atrás da cabeça, puxe com a outra mão.', true],
  ['Gato e camelo', 'costas', ['abdomen'], 'peso_corporal', 'mobilidade', 'Em quatro apoios, alterne flexão e extensão da coluna no ritmo da respiração.'],
  ['Mobilidade de quadril 90/90', 'gluteos', ['posterior'], 'peso_corporal', 'mobilidade', 'Sentado com joelhos a 90°, gire de um lado ao outro controlando o movimento.'],
  ['Mobilidade torácica deitado', 'costas', ['ombros'], 'peso_corporal', 'mobilidade', 'Deitado de lado com joelhos flexionados, abra o braço de cima acompanhando com o olhar.', true],
  ['Rotação de ombros com bastão', 'ombros', [], 'outro', 'mobilidade', 'Com pegada bem aberta no bastão, leve os braços da frente para trás da cabeça.'],
  ['Agachamento profundo (mobilidade)', 'quadriceps', ['gluteos'], 'peso_corporal', 'mobilidade', 'Permaneça na posição mais baixa do agachamento empurrando os joelhos com os cotovelos.'],
  ['Alongamento de flexores do quadril', 'quadriceps', ['gluteos'], 'peso_corporal', 'alongamento', 'Em posição de afundo com o joelho de trás no chão, empurre o quadril à frente.', true],
  ['Alongamento cervical lateral', 'costas', [], 'peso_corporal', 'alongamento', 'Incline a cabeça para o lado puxando levemente com a mão. Sem forçar.', true],
];

/** Lista final normalizada, pronta para o seed. */
export const EXERCICIOS_SEED: ExercicioSeed[] = LINHAS.map(
  ([name, muscleGroup, secondaryMuscles, equipment, type, instructions, isUnilateral]) => ({
    name,
    muscleGroup,
    secondaryMuscles,
    equipment,
    type,
    instructions,
    isUnilateral: Boolean(isUnilateral),
  }),
);

export const GRUPOS_MUSCULARES: { valor: GrupoMuscular; rotulo: string }[] = [
  { valor: 'peito', rotulo: 'Peito' },
  { valor: 'costas', rotulo: 'Costas' },
  { valor: 'ombros', rotulo: 'Ombros' },
  { valor: 'biceps', rotulo: 'Bíceps' },
  { valor: 'triceps', rotulo: 'Tríceps' },
  { valor: 'antebraco', rotulo: 'Antebraço' },
  { valor: 'quadriceps', rotulo: 'Quadríceps' },
  { valor: 'posterior', rotulo: 'Posterior de coxa' },
  { valor: 'gluteos', rotulo: 'Glúteos' },
  { valor: 'panturrilha', rotulo: 'Panturrilha' },
  { valor: 'abdomen', rotulo: 'Abdômen' },
  { valor: 'corpo_todo', rotulo: 'Corpo todo' },
  { valor: 'cardio', rotulo: 'Cardio' },
];

export const EQUIPAMENTOS: { valor: Equipamento; rotulo: string }[] = [
  { valor: 'barra', rotulo: 'Barra' },
  { valor: 'halter', rotulo: 'Halter' },
  { valor: 'maquina', rotulo: 'Máquina' },
  { valor: 'cabo', rotulo: 'Cabo/Polia' },
  { valor: 'peso_corporal', rotulo: 'Peso corporal' },
  { valor: 'kettlebell', rotulo: 'Kettlebell' },
  { valor: 'elastico', rotulo: 'Elástico' },
  { valor: 'outro', rotulo: 'Outro' },
];

export const TIPOS_EXERCICIO: { valor: TipoExercicio; rotulo: string }[] = [
  { valor: 'forca', rotulo: 'Força' },
  { valor: 'cardio', rotulo: 'Cardio' },
  { valor: 'alongamento', rotulo: 'Alongamento' },
  { valor: 'mobilidade', rotulo: 'Mobilidade' },
];
