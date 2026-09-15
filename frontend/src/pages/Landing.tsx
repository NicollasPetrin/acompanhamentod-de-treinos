import { Link } from 'react-router-dom';
import {
  BarChart3, CalendarCheck, Dumbbell, LineChart, ListChecks, Ruler, Smartphone, Target, Timer, Trophy, WifiOff,
} from 'lucide-react';
import { Botao } from '../components/ui';

const RECURSOS = [
  {
    icone: ListChecks,
    titulo: 'Rotinas do seu jeito',
    texto: 'Monte fichas ABC, Push/Pull/Legs, Upper/Lower ou comece do zero. Séries, faixa de repetições, descanso e técnicas como superset e drop set.',
  },
  {
    icone: Timer,
    titulo: 'Registro rápido na academia',
    texto: 'As séries já vêm preenchidas com os valores da última vez. Um toque marca a série e dispara o cronômetro de descanso.',
  },
  {
    icone: Trophy,
    titulo: 'Recordes na hora',
    texto: 'Ao concluir a série você vê na hora se bateu recorde de carga, repetições, volume ou 1RM estimado.',
  },
  {
    icone: LineChart,
    titulo: 'Evolução em gráficos',
    texto: 'Carga por exercício, volume semanal, frequência e distribuição por grupo muscular para achar desequilíbrios.',
  },
  {
    icone: Ruler,
    titulo: 'Medidas e fotos',
    texto: 'Peso, percentual de gordura, braço, cintura, coxa… com gráficos de evolução e comparação de fotos lado a lado.',
  },
  {
    icone: Target,
    titulo: 'Metas que se atualizam sozinhas',
    texto: '"Supino 100 kg até dezembro" ou "treinar 4x por semana": a barra de progresso acompanha seus registros.',
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-fundo">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2 text-lg font-bold">
          <Dumbbell className="text-primaria" aria-hidden />
          Treinos
        </div>
        <div className="flex items-center gap-2">
          <Link to="/entrar">
            <Botao variante="fantasma" tamanho="sm">
              Entrar
            </Botao>
          </Link>
          <Link to="/cadastrar">
            <Botao tamanho="sm">Criar conta</Botao>
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-5xl px-4 pb-16 pt-8 text-center sm:pt-16">
          <span className="inline-flex items-center gap-2 rounded-full border border-primaria/30 bg-primaria/10 px-3 py-1 text-xs font-medium text-primaria">
            <Smartphone size={14} aria-hidden />
            Feito para usar com uma mão, no meio do treino
          </span>

          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
            Registre seus treinos.<br />
            <span className="text-primaria">Veja a evolução.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-lg text-texto-suave">
            Monte suas rotinas, anote cada série em segundos e acompanhe cargas, volume e recordes
            pessoais ao longo do tempo — mesmo sem internet na academia.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/cadastrar" className="w-full sm:w-auto">
              <Botao tamanho="lg" larguraTotal icone={<Dumbbell size={20} />}>
                Começar de graça
              </Botao>
            </Link>
            <Link to="/entrar" className="w-full sm:w-auto">
              <Botao tamanho="lg" variante="secundario" larguraTotal>
                Já tenho conta
              </Botao>
            </Link>
          </div>

          <p className="mt-4 text-sm text-texto-suave">
            Quer experimentar antes? Use a conta de demonstração:{' '}
            <strong className="text-texto">demo@treinos.app</strong> / <strong className="text-texto">Demo1234</strong>
          </p>
        </section>

        <section className="border-y border-borda bg-superficie/50 py-14">
          <div className="mx-auto grid max-w-5xl gap-4 px-4 sm:grid-cols-2 lg:grid-cols-3">
            {RECURSOS.map((recurso) => (
              <article key={recurso.titulo} className="cartao p-5">
                <recurso.icone className="text-primaria" size={26} aria-hidden />
                <h2 className="mt-3 text-lg font-semibold">{recurso.titulo}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-texto-suave">{recurso.texto}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-14">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icone: WifiOff, titulo: 'Funciona offline', texto: 'Registre o treino sem sinal; sincroniza sozinho quando a conexão volta.' },
              { icone: CalendarCheck, titulo: 'Histórico completo', texto: 'Calendário com os dias treinados e o detalhe de cada sessão.' },
              { icone: BarChart3, titulo: 'Dados seus', texto: 'Exporte tudo em CSV ou JSON quando quiser. Importe do Strong e do Hevy.' },
            ].map((item) => (
              <div key={item.titulo} className="flex gap-3">
                <item.icone className="mt-0.5 shrink-0 text-primaria" size={22} aria-hidden />
                <div>
                  <h3 className="font-semibold">{item.titulo}</h3>
                  <p className="mt-1 text-sm text-texto-suave">{item.texto}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="cartao mt-12 flex flex-col items-center gap-4 p-8 text-center">
            <h2 className="text-2xl font-bold">Pronto para o próximo treino?</h2>
            <p className="max-w-md text-texto-suave">
              Crie sua conta em menos de um minuto e comece pela rotina que já vem pronta.
            </p>
            <Link to="/cadastrar">
              <Botao tamanho="lg">Criar minha conta</Botao>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-borda px-4 py-8 text-center text-sm text-texto-suave">
        <p>Treinos — acompanhamento de treinos de academia.</p>
        <p className="mt-1">
          Instale no celular pelo menu do navegador (&quot;Adicionar à tela de início&quot;) e use como aplicativo.
        </p>
      </footer>
    </div>
  );
}
