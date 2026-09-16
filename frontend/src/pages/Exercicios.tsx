import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Star } from 'lucide-react';
import { apiDelete, apiGet, apiPost, urlDeMidia } from '../lib/api';
import { EQUIPAMENTOS, GRUPOS_MUSCULARES, TIPOS_EXERCICIO, corDoGrupo } from '../lib/constantes';
import { plural } from '../lib/formato';
import type { Exercicio } from '../lib/tipos';
import { AreaTexto, Botao, Campo, Cartao, Carregando, Distintivo, Modal, Selecao, Vazio } from '../components/ui';
import { useAvisos } from '../components/Notificacoes';

export default function Exercicios() {
  const queryClient = useQueryClient();
  const { sucesso, erro: avisarErro } = useAvisos();

  const [busca, setBusca] = useState('');
  const [grupo, setGrupo] = useState('');
  const [equipamento, setEquipamento] = useState('');
  const [tipo, setTipo] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'favoritos' | 'meus'>('todos');
  const [criando, setCriando] = useState(false);
  const [novo, setNovo] = useState({
    name: '',
    muscleGroup: 'peito',
    equipment: 'barra',
    type: 'forca',
    instructions: '',
  });

  const parametros = useMemo(() => {
    const p = new URLSearchParams({ limite: '100' });
    if (busca.trim()) p.set('busca', busca.trim());
    if (grupo) p.set('grupo', grupo);
    if (equipamento) p.set('equipamento', equipamento);
    if (tipo) p.set('tipo', tipo);
    if (filtro === 'favoritos') p.set('favoritos', 'true');
    if (filtro === 'meus') p.set('meus', 'true');
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

  const criar = useMutation({
    mutationFn: () => apiPost<Exercicio>('/exercicios', { ...novo, secondaryMuscles: [] }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['exercicios'] });
      setCriando(false);
      setNovo({ name: '', muscleGroup: 'peito', equipment: 'barra', type: 'forca', instructions: '' });
      sucesso('Exercício criado!');
    },
    onError: () => avisarErro('Não foi possível criar o exercício'),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Exercícios</h1>
        <Botao icone={<Plus size={18} />} onClick={() => setCriando(true)}>
          Criar
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
            { valor: 'todos', rotulo: 'Todos' },
            { valor: 'favoritos', rotulo: '★ Favoritos' },
            { valor: 'meus', rotulo: 'Meus exercícios' },
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
          titulo="Nenhum exercício encontrado"
          descricao="Ajuste os filtros ou crie um exercício personalizado."
          acao={
            <Botao icone={<Plus size={18} />} onClick={() => setCriando(true)}>
              Criar exercício
            </Botao>
          }
        />
      )}

      <Modal
        aberto={criando}
        aoFechar={() => setCriando(false)}
        titulo="Novo exercício"
        rodape={
          <div className="flex gap-2">
            <Botao variante="secundario" larguraTotal onClick={() => setCriando(false)}>
              Cancelar
            </Botao>
            <Botao
              larguraTotal
              carregando={criar.isPending}
              disabled={novo.name.trim().length < 2}
              onClick={() => criar.mutate()}
            >
              Criar
            </Botao>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Campo
            rotulo="Nome"
            autoFocus
            placeholder="Ex.: Supino com pegada neutra"
            value={novo.name}
            onChange={(e) => setNovo((n) => ({ ...n, name: e.target.value }))}
          />
          <Selecao
            rotulo="Grupo muscular"
            value={novo.muscleGroup}
            onChange={(e) => setNovo((n) => ({ ...n, muscleGroup: e.target.value }))}
          >
            {Object.entries(GRUPOS_MUSCULARES).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </Selecao>
          <Selecao
            rotulo="Equipamento"
            value={novo.equipment}
            onChange={(e) => setNovo((n) => ({ ...n, equipment: e.target.value }))}
          >
            {Object.entries(EQUIPAMENTOS).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </Selecao>
          <Selecao rotulo="Tipo" value={novo.type} onChange={(e) => setNovo((n) => ({ ...n, type: e.target.value }))}>
            {Object.entries(TIPOS_EXERCICIO).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </Selecao>
          <AreaTexto
            rotulo="Instruções de execução"
            placeholder="Como executar o movimento…"
            value={novo.instructions}
            onChange={(e) => setNovo((n) => ({ ...n, instructions: e.target.value }))}
          />
        </div>
      </Modal>
    </div>
  );
}
