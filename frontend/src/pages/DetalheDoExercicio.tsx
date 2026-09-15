import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Star, Trophy } from 'lucide-react';
import { apiDelete, apiGet, apiPost } from '../lib/api';
import { useUnidade } from '../lib/auth';
import { EQUIPAMENTOS, GRUPOS_MUSCULARES, TIPOS_EXERCICIO, TIPOS_PR } from '../lib/constantes';
import { formatarData, formatarDataCurta, formatarPeso, formatarVolume, plural } from '../lib/formato';
import type { Exercicio, TipoPr } from '../lib/tipos';
import { Cartao, Carregando, Distintivo, TituloSecao, Vazio } from '../components/ui';
import { CartaoGrafico, GraficoLinha } from '../components/Graficos';

interface Historico {
  totalSessoes: number;
  recordes: Partial<Record<TipoPr, { value: number; date: string; weight: number | null; reps: number | null }>>;
  evolucao: Array<{ date: string; cargaMaxima: number; volume: number; umRm: number }>;
  sessoes: Array<{
    workoutId: string;
    workoutName: string;
    date: string;
    volume: number;
    cargaMaxima: number;
    melhorSerie: { weight: number; reps: number } | null;
    sets: Array<{ id: string; weight: number; reps: number; type: string; isPr: boolean }>;
  }>;
}

export default function DetalheDoExercicio() {
  const { id } = useParams();
  const navegar = useNavigate();
  const unidade = useUnidade();
  const queryClient = useQueryClient();

  const { data: exercicio, isLoading } = useQuery({
    queryKey: ['exercicio', id],
    queryFn: () => apiGet<Exercicio>(`/exercicios/${id}`),
  });

  const { data: historico } = useQuery({
    queryKey: ['exercicio-historico', id],
    queryFn: () => apiGet<Historico>(`/exercicios/${id}/historico`),
  });

  const favoritar = useMutation({
    mutationFn: () =>
      exercicio?.favorito ? apiDelete(`/exercicios/${id}/favorito`) : apiPost(`/exercicios/${id}/favorito`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exercicio', id] }),
  });

  if (isLoading) return <Carregando />;
  if (!exercicio) return null;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start gap-2">
        <button
          onClick={() => navegar(-1)}
          className="rounded-lg p-2 text-texto-suave hover:bg-superficie-2 hover:text-texto"
          aria-label="Voltar"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="min-w-0 flex-1 text-xl font-bold">{exercicio.name}</h1>
        <button
          onClick={() => favoritar.mutate()}
          className="rounded-lg p-2 text-texto-suave hover:bg-superficie-2"
          aria-label={exercicio.favorito ? 'Desfavoritar' : 'Favoritar'}
          aria-pressed={Boolean(exercicio.favorito)}
        >
          <Star size={22} className={exercicio.favorito ? 'fill-alerta text-alerta' : ''} />
        </button>
      </header>

      <img
        src={exercicio.imageUrl}
        alt={`Ilustração de ${exercicio.name}`}
        className="w-full rounded-2xl border border-borda bg-superficie"
      />

      <div className="flex flex-wrap gap-2">
        <Distintivo cor="primaria">{GRUPOS_MUSCULARES[exercicio.muscleGroup] ?? exercicio.muscleGroup}</Distintivo>
        <Distintivo>{EQUIPAMENTOS[exercicio.equipment] ?? exercicio.equipment}</Distintivo>
        <Distintivo>{TIPOS_EXERCICIO[exercicio.type] ?? exercicio.type}</Distintivo>
        {exercicio.secondaryMuscles.map((musculo) => (
          <Distintivo key={musculo} cor="info">
            {GRUPOS_MUSCULARES[musculo] ?? musculo}
          </Distintivo>
        ))}
        {exercicio.isUnilateral && <Distintivo cor="alerta">unilateral</Distintivo>}
      </div>

      {exercicio.instructions && (
        <section>
          <TituloSecao titulo="Como executar" />
          <Cartao className="text-[15px] leading-relaxed text-texto-suave">{exercicio.instructions}</Cartao>
        </section>
      )}

      {historico && historico.totalSessoes > 0 ? (
        <>
          <section>
            <TituloSecao titulo="Seus recordes" />
            <div className="grid grid-cols-2 gap-3">
              {(['carga', '1rm', 'volume', 'reps'] as TipoPr[]).map((tipo) => {
                const recorde = historico.recordes[tipo];
                return (
                  <Cartao key={tipo} className="p-3.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium uppercase text-texto-suave">
                      <Trophy size={14} className="text-alerta" aria-hidden />
                      {TIPOS_PR[tipo]}
                    </div>
                    <p className="mt-1 text-xl font-bold">
                      {recorde
                        ? tipo === 'reps'
                          ? `${recorde.value} reps`
                          : formatarVolume(recorde.value, unidade)
                        : '—'}
                    </p>
                    {recorde && (
                      <p className="text-xs text-texto-suave">
                        {recorde.weight != null && recorde.reps != null && tipo !== 'reps'
                          ? `${formatarPeso(recorde.weight, unidade)} × ${recorde.reps} · `
                          : ''}
                        {formatarData(recorde.date)}
                      </p>
                    )}
                  </Cartao>
                );
              })}
            </div>
          </section>

          <CartaoGrafico titulo="Evolução de carga" descricao="Maior carga usada em cada sessão">
            <GraficoLinha
              dados={historico.evolucao.map((ponto) => ({
                data: formatarDataCurta(ponto.date),
                carga: Math.round(ponto.cargaMaxima * 10) / 10,
              }))}
              chaveX="data"
              chaveY="carga"
              formatador={(valor) => formatarPeso(valor, unidade)}
            />
          </CartaoGrafico>

          <CartaoGrafico titulo="1RM estimado" descricao="Fórmula de Epley, com base na melhor série">
            <GraficoLinha
              dados={historico.evolucao.map((ponto) => ({
                data: formatarDataCurta(ponto.date),
                umRm: Math.round(ponto.umRm * 10) / 10,
              }))}
              chaveX="data"
              chaveY="umRm"
              formatador={(valor) => formatarPeso(valor, unidade)}
            />
          </CartaoGrafico>

          <section>
            <TituloSecao titulo="Histórico" descricao={plural(historico.totalSessoes, 'sessão', 'sessões')} />
            <div className="flex flex-col gap-2">
              {historico.sessoes.slice(0, 12).map((sessao) => (
                <Cartao key={sessao.workoutId} className="p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{sessao.workoutName}</p>
                      <p className="text-sm text-texto-suave">{formatarData(sessao.date)}</p>
                    </div>
                    <p className="shrink-0 text-sm text-texto-suave">{formatarVolume(sessao.volume, unidade)}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {sessao.sets.map((serie, i) => (
                      <span
                        key={serie.id}
                        className={`rounded-lg px-2 py-1 text-xs tabular-nums ${
                          serie.isPr ? 'bg-alerta/15 text-alerta' : 'bg-superficie-2 text-texto-suave'
                        }`}
                      >
                        {i + 1}: {formatarPeso(serie.weight, unidade, false)}×{serie.reps}
                      </span>
                    ))}
                  </div>
                </Cartao>
              ))}
            </div>
          </section>
        </>
      ) : (
        <Vazio
          titulo="Nenhum registro neste exercício"
          descricao="Assim que você treinar esse movimento, o histórico e os gráficos aparecem aqui."
        />
      )}
    </div>
  );
}
