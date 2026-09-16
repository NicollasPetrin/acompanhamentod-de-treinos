import { useCallback, useEffect, useRef, useState } from 'react';
import { Minus, Pause, Play, Plus, X } from 'lucide-react';
import { formatarDuracao } from '../lib/formato';

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
  segundos: number;
  aoTerminar?: () => void;
  aoFechar: () => void;
}

/**
 * Cronômetro de descanso: inicia sozinho ao concluir uma série, avisa com som
 * e vibração no fim e permite ajustar o tempo com um toque.
 */
export default function CronometroDescanso({ segundos, aoTerminar, aoFechar }: Props) {
  const [restante, setRestante] = useState(segundos);
  const [total, setTotal] = useState(segundos);
  const [pausado, setPausado] = useState(false);
  const jaAvisou = useRef(false);

  useEffect(() => {
    setRestante(segundos);
    setTotal(segundos);
    jaAvisou.current = false;
    setPausado(false);
  }, [segundos]);

  const avisar = useCallback(() => {
    if (jaAvisou.current) return;
    jaAvisou.current = true;
    tocarBipe();
    navigator.vibrate?.([200, 100, 200]);
    aoTerminar?.();
  }, [aoTerminar]);

  useEffect(() => {
    if (pausado) return;
    const intervalo = setInterval(() => {
      setRestante((atual) => {
        if (atual <= 1) {
          avisar();
          return 0;
        }
        return atual - 1;
      });
    }, 1000);
    return () => clearInterval(intervalo);
  }, [pausado, avisar]);

  const progresso = total > 0 ? ((total - restante) / total) * 100 : 100;
  const acabou = restante === 0;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t border-borda bg-superficie/98 backdrop-blur"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
      role="timer"
      aria-live="off"
    >
      <div className="h-1 w-full bg-superficie-2">
        <div
          className={`h-full transition-all duration-1000 ${acabou ? 'bg-primaria' : 'bg-info'}`}
          style={{ width: `${progresso}%` }}
        />
      </div>

      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-texto-suave">
            {acabou ? 'Descanso concluído' : 'Descansando'}
          </p>
          <p className={`text-3xl font-bold tabular-nums ${acabou ? 'text-primaria animate-pulsa' : ''}`}>
            {formatarDuracao(restante)}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => {
              setRestante((r) => Math.max(0, r - 15));
              setTotal((t) => Math.max(15, t - 15));
            }}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-borda bg-superficie-2 text-texto"
            aria-label="Reduzir 15 segundos"
          >
            <Minus size={18} />
          </button>
          <button
            onClick={() => {
              setRestante((r) => r + 15);
              setTotal((t) => t + 15);
              jaAvisou.current = false;
            }}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-borda bg-superficie-2 text-texto"
            aria-label="Adicionar 15 segundos"
          >
            <Plus size={18} />
          </button>
          <button
            onClick={() => setPausado((p) => !p)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-borda bg-superficie-2 text-texto"
            aria-label={pausado ? 'Continuar descanso' : 'Pausar descanso'}
          >
            {pausado ? <Play size={18} /> : <Pause size={18} />}
          </button>
          <button
            onClick={aoFechar}
            className="flex h-11 items-center gap-1.5 rounded-xl bg-primaria px-4 font-semibold text-[#04140a]"
          >
            <X size={18} />
            Pular
          </button>
        </div>
      </div>
    </div>
  );
}

/** Tempo decorrido desde `inicio` (cronômetro total do treino). */
export function useTempoDecorrido(inicio: string | Date) {
  const [segundos, setSegundos] = useState(() =>
    Math.max(0, Math.floor((Date.now() - new Date(inicio).getTime()) / 1000)),
  );

  useEffect(() => {
    const intervalo = setInterval(() => {
      setSegundos(Math.max(0, Math.floor((Date.now() - new Date(inicio).getTime()) / 1000)));
    }, 1000);
    return () => clearInterval(intervalo);
  }, [inicio]);

  return segundos;
}
