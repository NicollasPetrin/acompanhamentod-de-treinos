import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, CloudOff, Dumbbell, Home, Timer, TrendingUp, Trophy } from 'lucide-react';
import { apiGet } from '../lib/api';
import { useUnidade } from '../lib/auth';
import { formatarDuracao, formatarPeso, formatarVolume, plural } from '../lib/formato';
import { GRUPOS_MUSCULARES, TIPOS_PR, corDoGrupo } from '../lib/constantes';
import type { ResumoTreino } from '../lib/tipos';
import { Botao, Cartao, Carregando, Distintivo, TituloSecao } from '../components/ui';

export default function ResumoDoTreino() {
  const { id } = useParams();
  const navegar = useNavigate();
  const unidade = useUnidade();
  const local = useLocation() as { state?: { resumo?: ResumoTreino; offline?: boolean } };

  // Ao finalizar, o resumo já vem pronto na navegação (funciona offline).
  const resumoLocal = local.state?.resumo;
  const { data, isLoading } = useQuery({
    queryKey: ['resumo-treino', id],
    queryFn: () => apiGet<ResumoTreino>(`/treinos/${id}/resumo`),
    enabled: !resumoLocal && Boolean(id),
  });

  const resumo = resumoLocal ?? data;
  if (isLoading && !resumo) return <Carregando />;
  if (!resumo) return null;

  const grupos = Object.entries(resumo.gruposMusculares).sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col items-center gap-2 py-4 text-center">
        <CheckCircle2 size={56} className="text-primaria" aria-hidden />
        <h1 className="text-2xl font-bold">Treino concluído!</h1>
        <p className="text-texto-suave">{resumo.treino.name}</p>
        {local.state?.offline && (
          <Distintivo cor="alerta">
            <CloudOff size={12} /> Salvo no aparelho — sincroniza depois
          </Distintivo>
        )}
      </header>

      <section className="grid grid-cols-2 gap-3">
        <Cartao className="p-3.5">
          <div className="flex items-center gap-2 text-texto-suave">
            <Timer size={16} />
            <span className="text-xs font-medium uppercase">Duração</span>
          </div>
          <p className="mt-1 text-2xl font-bold">{formatarDuracao(resumo.duracaoSeg)}</p>
        </Cartao>
        <Cartao className="p-3.5">
          <div className="flex items-center gap-2 text-texto-suave">
            <TrendingUp size={16} />
            <span className="text-xs font-medium uppercase">Volume</span>
          </div>
          <p className="mt-1 text-2xl font-bold">{formatarVolume(resumo.volumeTotal, unidade)}</p>
        </Cartao>
        <Cartao className="p-3.5">
          <div className="flex items-center gap-2 text-texto-suave">
            <Dumbbell size={16} />
            <span className="text-xs font-medium uppercase">Séries</span>
          </div>
          <p className="mt-1 text-2xl font-bold">{resumo.seriesConcluidas}</p>
          <p className="text-xs text-texto-suave">{plural(resumo.repeticoesTotais, 'repetição', 'repetições')}</p>
        </Cartao>
        <Cartao className="p-3.5">
          <div className="flex items-center gap-2 text-texto-suave">
            <Dumbbell size={16} />
            <span className="text-xs font-medium uppercase">Exercícios</span>
          </div>
          <p className="mt-1 text-2xl font-bold">{resumo.exerciciosRealizados}</p>
        </Cartao>
      </section>

      {resumo.recordes.length > 0 && (
        <section>
          <TituloSecao titulo="Recordes batidos 🏆" />
          <div className="flex flex-col gap-2">
            {resumo.recordes.map((recorde, i) => (
              <Cartao key={`${recorde.exercise.id}-${recorde.type}-${i}`} className="flex items-center gap-3 border-alerta/40 p-3.5">
                <Trophy size={22} className="shrink-0 text-alerta" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{recorde.exercise.name}</p>
                  <p className="text-sm text-texto-suave">
                    {TIPOS_PR[recorde.type]}:{' '}
                    {recorde.type === 'reps'
                      ? plural(recorde.value, 'repetição', 'repetições')
                      : formatarPeso(recorde.value, unidade)}
                    {recorde.weight != null && recorde.reps != null && recorde.type !== 'reps' && (
                      <> · {formatarPeso(recorde.weight, unidade)} × {recorde.reps}</>
                    )}
                  </p>
                </div>
              </Cartao>
            ))}
          </div>
        </section>
      )}

      {resumo.conquistas && resumo.conquistas.length > 0 && (
        <section>
          <TituloSecao titulo="Novas conquistas" />
          <div className="flex flex-col gap-2">
            {resumo.conquistas.map((conquista) => (
              <Cartao key={conquista.code} className="flex items-center gap-3 border-primaria/40 p-3.5">
                <span className="text-2xl" aria-hidden>
                  {conquista.icon}
                </span>
                <div>
                  <p className="font-medium">{conquista.title}</p>
                  <p className="text-sm text-texto-suave">{conquista.description}</p>
                </div>
              </Cartao>
            ))}
          </div>
        </section>
      )}

      {grupos.length > 0 && (
        <section>
          <TituloSecao titulo="Grupos musculares trabalhados" />
          <div className="flex flex-wrap gap-2">
            {grupos.map(([grupo, series]) => (
              <span
                key={grupo}
                className="inline-flex items-center gap-2 rounded-xl border border-borda bg-superficie px-3 py-2 text-sm"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: corDoGrupo(grupo) }} aria-hidden />
                {GRUPOS_MUSCULARES[grupo] ?? grupo}
                <strong className="text-texto-suave">{series}</strong>
              </span>
            ))}
          </div>
        </section>
      )}

      {resumo.treino.notes && (
        <section>
          <TituloSecao titulo="Suas anotações" />
          <Cartao className="text-sm text-texto-suave">{resumo.treino.notes}</Cartao>
        </section>
      )}

      <div className="flex gap-2">
        <Botao variante="secundario" larguraTotal onClick={() => navegar('/app')} icone={<Home size={18} />}>
          Início
        </Botao>
        <Link to="/app/progresso" className="w-full">
          <Botao larguraTotal icone={<TrendingUp size={18} />}>
            Ver progresso
          </Botao>
        </Link>
      </div>
    </div>
  );
}
