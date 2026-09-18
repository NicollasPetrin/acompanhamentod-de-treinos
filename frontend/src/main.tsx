import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { AuthProvider } from './lib/auth';
import { aplicarTema, temaSalvo } from './lib/tema';
import { NotificacoesProvider } from './components/Notificacoes';
import './index.css';

// Tema e cor salvos entram antes da primeira pintura, para não "piscar" branco
const preferencias = temaSalvo();
aplicarTema(preferencias.tema, preferencias.cor);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      // Mantém os dados em cache para o app abrir offline
      gcTime: 1000 * 60 * 60 * 24,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <NotificacoesProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </NotificacoesProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
