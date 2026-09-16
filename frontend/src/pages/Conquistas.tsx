import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Lock, Trophy } from 'lucide-react';
import { apiGet } from '../lib/api';
import { useUnidade } from '../lib/auth';
import { GRUPOS_MUSCULARES, TIPOS_PR } from '../lib/constantes';
import { formatarData, formatarPeso, plural } from '../lib/formato';
import type { Conquista, RecordeDoExercicio, TipoPr } from '../lib/tipos';
import { Cartao, Carregando, TituloSecao, Vazio } from '../components/ui';

export default function Conquistas() {
  const unidade = useUnidade();

  const { data: conquistas, isLoading } = useQuery({
    queryKey: ['conquistas'],
    queryFn: () => apiGet<{ obtidas: Conquista[]; bloqueadas: Conquista[] }>('/progresso/conquistas'),
  });

  const { data: recordes } = useQuery({
    queryKey: ['recordes'],
    queryFn: () => apiGet<RecordeDoExercicio[]>('/progresso/recordes'),
  });

  if (isLoading) return <Carregando />;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Recordes e conquistas</h1>

      <section>
        <TituloSecao
          titulo="Conquistas"
          descricao={`${conquistas?.obtidas.length ?? 0} de ${(conquistas?.obtidas.length ?? 0) + (conquistas?.bloqueadas.length ?? 0)} desbloqueadas`}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {conquistas?.obtidas.map((conquista) => (
            <Cartao key={conquista.code} className="border-primaria/40 p-3.5 text-center">
              <span className="text-3xl" aria-hidden>
                {conquista.icon}
              </span>
              <p className="mt-1.5 text-sm font-semibold">{conquista.title}</p>
              <p className="mt-0.5 text-xs text-texto-suave">{conquista.description}</p>
              {conquista.achievedAt && (
                <p className="mt-1 text-[11px] text-texto-suave">{formatarData(conquista.achievedAt)}</p>
              )}
            </Cartao>
          ))}

          {conquistas?.bloqueadas.map((conquista) => (
            <Cartao key={conquista.code} className="p-3.5 text-center opacity-60">
              <span className="relative inline-block text-3xl grayscale" aria-hidden>
                {conquista.icon}
                <Lock size={14} className="absolute -bottom-1 -right-1 text-texto-suave" />
              </span>
              <p className="mt-1.5 text-sm font-semibold">{conquista.title}</p>
              <p className="mt-0.5 text-xs text-texto-suave">{conquista.description}</p>
            </Cartao>
          ))}
        </div>
      </section>

      <section>
        <TituloSecao titulo="Quadro de recordes" descricao="Melhores marcas por exercício" />
        {recordes?.length ? (
          <div className="flex flex-col gap-2">
            {recordes.map((item) => (
              <Link key={item.exercise.id} to={`/app/exercicios/${item.exercise.id}`}>
                <Cartao className="p-3.5 transition-colors hover:border-primaria/40">
                  <div className="flex items-center gap-2">
                    <Trophy size={16} className="shrink-0 text-alerta" aria-hidden />
                    <h3 className="truncate font-medium">{item.exercise.name}</h3>
                    <span className="ml-auto shrink-0 text-xs text-texto-suave">
                      {GRUPOS_MUSCULARES[item.exercise.muscleGroup] ?? item.exercise.muscleGroup}
                    </span>
                  </div>

                  <dl className="mt-2 grid grid-cols-4 gap-2 text-center">
                    {(['carga', '1rm', 'volume', 'reps'] as TipoPr[]).map((tipo) => {
                      const recorde = item.recordes[tipo];
                      return (
                        <div key={tipo} className="rounded-lg bg-superficie-2 px-1 py-1.5">
                          <dt className="text-[11px] uppercase text-texto-suave">{TIPOS_PR[tipo]}</dt>
                          <dd className="text-sm font-semibold tabular-nums">
                            {recorde
                              ? tipo === 'reps'
                                ? recorde.value
                                : formatarPeso(recorde.value, unidade, false)
                              : '—'}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </Cartao>
              </Link>
            ))}
          </div>
        ) : (
          <Vazio
            titulo="Nenhum recorde ainda"
            descricao="Cada série concluída pode virar um recorde de carga, repetições, volume ou 1RM."
          />
        )}
      </section>

      {recordes && recordes.length > 0 && (
        <p className="text-center text-sm text-texto-suave">{plural(recordes.length, 'exercício')} com recorde registrado</p>
      )}
    </div>
  );
}
