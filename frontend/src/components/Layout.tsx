import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3, CalendarDays, Dumbbell, GraduationCap, Home, ListChecks, Menu, Play, Ruler,
  Settings, Target, Trophy, Calculator, CloudOff, RefreshCw, LogOut, BookOpen, Users, UserRound,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../lib/auth';
import { sincronizarPendentes, useStatusOffline } from '../lib/offline';
import { Modal, Botao } from './ui';
import { iniciarLembretes } from '../lib/lembretes';
import { useAvisos } from './Notificacoes';
import { urlDeMidia } from '../lib/api';

const PRINCIPAIS = [
  { para: '/app', rotulo: 'Início', icone: Home, fim: true },
  { para: '/app/rotinas', rotulo: 'Rotinas', icone: ListChecks, fim: false },
  { para: '/app/historico', rotulo: 'Histórico', icone: CalendarDays, fim: false },
  { para: '/app/progresso', rotulo: 'Progresso', icone: BarChart3, fim: false },
];

const SECUNDARIOS = [
  { para: '/app/ajuda', rotulo: 'Como usar o app', icone: GraduationCap },
  { para: '/app/grupos', rotulo: 'Grupos de treino', icone: Users },
  { para: '/app/amigos', rotulo: 'Amigos', icone: UserRound },
  { para: '/app/exercicios', rotulo: 'Biblioteca de exercícios', icone: BookOpen },
  { para: '/app/medidas', rotulo: 'Medidas corporais', icone: Ruler },
  { para: '/app/metas', rotulo: 'Metas', icone: Target },
  { para: '/app/conquistas', rotulo: 'Recordes e conquistas', icone: Trophy },
  { para: '/app/ferramentas', rotulo: 'Calculadoras', icone: Calculator },
  { para: '/app/configuracoes', rotulo: 'Perfil e configurações', icone: Settings },
];

/** Avisa que o app está offline e quantos treinos aguardam sincronização. */
function FaixaOffline({ userId }: { userId: string | undefined }) {
  const { online, pendentes } = useStatusOffline(userId);
  const { sucesso } = useAvisos();
  const [sincronizando, setSincronizando] = useState(false);

  if (online && pendentes === 0) return null;

  const sincronizar = async () => {
    if (!userId) return;
    setSincronizando(true);
    const { enviados } = await sincronizarPendentes(userId);
    setSincronizando(false);
    if (enviados > 0) sucesso(`${enviados} treino(s) sincronizado(s)`);
  };

  return (
    <div
      className={clsx(
        'flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium',
        online ? 'bg-info/15 text-info' : 'bg-alerta/15 text-alerta',
      )}
      role="status"
    >
      {online ? <RefreshCw size={14} /> : <CloudOff size={14} />}
      {online ? (
        <>
          <span>
            {pendentes} treino{pendentes > 1 ? 's' : ''} aguardando envio
          </span>
          <button onClick={sincronizar} className="underline underline-offset-2" disabled={sincronizando}>
            {sincronizando ? 'enviando…' : 'sincronizar agora'}
          </button>
        </>
      ) : (
        <span>Você está offline — o treino é salvo no aparelho e enviado depois</span>
      )}
    </div>
  );
}

export default function Layout() {
  const { usuario, sair } = useAuth();
  const [menuAberto, setMenuAberto] = useState(false);
  const navegar = useNavigate();
  const local = useLocation();
  const emTreino = local.pathname.startsWith('/app/treino');

  // Lembretes de treino nos dias e horário configurados
  useEffect(() => iniciarLembretes(usuario), [usuario]);

  const sairDaConta = async () => {
    await sair();
    navegar('/entrar');
  };

  return (
    <div className="min-h-screen lg:flex">
      {/* Navegação lateral (desktop) */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-borda bg-superficie p-4">
        <Link to="/app" className="mb-6 flex items-center gap-2 px-2 text-lg font-bold">
          <Dumbbell className="text-primaria" size={24} aria-hidden />
          Treinos
        </Link>

        <nav className="flex flex-col gap-1" aria-label="Navegação principal">
          {PRINCIPAIS.map((item) => (
            <NavLink
              key={item.para}
              to={item.para}
              end={item.fim}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive ? 'bg-primaria/15 text-primaria' : 'text-texto-suave hover:bg-superficie-2 hover:text-texto',
                )
              }
            >
              <item.icone size={20} aria-hidden />
              {item.rotulo}
            </NavLink>
          ))}

          <div className="my-3 border-t border-borda" />

          {SECUNDARIOS.map((item) => (
            <NavLink
              key={item.para}
              to={item.para}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive ? 'bg-primaria/15 text-primaria' : 'text-texto-suave hover:bg-superficie-2 hover:text-texto',
                )
              }
            >
              <item.icone size={20} aria-hidden />
              {item.rotulo}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex items-center gap-3 rounded-xl border border-borda p-3">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-superficie-2 text-sm font-semibold">
            {usuario?.photoUrl ? (
              <img src={urlDeMidia(usuario.photoUrl)} alt="" className="h-full w-full object-cover" />
            ) : (
              usuario?.name?.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{usuario?.name}</p>
            <p className="truncate text-xs text-texto-suave">{usuario?.email}</p>
          </div>
          <button onClick={sairDaConta} className="text-texto-suave hover:text-perigo" aria-label="Sair da conta">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <FaixaOffline userId={usuario?.id} />

        <main className={clsx('mx-auto w-full max-w-3xl flex-1 px-4 py-4', !emTreino && 'pb-28 lg:pb-8')}>
          <Outlet />
        </main>

        {/* Navegação inferior (celular) — escondida durante o treino */}
        {!emTreino && (
          <nav
            className="fixed inset-x-0 bottom-0 z-40 border-t border-borda bg-superficie/95 backdrop-blur lg:hidden"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            aria-label="Navegação principal"
          >
            <div className="mx-auto flex max-w-lg items-center justify-around px-2">
              {PRINCIPAIS.slice(0, 2).map((item) => (
                <ItemInferior key={item.para} {...item} />
              ))}

              <Link
                to="/app/treino"
                className="-mt-6 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primaria text-sobre-primaria shadow-lg shadow-primaria/25 active:scale-95 transition-transform"
                aria-label="Iniciar treino"
              >
                <Play size={26} fill="currentColor" aria-hidden />
              </Link>

              {PRINCIPAIS.slice(2).map((item) => (
                <ItemInferior key={item.para} {...item} />
              ))}

              <button
                onClick={() => setMenuAberto(true)}
                className="flex min-w-[56px] flex-col items-center gap-0.5 py-2 text-texto-suave"
              >
                <Menu size={22} aria-hidden />
                <span className="text-[11px] font-medium">Mais</span>
              </button>
            </div>
          </nav>
        )}
      </div>

      <Modal aberto={menuAberto} aoFechar={() => setMenuAberto(false)} titulo="Mais">
        <nav className="flex flex-col gap-1" aria-label="Menu secundário">
          {SECUNDARIOS.map((item) => (
            <Link
              key={item.para}
              to={item.para}
              onClick={() => setMenuAberto(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-3.5 text-[15px] font-medium text-texto hover:bg-superficie-2"
            >
              <item.icone size={20} className="text-primaria" aria-hidden />
              {item.rotulo}
            </Link>
          ))}
        </nav>
        <Botao variante="perigo" larguraTotal className="mt-4" icone={<LogOut size={18} />} onClick={sairDaConta}>
          Sair da conta
        </Botao>
      </Modal>
    </div>
  );
}

function ItemInferior({
  para,
  rotulo,
  icone: Icone,
  fim,
}: {
  para: string;
  rotulo: string;
  icone: typeof Home;
  fim: boolean;
}) {
  return (
    <NavLink
      to={para}
      end={fim}
      className={({ isActive }) =>
        clsx(
          'flex min-w-[56px] flex-col items-center gap-0.5 py-2 transition-colors',
          isActive ? 'text-primaria' : 'text-texto-suave',
        )
      }
    >
      <Icone size={22} aria-hidden />
      <span className="text-[11px] font-medium">{rotulo}</span>
    </NavLink>
  );
}
