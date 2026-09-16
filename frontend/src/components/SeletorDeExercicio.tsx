import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Star } from 'lucide-react';
import { apiGet } from '../lib/api';
import { EQUIPAMENTOS, GRUPOS_MUSCULARES, corDoGrupo } from '../lib/constantes';
import type { Exercicio } from '../lib/tipos';
import { Campo, Carregando, Modal, Selecao, Vazio } from './ui';

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  aoEscolher: (exercicio: Exercicio) => void;
  titulo?: string;
}

/** Busca com filtros usada tanto no editor de rotina quanto durante o treino. */
export default function SeletorDeExercicio({ aberto, aoFechar, aoEscolher, titulo = 'Escolher exercício' }: Props) {
  const [busca, setBusca] = useState('');
  const [grupo, setGrupo] = useState('');
  const [equipamento, setEquipamento] = useState('');
  const [soFavoritos, setSoFavoritos] = useState(false);

  const parametros = useMemo(() => {
    const p = new URLSearchParams({ limite: '60' });
    if (busca.trim()) p.set('busca', busca.trim());
    if (grupo) p.set('grupo', grupo);
    if (equipamento) p.set('equipamento', equipamento);
    if (soFavoritos) p.set('favoritos', 'true');
    return p.toString();
  }, [busca, grupo, equipamento, soFavoritos]);

  const { data, isLoading } = useQuery({
    queryKey: ['exercicios', parametros],
    queryFn: () => apiGet<{ itens: Exercicio[]; total: number }>(`/exercicios?${parametros}`),
    enabled: aberto,
  });

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo={titulo} largo>
      <div className="flex flex-col gap-3">
        <Campo
          placeholder="Buscar exercício…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          autoFocus
          aria-label="Buscar exercício"
          sufixo={<Search size={18} />}
        />

        <div className="grid grid-cols-2 gap-2">
          <Selecao value={grupo} onChange={(e) => setGrupo(e.target.value)} aria-label="Filtrar por grupo muscular">
            <option value="">Todos os grupos</option>
            {Object.entries(GRUPOS_MUSCULARES).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </Selecao>
          <Selecao value={equipamento} onChange={(e) => setEquipamento(e.target.value)} aria-label="Filtrar por equipamento">
            <option value="">Todos os equipamentos</option>
            {Object.entries(EQUIPAMENTOS).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </Selecao>
        </div>

        <label className="flex items-center gap-2 text-sm text-texto-suave">
          <input
            type="checkbox"
            checked={soFavoritos}
            onChange={(e) => setSoFavoritos(e.target.checked)}
            className="h-4 w-4 rounded border-borda bg-superficie-2 text-primaria focus:ring-primaria"
          />
          Somente favoritos
        </label>

        {isLoading ? (
          <Carregando texto="Buscando exercícios…" />
        ) : data?.itens.length ? (
          <ul className="flex flex-col gap-1.5">
            {data.itens.map((exercicio) => (
              <li key={exercicio.id}>
                <button
                  type="button"
                  onClick={() => {
                    aoEscolher(exercicio);
                    aoFechar();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-borda bg-superficie-2 p-3 text-left transition-colors hover:border-primaria/50"
                >
                  <span
                    className="h-9 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: corDoGrupo(exercicio.muscleGroup) }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate font-medium">{exercicio.name}</span>
                      {exercicio.favorito && <Star size={14} className="shrink-0 fill-alerta text-alerta" aria-label="Favorito" />}
                    </span>
                    <span className="block truncate text-sm text-texto-suave">
                      {GRUPOS_MUSCULARES[exercicio.muscleGroup] ?? exercicio.muscleGroup} ·{' '}
                      {EQUIPAMENTOS[exercicio.equipment] ?? exercicio.equipment}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <Vazio titulo="Nenhum exercício encontrado" descricao="Tente outro termo ou limpe os filtros." />
        )}
      </div>
    </Modal>
  );
}
