import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Star } from 'lucide-react';
import { apiGet } from '../lib/api';
import { EQUIPAMENTOS, GRUPOS_MUSCULARES, corDoGrupo } from '../lib/constantes';
import type { Exercicio } from '../lib/tipos';
import { Botao, Campo, Carregando, Modal, Selecao, Vazio } from './ui';
import ModalNovoExercicio from './ModalNovoExercicio';

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
  // Começa pelos exercícios que a pessoa já usa — é quase sempre o que ela quer
  const [aba, setAba] = useState<'seus' | 'favoritos' | 'todos'>('seus');
  const [cadastrando, setCadastrando] = useState(false);

  const parametros = useMemo(() => {
    const p = new URLSearchParams({ limite: '60' });
    if (busca.trim()) p.set('busca', busca.trim());
    if (grupo) p.set('grupo', grupo);
    if (equipamento) p.set('equipamento', equipamento);
    if (aba === 'favoritos') p.set('favoritos', 'true');
    if (aba === 'seus') p.set('usados', 'true');
    return p.toString();
  }, [busca, grupo, equipamento, aba]);

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

        <div className="rolagem-oculta flex gap-2 overflow-x-auto">
          {(
            [
              { valor: 'seus', rotulo: 'Seus exercícios' },
              { valor: 'favoritos', rotulo: '★ Favoritos' },
              { valor: 'todos', rotulo: 'Todos' },
            ] as const
          ).map((opcao) => (
            <button
              key={opcao.valor}
              type="button"
              onClick={() => setAba(opcao.valor)}
              aria-pressed={aba === opcao.valor}
              className={`shrink-0 rounded-xl px-3.5 py-2 text-sm font-medium ${
                aba === opcao.valor
                  ? 'bg-primaria text-[#04140a]'
                  : 'border border-borda bg-superficie-2 text-texto-suave'
              }`}
            >
              {opcao.rotulo}
            </button>
          ))}
        </div>

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
          <Vazio
            titulo="Nenhum exercício encontrado"
            descricao={
              aba === 'seus'
                ? 'Você ainda não usou nenhum exercício. Procure em "Todos" ou cadastre o seu.'
                : 'Tente outro termo, limpe os filtros ou cadastre um exercício novo.'
            }
          />
        )}

        {/* Faltou o movimento na lista? Cadastra na hora e já usa */}
        <Botao
          variante="secundario"
          larguraTotal
          icone={<Plus size={18} />}
          onClick={() => setCadastrando(true)}
        >
          Cadastrar exercício novo
        </Botao>
      </div>

      <ModalNovoExercicio
        aberto={cadastrando}
        aoFechar={() => setCadastrando(false)}
        nomeInicial={busca.trim()}
        aoCriar={(exercicio) => {
          // Criou no meio do caminho: já entra na rotina/treino que estava montando
          aoEscolher(exercicio);
          aoFechar();
        }}
      />
    </Modal>
  );
}
