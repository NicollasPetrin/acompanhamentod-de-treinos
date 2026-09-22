import { useEffect, useRef, type ReactNode } from 'react';
import { Minus, Pause, Play, Plus, X } from 'lucide-react';
import { formatarDuracao } from '../lib/formato';
import {
  ajustar, continuar, pausar, segundosRestantes, useAgora, type EstadoDescanso,
} from '../lib/descanso';

/** Bipe curto via Web Audio — não depende de arquivo de áudio. */
function tocarBipe() {
  try {
    const Contexto = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Contexto();
    const oscilador = ctx.createOscillator();
    const ganho = ctx.createGain();
    oscilador.connect(ganho);
    ganho.connect(ctx.destination);
    oscilador.frequency.value = 880;
    oscilador.type = 'sine';
    ganho.gain.setValueAtTime(0.0001, ctx.currentTime);
    ganho.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.02);
    ganho.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    oscilador.start();
    oscilador.stop(ctx.currentTime + 0.55);
    setTimeout(() => void ctx.close(), 800);
  } catch {
    /* navegador sem áudio disponível: seguimos com a vibração */
  }
}

interface Props {
  estado: EstadoDescanso;
  /** Toda mudança (pausa, ±15 s, aviso dado) volta para quem guarda o estado. */
  aoMudar: (estado: EstadoDescanso) => void;
  /** Chamado uma vez quando o tempo acaba com o app aberto. */
  aoTerminar?: (estado: EstadoDescanso) => void;
  aoFechar: () => void;
  /** Espaço para o convite de ativar notificações, quando fizer sentido. */
  extra?: ReactNode;
}

/**
 * Cronômetro de descanso: inicia sozinho ao concluir uma série, avisa com som
 * e vibração no fim e permite ajustar o tempo com um toque.
 *
 * O tempo restante é sempre calculado a partir do horário de término, então
 * sair do app, bloquear a tela ou até fechar e reabrir não congela o descanso.
 */
export default function CronometroDescanso({ estado, aoMudar, aoTerminar, aoFechar, extra }: Props) {
  const agora = useAgora();
  const restante = segundosRestantes(estado, agora);
  const pausado = estado.terminaEm === null;
  const acabou = restante <= 0 && !pausado;

  // Dispara o aviso uma única vez — o "avisado" fica gravado junto do estado,
  // então reabrir o app depois do fim não toca de novo.
  const ultimoEstado = useRef(estado);
  ultimoEstado.current = estado;
  useEffect(() => {
    if (!acabou || estado.avisado) return;
    // Só toca se acabou agora há pouco; voltar ao app muito depois não apita
    if (restante > -3) {
      tocarBipe();
      navigator.vibrate?.([200, 100, 200]);
    }
    const avisado = { ...ultimoEstado.current, avisado: true };
    aoMudar(avisado);
    aoTerminar?.(avisado);
  }, [acabou, estado.avisado, restante, aoMudar, aoTerminar]);

  const exibido = Math.max(0, restante);
  const progresso = estado.total > 0 ? Math.min(100, ((estado.total - exibido) / estado.total) * 100) : 100;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t border-borda bg-superficie/98 backdrop-blur"
      style={{ paddingBottom: 'calc(var(--seguro-base) + 0.5rem)' }}
      role="timer"
      aria-live="off"
    >
      <div className="h-1 w-full bg-superficie-2">
        <div
          className={`h-full transition-all duration-500 ${acabou ? 'bg-primaria' : 'bg-info'}`}
          style={{ width: `${progresso}%` }}
        />
      </div>

      {extra}

      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-texto-suave">
            {acabou ? 'Descanso concluído' : pausado ? 'Descanso pausado' : 'Descansando'}
          </p>
          <p className={`text-3xl font-bold tabular-nums ${acabou ? 'text-primaria' : ''}`}>
            {acabou ? `+${formatarDuracao(-restante)}` : formatarDuracao(exibido)}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => aoMudar(ajustar(estado, -15))}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-borda bg-superficie-2 text-texto"
            aria-label="Reduzir 15 segundos"
          >
            <Minus size={18} />
          </button>
          <button
            onClick={() => aoMudar(ajustar(estado, 15))}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-borda bg-superficie-2 text-texto"
            aria-label="Adicionar 15 segundos"
          >
            <Plus size={18} />
          </button>
          <button
            onClick={() => aoMudar(pausado ? continuar(estado) : pausar(estado))}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-borda bg-superficie-2 text-texto"
            aria-label={pausado ? 'Continuar descanso' : 'Pausar descanso'}
          >
            {pausado ? <Play size={18} /> : <Pause size={18} />}
          </button>
          <button
            onClick={aoFechar}
            className="flex h-11 items-center gap-1.5 rounded-xl bg-primaria px-4 font-semibold text-sobre-primaria"
          >
            <X size={18} />
            {acabou ? 'Fechar' : 'Pular'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Tempo decorrido desde `inicio` (cronômetro total do treino). Calculado pelo
 * relógio, então continua certo depois de o app ficar em segundo plano.
 */
export function useTempoDecorrido(inicio: string | Date) {
  const agora = useAgora(1000);
  return Math.max(0, Math.floor((agora - new Date(inicio).getTime()) / 1000));
}
