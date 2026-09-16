/**
 * Lembretes de treino.
 *
 * Usa a Notification API com o service worker do PWA. Enquanto o app estiver
 * aberto (ou rodando em segundo plano no celular), o lembrete dispara no
 * horário configurado, nos dias marcados como dias de treino.
 *
 * Observação: notificações com o app completamente fechado exigem Web Push
 * (servidor com chaves VAPID) — ver README.
 */
import type { Usuario } from './tipos';

const CHAVE_ULTIMO = 'treinos.ultimo-lembrete';
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

export const notificacoesSuportadas = () => typeof window !== 'undefined' && 'Notification' in window;

export async function pedirPermissaoNotificacoes(): Promise<NotificationPermission> {
  if (!notificacoesSuportadas()) return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

async function mostrar(titulo: string, corpo: string) {
  if (!notificacoesSuportadas() || Notification.permission !== 'granted') return;
  const registro = await navigator.serviceWorker?.getRegistration();
  const opcoes: NotificationOptions = { body: corpo, icon: '/icone.svg', badge: '/icone.svg', tag: 'lembrete-treino' };
  if (registro) await registro.showNotification(titulo, opcoes);
  else new Notification(titulo, opcoes);
}

/** Liga a checagem periódica; devolve a função para desligar. */
export function iniciarLembretes(usuario: Usuario | null): () => void {
  if (!usuario?.remindersOn || !usuario.reminderTime) return () => undefined;

  const verificar = () => {
    const agora = new Date();
    const diaAtual = DIAS[agora.getDay()];
    if (!usuario.trainingDays.includes(diaAtual)) return;

    const [hora, minuto] = (usuario.reminderTime ?? '00:00').split(':').map(Number);
    if (agora.getHours() !== hora || agora.getMinutes() !== minuto) return;

    const chaveHoje = agora.toISOString().slice(0, 10);
    if (localStorage.getItem(CHAVE_ULTIMO) === chaveHoje) return;
    localStorage.setItem(CHAVE_ULTIMO, chaveHoje);

    void mostrar('Hora de treinar! 💪', 'Seu treino de hoje está esperando. Bora?');
  };

  verificar();
  const intervalo = setInterval(verificar, 60_000);
  return () => clearInterval(intervalo);
}
