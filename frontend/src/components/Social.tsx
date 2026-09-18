/** Peças reutilizadas pelas telas de amigos e grupos. */
import { Clock, Dumbbell, Trophy, Weight } from 'lucide-react';
import clsx from 'clsx';
import { urlDeMidia } from '../lib/api';
import { GRUPOS_MUSCULARES } from '../lib/constantes';
import { formatarDataRelativa, formatarMinutos, formatarVolume, plural } from '../lib/formato';
import type { PessoaPublica, TreinoDoMural, Unidade } from '../lib/tipos';
import { Cartao, Distintivo } from './ui';

const TAMANHOS = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

/** Foto da pessoa ou a inicial do nome, quando não há foto. */
export function Avatar({
  pessoa,
  tamanho = 'md',
  className,
}: {
  pessoa: PessoaPublica;
  tamanho?: keyof typeof TAMANHOS;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-superficie-2 font-semibold text-texto-suave',
        TAMANHOS[tamanho],
        className,
      )}
      aria-hidden
    >
      {pessoa.photoUrl ? (
        <img src={urlDeMidia(pessoa.photoUrl)} alt="" className="h-full w-full object-cover" />
      ) : (
        pessoa.name.charAt(0).toUpperCase()
      )}
    </div>
  );
}

/**
 * Um treino no mural do grupo. Só mostra o resumo — carga série a série
 * continua sendo assunto de quem treinou.
 */
export function TreinoNoMural({
  treino,
  unidade,
  mostrarGrupo,
}: {
  treino: TreinoDoMural;
  unidade: Unidade;
  mostrarGrupo?: boolean;
}) {
  return (
    <Cartao className="flex gap-3">
      <Avatar pessoa={treino.pessoa} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <p className="font-semibold">{treino.pessoa.name}</p>
          <p className="text-xs text-texto-suave">{formatarDataRelativa(treino.data)}</p>
        </div>

        <p className="mt-0.5 truncate text-sm text-texto-suave">
          {treino.nome}
          {mostrarGrupo && treino.grupo && ` · ${treino.grupo.name}`}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-texto-suave">
          <span className="inline-flex items-center gap-1">
            <Dumbbell size={13} aria-hidden />
            {plural(treino.exercicios, 'exercício')} · {plural(treino.series, 'série')}
          </span>
          {treino.volume > 0 && (
            <span className="inline-flex items-center gap-1">
              <Weight size={13} aria-hidden />
              {formatarVolume(treino.volume, unidade)}
            </span>
          )}
          {/* abaixo de um minuto o tempo não diz nada — melhor omitir */}
          {treino.duracaoSec && treino.duracaoSec >= 60 ? (
            <span className="inline-flex items-center gap-1">
              <Clock size={13} aria-hidden />
              {formatarMinutos(treino.duracaoSec)}
            </span>
          ) : null}
        </div>

        {(treino.recordes > 0 || treino.gruposMusculares.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {treino.recordes > 0 && (
              <Distintivo cor="alerta">
                <Trophy size={12} aria-hidden />
                {treino.recordes === 1 ? '1 recorde' : `${treino.recordes} recordes`}
              </Distintivo>
            )}
            {treino.gruposMusculares.slice(0, 3).map((g) => (
              <Distintivo key={g}>{GRUPOS_MUSCULARES[g] ?? g}</Distintivo>
            ))}
          </div>
        )}
      </div>
    </Cartao>
  );
}
