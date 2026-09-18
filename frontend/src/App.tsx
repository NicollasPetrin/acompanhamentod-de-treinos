import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { Carregando } from './components/ui';
import Layout from './components/Layout';

import Landing from './pages/Landing';
import Entrar from './pages/Entrar';
import Cadastrar from './pages/Cadastrar';
import EsqueciSenha from './pages/EsqueciSenha';
import RedefinirSenha from './pages/RedefinirSenha';
import Inicio from './pages/Inicio';
import Rotinas from './pages/Rotinas';
import EditorDeRotina from './pages/EditorDeRotina';
import Treino from './pages/Treino';
import ResumoDoTreino from './pages/ResumoDoTreino';
import Historico from './pages/Historico';
import DetalheDoTreino from './pages/DetalheDoTreino';

import Exercicios from './pages/Exercicios';

import Metas from './pages/Metas';

import RotinaCompartilhada from './pages/RotinaCompartilhada';

// Telas com gráficos e formulários grandes entram por carregamento sob demanda:
// o pacote inicial fica leve, o que importa no 4G da academia.
const Progresso = lazy(() => import('./pages/Progresso'));
const DetalheDoExercicio = lazy(() => import('./pages/DetalheDoExercicio'));
const Medidas = lazy(() => import('./pages/Medidas'));
const Conquistas = lazy(() => import('./pages/Conquistas'));
const Ferramentas = lazy(() => import('./pages/Ferramentas'));
const Configuracoes = lazy(() => import('./pages/Configuracoes'));
const Ajuda = lazy(() => import('./pages/Ajuda'));
const AssistenteDeRotina = lazy(() => import('./pages/AssistenteDeRotina'));

/** Só entra quem está autenticado; o destino é lembrado para voltar após o login. */
function Protegida({ children }: { children: JSX.Element }) {
  const { autenticado, carregando } = useAuth();
  const local = useLocation();

  if (carregando) return <Carregando texto="Carregando seu treino…" />;
  if (!autenticado) return <Navigate to="/entrar" state={{ de: local.pathname }} replace />;
  return children;
}

/**
 * Quem já está logado não precisa ver landing/login — exceto quando está
 * adicionando uma segunda conta ao aparelho (treino em dupla).
 */
function Publica({ children }: { children: JSX.Element }) {
  const { autenticado, carregando } = useAuth();
  const local = useLocation();
  const adicionandoConta = new URLSearchParams(local.search).get('adicionar') === '1';

  if (carregando) return <Carregando />;
  if (autenticado && !adicionandoConta) return <Navigate to="/app" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Publica><Landing /></Publica>} />
      <Route path="/entrar" element={<Publica><Entrar /></Publica>} />
      <Route path="/cadastrar" element={<Publica><Cadastrar /></Publica>} />
      <Route path="/esqueci-senha" element={<Publica><EsqueciSenha /></Publica>} />
      <Route path="/redefinir-senha" element={<RedefinirSenha />} />
      {/* Rotina compartilhada é pública: quem recebe o link pode ver e copiar */}
      <Route path="/r/:slug" element={<RotinaCompartilhada />} />

      <Route
        path="/app"
        element={
          <Protegida>
            <Suspense fallback={<Carregando />}>
              <Layout />
            </Suspense>
          </Protegida>
        }
      >
        <Route index element={<Inicio />} />
        <Route path="rotinas" element={<Rotinas />} />
        {/* precisa vir antes de :id para "nova" não ser lida como um id */}
        <Route path="rotinas/nova" element={<AssistenteDeRotina />} />
        <Route path="rotinas/:id" element={<EditorDeRotina />} />
        <Route path="treino" element={<Treino />} />
        <Route path="treino/:id" element={<Treino />} />
        <Route path="resumo/:id" element={<ResumoDoTreino />} />
        <Route path="historico" element={<Historico />} />
        <Route path="historico/:id" element={<DetalheDoTreino />} />
        <Route path="progresso" element={<Progresso />} />
        <Route path="exercicios" element={<Exercicios />} />
        <Route path="exercicios/:id" element={<DetalheDoExercicio />} />
        <Route path="medidas" element={<Medidas />} />
        <Route path="metas" element={<Metas />} />
        <Route path="conquistas" element={<Conquistas />} />
        <Route path="ferramentas" element={<Ferramentas />} />
        <Route path="configuracoes" element={<Configuracoes />} />
        <Route path="ajuda" element={<Ajuda />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
