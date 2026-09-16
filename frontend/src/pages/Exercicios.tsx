import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Star } from 'lucide-react';
import { apiDelete, apiGet, apiPost, urlDeMidia } from '../lib/api';
import { EQUIPAMENTOS, GRUPOS_MUSCULARES, TIPOS_EXERCICIO, corDoGrupo } from '../lib/constantes';
import { formatarDataRelativa, plural } from '../lib/formato';
import type { Exercicio } from '../lib/tipos';
import { Botao, Campo, Cartao, Carregando, Distintivo, Selecao, Vazio } from '../components/ui';
import ModalNovoExercicio from '../components/ModalNovoExercicio';

type Aba = 'seus' | 'favoritos' | 'todos';

export default function Exercicios() {
  const queryClient = useQueryClient();

  const [busca, setBusca] = useState('');
  const [grupo, setGrupo] = useState('');
  const [equipamento, setEquipamento] = useState('');
  const [tipo, setTipo] = useState('');
  // Começa pelos exercícios do usuário: a biblioteca inteira tem 178 itens e
  // quase nunca é o que ele procura no dia a dia.
  const [filtro, setFiltro] = useState<Aba>('seus');
  const [criando, setCriando] = useState(false);

  const parametros = useMemo(() => {
    const p = new URLSearchParams({ limite: '100' });
    if (busca.trim()) p.set('busca', busca.trim());
    if (grupo) p.set('grupo', grupo);
    if (equipamento) p.set('equipamento', equipamento);
    if (tipo) p.set('tipo', tipo);
    if (filtro === 'favoritos') p.set('favoritos', 'true');
    if (filtro === 'seus') p.set('usados', 'true');
    return p.toString();
  }, [busca, grupo, equipamento, tipo, filtro]);

  const { data, isLoading } = useQuery({
    queryKey: ['exercicios', parametros],
    queryFn: () => apiGet<{ itens: Exercicio[]; total: number }>(`/exercicios?${parametros}`),
  });

  const favoritar = useMutation({
    mutationFn: ({ id, favorito }: { id: string; favorito: boolean }) =>
      favorito ? apiDelete(`/exercicios/${id}/favorito`) : apiPost(`/exercicios/${id}/favorito`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exercicios'] }),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Exercícios</h1>
        <Botao icone={<Plus size={18} />} onClick={() => setCriando(true)}>
          Cadastrar
        </Botao>
      </div>

      <Campo
        placeholder="Buscar exercício…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        aria-label="Buscar exercício"
        sufixo={<Search size={18} />}
      />

      <div className="rolagem-oculta -mx-4 flex gap-2 overflow-x-auto px-4">
        {(
          [
            { valor: 'seus', rotulo: 'Seus exercícios' },
            { valor: 'favoritos', rotulo: '★ Favoritos' },
            { valor: 'todos', rotulo: 'Todos' },
          ] as const
        ).map((opcao) => (
          <button
            key={opcao.valor}
            onClick={() => setFiltro(opcao.valor)}
            className={`shrink-0 rounded-xl px-3.5 py-2 text-sm font-medium ${
              filtro === opcao.valor ? 'bg-primaria text-[#04140a]' : 'border border-borda bg-superficie-2 text-texto-suave'
            }`}
          >
            {opcao.rotulo}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Selecao value={grupo} onChange={(e) => setGrupo(e.target.value)} aria-label="Grupo muscular">
          <option value="">Grupo</option>
          {Object.entries(GRUPOS_MUSCULARES).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </Selecao>
        <Selecao value={equipamento} onChange={(e) => setEquipamento(e.target.value)} aria-label="Equipamento">
          <option value="">Equipamento</option>
          {Object.entries(EQUIPAMENTOS).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </Selecao>
        <Selecao value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo">
          <option value="">Tipo</option>
          {Object.entries(TIPOS_EXERCICIO).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </Selecao>
      </div>

      {isLoading ? (
        <Carregando />
      ) : data?.itens.length ? (
        <>
          <p className="text-sm text-texto-suave">{plural(data.total, 'exercício')}</p>
          <ul className="flex flex-col gap-2">
            {data.itens.map((exercicio) => (
              <li key={exercicio.id}>
                <Cartao className="flex items-center gap-3 p-3 transition-colors hover:border-primaria/40">
                  <Link to={`/app/exercicios/${exercicio.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <img
                      src={urlDeMidia(exercicio.imageUrl)}
                      alt=""
                      loading="lazy"
                      className="h-14 w-14 shrink-0 rounded-xl bg-superficie-2 object-cover"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate font-medium">{exercicio.name}</p>
                        {exercicio.personalizado && <Distintivo cor="info">meu</Distintivo>}
                      </div>
                      <p className="truncate text-sm text-texto-suave">
                        <span
                          className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                          style={{ backgroundColor: corDoGrupo(exercicio.muscleGroup) }}
                          aria-hidden
                        />
                        {GRUPOS_MUSCULARES[exercicio.muscleGroup] ?? exercicio.muscleGroup} ·{' '}
                        {EQUIPAMENTOS[exercicio.equipment] ?? exercicio.equipment}
                      </p>
                      {exercicio.usos !== undefined && (
                        <p className="truncate text-xs text-texto-suave">
                          {exercicio.usos > 0
                            ? `${plural(exercicio.usos, 'treino')}${
                                exercicio.ultimoUso ? ` · última vez ${formatarDataRelativa(exercicio.ultimoUso)}` : ''
                              }`
                            : 'ainda não treinado'}
                        </p>
                      )}
                    </div>
                  </Link>

                  <button
                    onClick={() => favoritar.mutate({ id: exercicio.id, favorito: Boolean(exercicio.favorito) })}
                    className="shrink-0 rounded-lg p-2.5 text-texto-suave hover:bg-superficie-2"
                    aria-label={exercicio.favorito ? `Desfavoritar ${exercicio.name}` : `Favoritar ${exercicio.name}`}
                    aria-pressed={Boolean(exercicio.favorito)}
                  >
                    <Star size={20} className={exercicio.favorito ? 'fill-alerta text-alerta' : ''} />
                  </button>
                </Cartao>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <Vazio
          titulo={filtro === 'seus' ? 'Você ainda não usou nenhum exercício' : 'Nenhum exercício encontrado'}
          descricao={
            filtro === 'seus'
              ? 'Aqui ficam os exercícios que você treina, os que estão nas suas rotinas e os que você cadastrar. Procure na biblioteca ou crie o seu.'
              : 'Ajuste os filtros ou crie um exercício personalizado.'
          }
          acao={
            <div className="flex flex-wrap justify-center gap-2">
              <Botao icone={<Plus size={18} />} onClick={() => setCriando(true)}>
                Cadastrar exercício
              </Botao>
              {filtro === 'seus' && (
                <Botao variante="secundario" onClick={() => setFiltro('todos')}>
                  Ver a biblioteca
                </Botao>
              )}
            </div>
          }
        />
      )}

      <ModalNovoExercicio aberto={criando} aoFechar={() => setCriando(false)} nomeInicial={busca.trim()} />
    </div>
  );
}
