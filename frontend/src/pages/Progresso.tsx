import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, Trophy } from 'lucide-react';
import { apiGet } from '../lib/api';
import { useUnidade } from '../lib/auth';
import { formatarDataCurta, formatarNumero, formatarVolume, paraUnidade, plural } from '../lib/formato';
import { GRUPOS_MUSCULARES, corDoGrupo } from '../lib/constantes';
import type { RecordeDoExercicio } from '../lib/tipos';
import { Abas, BarraProgresso, Botao, Cartao, Carregando, Estatistica, TituloSecao, Vazio } from '../components/ui';
import { CartaoGrafico, COR_INFO, GraficoArea, GraficoBarras } from '../components/Graficos';

interface SemanaVolume {
  semana: string;
  volume: number;
  treinos: number;
  series: number;
}

interface GrupoMuscular {
  grupo: string;
  series: number;
  volume: number;
  percentual: number;
}

interface Frequencia {
  itens: Array<{ mes: string; treinos: number; minutos: number; volume: number }>;
  mediaSemanal: number;
}

interface Comparativo {
  mesAtual: { treinos: number; volume: number; series: number; repeticoes: number; minutos: number };
  mesAnterior: { treinos: number; volume: number; series: number; repeticoes: number; minutos: number };
  variacao: { treinos: number; volume: number; series: number; minutos: number };
}

export default function Progresso() {
  const unidade = useUnidade();
  const [janelaGrupos, setJanelaGrupos] = useState<30 | 90 | 365>(30);

  const { data: volume, isLoading } = useQuery({
    queryKey: ['volume-semanal'],
    queryFn: () => apiGet<SemanaVolume[]>('/progresso/volume-semanal?semanas=12'),
  });

  const { data: grupos } = useQuery({
    queryKey: ['grupos-musculares', janelaGrupos],
    queryFn: () => apiGet<GrupoMuscular[]>(`/progresso/grupos-musculares?dias=${janelaGrupos}`),
  });

  const { data: frequencia } = useQuery({
    queryKey: ['frequencia'],
    queryFn: () => apiGet<Frequencia>('/progresso/frequencia?meses=6'),
  });

  const { data: comparativo } = useQuery({
    queryKey: ['comparativo'],
    queryFn: () => apiGet<Comparativo>('/progresso/comparativo'),
  });

  const { data: recordes } = useQuery({
    queryKey: ['recordes'],
    queryFn: () => apiGet<RecordeDoExercicio[]>('/progresso/recordes'),
  });

  if (isLoading) return <Carregando />;

  const temDados = (volume ?? []).some((v) => v.treinos > 0);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Progresso</h1>

      {!temDados ? (
        <Vazio
          icone={<BarChart3 size={32} />}
          titulo="Ainda sem dados suficientes"
          descricao="Registre alguns treinos e os gráficos de evolução aparecem aqui."
          acao={
            <Link to="/app/treino">
              <Botao>Registrar treino</Botao>
            </Link>
          }
        />
      ) : (
        <>
          {comparativo && (
            <section>
              <TituloSecao titulo="Este mês vs. mês passado" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Estatistica
                  rotulo="Treinos"
                  valor={comparativo.mesAtual.treinos}
                  variacao={comparativo.variacao.treinos}
                />
                <Estatistica
                  rotulo="Volume"
                  valor={formatarVolume(comparativo.mesAtual.volume, unidade)}
                  variacao={comparativo.variacao.volume}
                />
                <Estatistica rotulo="Séries" valor={comparativo.mesAtual.series} variacao={comparativo.variacao.series} />
                <Estatistica
                  rotulo="Minutos"
                  valor={formatarNumero(comparativo.mesAtual.minutos, 0)}
                  variacao={comparativo.variacao.minutos}
                />
              </div>
            </section>
          )}

          <CartaoGrafico titulo="Volume semanal" descricao="Total levantado por semana (últimas 12 semanas)">
            <GraficoArea
              dados={(volume ?? []).map((s) => ({
                semana: formatarDataCurta(s.semana),
                volume: Math.round(paraUnidade(s.volume, unidade)),
              }))}
              chaveX="semana"
              chaveY="volume"
              formatador={(valor) => `${formatarNumero(valor, 0)} ${unidade}`}
            />
          </CartaoGrafico>

          <CartaoGrafico titulo="Frequência" descricao={`Média de ${formatarNumero(frequencia?.mediaSemanal ?? 0)} ${
              frequencia?.mediaSemanal === 1 ? 'treino' : 'treinos'
            } por semana`}>
            <GraficoBarras
              dados={(frequencia?.itens ?? []).map((m) => ({
                mes: `${m.mes.slice(5)}/${m.mes.slice(2, 4)}`,
                treinos: m.treinos,
              }))}
              chaveX="mes"
              chaveY="treinos"
              cor={COR_INFO}
              formatador={(valor) => plural(valor, 'treino')}
            />
          </CartaoGrafico>

          <section>
            <TituloSecao
              titulo="Distribuição por grupo muscular"
              descricao="Séries por grupo — ajuda a identificar desequilíbrios"
            />
            <Abas
              abas={[
                { valor: 30, rotulo: '30 dias' },
                { valor: 90, rotulo: '90 dias' },
                { valor: 365, rotulo: '1 ano' },
              ]}
              ativa={janelaGrupos}
              aoTrocar={setJanelaGrupos}
            />

            <div className="mt-3 flex flex-col gap-2.5">
              {grupos?.length ? (
                grupos.map((grupo) => (
                  <Cartao key={grupo.grupo} className="p-3.5">
                    <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 font-medium">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: corDoGrupo(grupo.grupo) }}
                          aria-hidden
                        />
                        {GRUPOS_MUSCULARES[grupo.grupo] ?? grupo.grupo}
                      </span>
                      <span className="text-texto-suave">
                        {plural(grupo.series, 'série')} · {formatarNumero(grupo.percentual)}%
                      </span>
                    </div>
                    <BarraProgresso
                      valor={grupo.percentual}
                      cor={corDoGrupo(grupo.grupo)}
                      rotulo={`${GRUPOS_MUSCULARES[grupo.grupo] ?? grupo.grupo}: ${grupo.percentual}%`}
                    />
                  </Cartao>
                ))
              ) : (
                <p className="text-sm text-texto-suave">Nenhum treino nesse período.</p>
              )}
            </div>
          </section>

          <section>
            <TituloSecao
              titulo="Recordes pessoais"
              acao={
                <Link to="/app/conquistas" className="text-sm font-medium text-primaria">
                  Ver tudo
                </Link>
              }
            />
            {recordes?.length ? (
              <div className="flex flex-col gap-2">
                {recordes.slice(0, 5).map((item) => (
                  <Link key={item.exercise.id} to={`/app/exercicios/${item.exercise.id}`}>
                    <Cartao className="flex items-center justify-between gap-3 p-3.5 transition-colors hover:border-primaria/40">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Trophy size={18} className="shrink-0 text-alerta" aria-hidden />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.exercise.name}</p>
                          <p className="text-sm text-texto-suave">
                            {GRUPOS_MUSCULARES[item.exercise.muscleGroup] ?? item.exercise.muscleGroup}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold">
                          {item.recordes.carga ? formatarVolume(item.recordes.carga.value, unidade) : '—'}
                        </p>
                        <p className="text-xs text-texto-suave">
                          {item.recordes['1rm'] ? `1RM ~${formatarVolume(item.recordes['1rm'].value, unidade)}` : ''}
                        </p>
                      </div>
                    </Cartao>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-texto-suave">Seus recordes aparecem aqui conforme você treina.</p>
            )}
          </section>

          <Link to="/app/medidas">
            <Cartao className="flex items-center justify-between gap-3 transition-colors hover:border-primaria/40">
              <div className="flex items-center gap-2.5">
                <TrendingUp size={20} className="text-primaria" aria-hidden />
                <div>
                  <p className="font-medium">Medidas corporais</p>
                  <p className="text-sm text-texto-suave">Peso, gordura e circunferências</p>
                </div>
              </div>
              <span aria-hidden>›</span>
            </Cartao>
          </Link>
        </>
      )}
    </div>
  );
}
