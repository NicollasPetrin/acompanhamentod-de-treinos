/**
 * Estado do cronômetro de descanso.
 *
 * O descanso é guardado como "termina às HH:MM:SS" (um horário), não como
 * "faltam N segundos". Assim ele não depende do app ficar aberto contando: o
 * iPhone suspende apps em segundo plano, e um contador que desce de um em um
 * congelava ali. Com o horário, ao voltar basta olhar o relógio.
 *
 * Fica no localStorage, por conta, para sobreviver até ao app ser fechado de
 * vez — ao reabrir o treino, o descanso continua de onde deveria estar.
 */
import { useEffect, useState } from 'react';

export interface EstadoDescanso {
  /** clientId do treino em andamento — descanso de outro treino é ignorado. */
  treinoId: string;
  /** Quando o descanso acaba (epoch ms). Nulo enquanto está pausado. */
  terminaEm: number | null;
  /** Segundos que faltavam no momento da pausa. */
  restantePausado: number | null;
  /** Duração total, para a barra de progresso. */
  total: number;
  /** Exercício da série que acabou de ser feita — vai na notificação. */
  exercicio?: string;
  /** O aviso de fim (som, vibração, notificação) já foi dado. */
  avisado?: boolean;
}

const chave = (userId: string) => `treinos.descanso.${userId}`;

export function lerDescanso(userId: string, treinoId: string): EstadoDescanso | null {
  try {
    const bruto = localStorage.getItem(chave(userId));
    if (!bruto) return null;
    const estado = JSON.parse(bruto) as EstadoDescanso;
    return estado.treinoId === treinoId ? estado : null;
  } catch {
    return null;
  }
}

export function salvarDescanso(userId: string, estado: EstadoDescanso | null) {
  try {
    if (estado) localStorage.setItem(chave(userId), JSON.stringify(estado));
    else localStorage.removeItem(chave(userId));
  } catch {
    /* navegação privada: o descanso só não sobrevive a fechar o app */
  }
}

export function iniciarDescanso(treinoId: string, segundos: number, exercicio?: string): EstadoDescanso {
  return {
    treinoId,
    terminaEm: Date.now() + segundos * 1000,
    restantePausado: null,
    total: segundos,
    exercicio,
    avisado: false,
  };
}

/**
 * Segundos que faltam. Negativo quando o descanso já acabou: é quanto tempo
 * passou do combinado (a tela mostra "+0:42").
 */
export function segundosRestantes(estado: EstadoDescanso, agora = Date.now()): number {
  if (estado.terminaEm === null) return estado.restantePausado ?? 0;
  return Math.ceil((estado.terminaEm - agora) / 1000);
}

export function pausar(estado: EstadoDescanso): EstadoDescanso {
  if (estado.terminaEm === null) return estado;
  return { ...estado, terminaEm: null, restantePausado: Math.max(0, segundosRestantes(estado)) };
}

export function continuar(estado: EstadoDescanso): EstadoDescanso {
  if (estado.terminaEm !== null) return estado;
  return { ...estado, terminaEm: Date.now() + (estado.restantePausado ?? 0) * 1000, restantePausado: null };
}

/** Soma (ou tira) segundos, pausado ou não. Voltar a ter tempo rearma o aviso. */
export function ajustar(estado: EstadoDescanso, delta: number): EstadoDescanso {
  const restante = Math.max(0, segundosRestantes(estado));
  const novoRestante = Math.max(0, restante + delta);
  const total = Math.max(15, estado.total + delta);
  const avisado = novoRestante > 0 ? false : estado.avisado;

  if (estado.terminaEm === null) return { ...estado, restantePausado: novoRestante, total, avisado };
  return { ...estado, terminaEm: Date.now() + novoRestante * 1000, total, avisado };
}

/**
 * Relógio da tela. Além do tique normal, relê a hora quando o app volta a
 * aparecer — o primeiro tique depois de sair do segundo plano pode demorar.
 */
export function useAgora(intervaloMs = 500) {
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const atualizar = () => setAgora(Date.now());
    const id = setInterval(atualizar, intervaloMs);
    document.addEventListener('visibilitychange', atualizar);
    window.addEventListener('pageshow', atualizar);
    window.addEventListener('focus', atualizar);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', atualizar);
      window.removeEventListener('pageshow', atualizar);
      window.removeEventListener('focus', atualizar);
    };
  }, [intervaloMs]);

  return agora;
}
