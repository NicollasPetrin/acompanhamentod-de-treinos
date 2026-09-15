import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { apiGet } from '../lib/api';
import { useUnidade } from '../lib/auth';
import { MESES, chaveDoDia, formatarDataRelativa, formatarMinutos, formatarVolume, plural, primeiraMaiuscula } from '../lib/formato';
import type { Treino } from '../lib/tipos';
import { Cartao, Carregando, TituloSecao, Vazio } from '../components/ui';

interface Calendario {
  mes: string;
  dias: Record<string, Array<{ id: string; name: string; durationSec: number | null; totalVolume: number }>>;
}

export default function Historico() {
  const unidade = useUnidade();
  const [referencia, setReferencia] = useState(() => new Date());

  const chaveMes = `${referencia.getFullYear()}-${String(referencia.getMonth() + 1).padStart(2, '0')}`;

  const { data: calendario } = useQuery({
    queryKey: ['calendario', chaveMes],
    queryFn: () => apiGet<Calendario>(`/treinos/calendario?mes=${chaveMes}`),
  });

  const { data: historico, isLoading } = useQuery({
    queryKey: ['historico'],
    queryFn: () => apiGet<{ itens: Treino[]; total: number }>('/treinos?limite=30'),
  });

  // Matriz do calendário começando na segunda-feira
  const semanas = useMemo(() => {
    const primeiro = new Date(referencia.getFullYear(), referencia.getMonth(), 1);
    const ultimo = new Date(referencia.getFullYear(), referencia.getMonth() + 1, 0);
    const deslocamento = (primeiro.getDay() + 6) % 7;

    const celulas: Array<Date | null> = Array.from({ length: deslocamento }, () => null);
    for (let dia = 1; dia <= ultimo.getDate(); dia++) {
      celulas.push(new Date(referencia.getFullYear(), referencia.getMonth(), dia));
    }
    while (celulas.length % 7 !== 0) celulas.push(null);

    return Array.from({ length: celulas.length / 7 }, (_, i) => celulas.slice(i * 7, i * 7 + 7));
  }, [referencia]);

  const hoje = chaveDoDia(new Date());
  const mudarMes = (delta: number) =>
    setReferencia((atual) => new Date(atual.getFullYear(), atual.getMonth() + delta, 1));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Histórico</h1>

      <section>
        <Cartao>
          <div className="mb-3 flex items-center justify-between">
            <button
              onClick={() => mudarMes(-1)}
              className="rounded-lg p-2 text-texto-suave hover:bg-superficie-2 hover:text-texto"
              aria-label="Mês anterior"
            >
              <ChevronLeft size={20} />
            </button>
            <h2 className="font-semibold">
              {primeiraMaiuscula(MESES[referencia.getMonth()])} de {referencia.getFullYear()}
            </h2>
            <button
              onClick={() => mudarMes(1)}
              className="rounded-lg p-2 text-texto-suave hover:bg-superficie-2 hover:text-texto"
              aria-label="Próximo mês"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs text-texto-suave">
            {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((dia, i) => (
              <span key={i} className="py-1" aria-hidden>
                {dia}
              </span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {semanas.flat().map((dia, i) => {
              if (!dia) return <span key={`vazio-${i}`} />;
              const chave = chaveDoDia(dia);
              const treinos = calendario?.dias[chave] ?? [];
              const treinou = treinos.length > 0;

              const conteudo = (
                <div
                  className={clsx(
                    'flex aspect-square flex-col items-center justify-center rounded-lg text-sm transition-colors',
                    treinou ? 'bg-primaria/20 font-semibold text-primaria' : 'text-texto-suave',
                    chave === hoje && 'ring-1 ring-primaria',
                  )}
                >
                  {dia.getDate()}
                  {treinou && <span className="mt-0.5 h-1 w-1 rounded-full bg-primaria" aria-hidden />}
                </div>
              );

              return treinou ? (
                <Link
                  key={chave}
                  to={`/app/historico/${treinos[0].id}`}
                  aria-label={`${dia.getDate()} — ${treinos.map((t) => t.name).join(', ')}`}
                >
                  {conteudo}
                </Link>
              ) : (
                <div key={chave}>{conteudo}</div>
              );
            })}
          </div>

          <p className="mt-3 text-center text-sm text-texto-suave">
            {plural(Object.keys(calendario?.dias ?? {}).length, 'dia treinado', 'dias treinados')} neste mês
          </p>
        </Cartao>
      </section>

      <section>
        <TituloSecao titulo="Treinos recentes" />
        {isLoading ? (
          <Carregando />
        ) : historico?.itens.length ? (
          <div className="flex flex-col gap-2">
            {historico.itens.map((treino) => (
              <Link key={treino.id} to={`/app/historico/${treino.id}`}>
                <Cartao className="flex items-center justify-between gap-3 p-3.5 transition-colors hover:border-primaria/40">
                  <div className="min-w-0">
                    <h3 className="truncate font-medium">{treino.name}</h3>
                    <p className="text-sm text-texto-suave">
                      {formatarDataRelativa(treino.startedAt)} ·{' '}
                      {plural(treino.exercises.length, 'exercício')} · {plural(treino.totalSets, 'série')}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold">{formatarVolume(treino.totalVolume, unidade)}</p>
                    <p className="text-xs text-texto-suave">{formatarMinutos(treino.durationSec ?? 0)}</p>
                  </div>
                </Cartao>
              </Link>
            ))}
          </div>
        ) : (
          <Vazio
            icone={<CalendarDays size={32} />}
            titulo="Nenhum treino no histórico"
            descricao="Finalize seu primeiro treino para começar a acompanhar a evolução."
          />
        )}
      </section>
    </div>
  );
}
