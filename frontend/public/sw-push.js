/*
 * Notificações do app (Web Push).
 *
 * Este arquivo é carregado pelo service worker gerado pelo vite-plugin-pwa
 * (ver `importScripts` no vite.config.ts). É ele que roda com o app fechado:
 * recebe a mensagem do servidor, mostra a notificação e, no toque, abre o app
 * na tela do treino.
 */

self.addEventListener('push', (evento) => {
  let dados = {};
  try {
    dados = evento.data ? evento.data.json() : {};
  } catch {
    dados = { titulo: 'Treinos', corpo: evento.data ? evento.data.text() : '' };
  }

  const titulo = dados.titulo || 'Treinos';
  const opcoes = {
    body: dados.corpo || '',
    // mesma etiqueta = substitui a anterior ("em andamento" vira "descanso acabou")
    tag: dados.etiqueta || 'treino',
    renotify: !dados.silenciosa,
    silent: Boolean(dados.silenciosa),
    icon: '/icone.svg',
    badge: '/icone.svg',
    vibrate: dados.silenciosa ? undefined : [200, 100, 200],
    data: { url: dados.url || '/app' },
  };

  // O iPhone exige que toda mensagem recebida vire uma notificação visível
  evento.waitUntil(self.registration.showNotification(titulo, opcoes));
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = new URL((evento.notification.data && evento.notification.data.url) || '/app', self.location.origin);

  evento.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const aberta = janelas.find((j) => new URL(j.url).origin === destino.origin);
      if (aberta) {
        await aberta.focus();
        // já está na tela certa? só traz para frente, sem recarregar o treino
        if (new URL(aberta.url).pathname !== destino.pathname && 'navigate' in aberta) {
          await aberta.navigate(destino.href).catch(() => undefined);
        }
        return;
      }
      await self.clients.openWindow(destino.href);
    })(),
  );
});
