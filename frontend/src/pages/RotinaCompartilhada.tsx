import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Copy, Dumbbell } from 'lucide-react';
import { apiGet, apiPost } from '../lib/api';
import { useAuth } from '../lib/auth';
import { TECNICAS, corDoGrupo } from '../lib/constantes';
import { formatarDuracao, plural } from '../lib/formato';
import type { Rotina } from '../lib/tipos';
import { Botao, Cartao, Carregando, Distintivo, Vazio } from '../components/ui';
import { useAvisos } from '../components/Notificacoes';

/** Página pública: quem recebe o link vê a rotina e pode copiar para a conta. */
export default function RotinaCompartilhada() {
  const { slug } = useParams();
  const navegar = useNavigate();
  const { autenticado } = useAuth();
  const { sucesso, erro: avisarErro } = useAvisos();

  const { data: rotina, isLoading } = useQuery({
    queryKey: ['rotina-compartilhada', slug],
    queryFn: () => apiGet<Rotina>(`/rotinas/compartilhadas/${slug}`, { publico: true }),
    retry: false,
  });

  const copiar = useMutation({
    mutationFn: () => apiPost<Rotina>(`/rotinas/compartilhadas/${slug}/copiar`),
    onSuccess: (nova) => {
      sucesso('Rotina copiada para a sua conta!');
      navegar(`/app/rotinas/${nova.id}`);
    },
    onError: () => avisarErro('Não foi possível copiar a rotina'),
  });

  if (isLoading) return <Carregando />;

  if (!rotina) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <Vazio
          titulo="Rotina não encontrada"
          descricao="O link pode ter sido revogado pelo autor ou está incorreto."
          acao={
            <Link to="/">
              <Botao>Ir para a página inicial</Botao>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link to="/" className="mb-6 flex items-center gap-2 text-lg font-bold">
        <Dumbbell className="text-primaria" aria-hidden />
        Treinos
      </Link>

      <header className="mb-5">
        <Distintivo cor="info">Rotina compartilhada</Distintivo>
        <h1 className="mt-2 text-2xl font-bold">{rotina.name}</h1>
        {rotina.autor && <p className="text-sm text-texto-suave">por {rotina.autor}</p>}
        {rotina.description && <p className="mt-2 text-texto-suave">{rotina.description}</p>}
        <p className="mt-2 text-sm text-texto-suave">
          {plural(rotina.days.length, 'dia de treino', 'dias de treino')} ·{' '}
          {plural(rotina.days.reduce((t, d) => t + d.exercises.length, 0), 'exercício')}
        </p>
      </header>

      <div className="mb-6">
        {autenticado ? (
          <Botao larguraTotal icone={<Copy size={18} />} carregando={copiar.isPending} onClick={() => copiar.mutate()}>
            Copiar para minha conta
          </Botao>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link to="/cadastrar" className="w-full">
              <Botao larguraTotal>Criar conta para copiar</Botao>
            </Link>
            <Link to="/entrar" className="w-full">
              <Botao variante="secundario" larguraTotal>
                Entrar
              </Botao>
            </Link>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {rotina.days.map((dia) => (
          <Cartao key={dia.id} className="p-0 overflow-hidden">
            <div className="border-b border-borda p-3.5">
              <h2 className="font-semibold">{dia.name}</h2>
              <p className="text-sm text-texto-suave">{plural(dia.exercises.length, 'exercício')}</p>
            </div>
            <ul>
              {dia.exercises.map((item) => (
                <li key={item.id} className="flex items-center gap-3 border-t border-borda/60 px-3.5 py-2.5">
                  <span
                    className="h-8 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: corDoGrupo(item.exercise.muscleGroup) }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5">
                      <span className="truncate font-medium">{item.exercise.name}</span>
                      {item.technique !== 'normal' && <Distintivo cor="info">{TECNICAS[item.technique]}</Distintivo>}
                    </p>
                    <p className="text-sm text-texto-suave">
                      {item.sets} × {item.repsMin === item.repsMax ? item.repsMin : `${item.repsMin}–${item.repsMax}`} ·
                      descanso {formatarDuracao(item.restSec)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Cartao>
        ))}
      </div>
    </div>
  );
}
