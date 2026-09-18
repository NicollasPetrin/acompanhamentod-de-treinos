import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Dumbbell, Sparkles, Wand2 } from 'lucide-react';
import { apiGet, apiPatch, apiPost } from '../lib/api';
import { OBJETIVOS } from '../lib/constantes';
import { plural } from '../lib/formato';
import type { Rotina } from '../lib/tipos';
import { Botao, Campo, Cartao, Carregando, Distintivo } from '../components/ui';
import { useAvisos } from '../components/Notificacoes';

interface Template {
  slug: string;
  nome: string;
  descricao: string;
  objetivo: string;
  nivel: string;
  diasPorSemana: number;
  dias: Array<{ nome: string; exercicios: string[] }>;
}

/** Nomes usados quando a pessoa prefere montar tudo do zero. */
const NOMES_DOS_DIAS = ['Treino A', 'Treino B', 'Treino C', 'Treino D', 'Treino E', 'Treino F'];

/**
 * Assistente de criação de rotina.
 *
 * Três perguntas simples (quantos dias, qual objetivo, qual divisão) e a ficha
 * sai pronta — com exercícios, séries e descanso já preenchidos, ou com os dias
 * vazios para quem quer montar do próprio jeito.
 */
export default function AssistenteDeRotina() {
  const navegar = useNavigate();
  const queryClient = useQueryClient();
  const { sucesso, erro: avisarErro } = useAvisos();

  const [etapa, setEtapa] = useState(1);
  const [dias, setDias] = useState(3);
  const [objetivo, setObjetivo] = useState('hipertrofia');
  const [escolha, setEscolha] = useState<string | null>(null); // slug do modelo ou 'do-zero'
  const [nome, setNome] = useState('');
  const [ativar, setAtivar] = useState(true);

  const { data: modelos, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => apiGet<Template[]>('/rotinas/templates'),
  });

  /** Ordena os modelos por proximidade do que a pessoa respondeu. */
  const sugestoes = useMemo(() => {
    if (!modelos) return [];
    return [...modelos].sort((a, b) => {
      const perto = Math.abs(a.diasPorSemana - dias) - Math.abs(b.diasPorSemana - dias);
      if (perto !== 0) return perto;
      const objetivoA = a.objetivo === objetivo ? 0 : 1;
      const objetivoB = b.objetivo === objetivo ? 0 : 1;
      return objetivoA - objetivoB;
    });
  }, [modelos, dias, objetivo]);

  const modeloEscolhido = sugestoes.find((m) => m.slug === escolha);

  const criar = useMutation({
    mutationFn: async (): Promise<Rotina> => {
      let rotina: Rotina;

      if (escolha && escolha !== 'do-zero') {
        rotina = await apiPost<Rotina>(`/rotinas/templates/${escolha}/aplicar`);
        if (nome.trim() && nome.trim() !== rotina.name) {
          rotina = await apiPatch<Rotina>(`/rotinas/${rotina.id}`, { name: nome.trim(), goal: objetivo });
        }
      } else {
        // Do zero: já cria os dias nomeados, para a pessoa só adicionar exercícios
        rotina = await apiPost<Rotina>('/rotinas', {
          name: nome.trim() || 'Minha rotina',
          goal: objetivo,
          days: NOMES_DOS_DIAS.slice(0, dias).map((nomeDoDia) => ({ name: nomeDoDia, exercises: [] })),
        });
      }

      if (ativar) await apiPost(`/rotinas/${rotina.id}/ativar`);
      return rotina;
    },
    onSuccess: async (rotina) => {
      await queryClient.invalidateQueries();
      sucesso(
        escolha === 'do-zero'
          ? 'Rotina criada! Agora é só adicionar os exercícios de cada dia.'
          : 'Rotina criada e pronta para usar!',
      );
      navegar(`/app/rotinas/${rotina.id}`, { replace: true });
    },
    onError: () => avisarErro('Não foi possível criar a rotina'),
  });

  if (isLoading) return <Carregando texto="Preparando as sugestões…" />;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start gap-2">
        <button
          onClick={() => (etapa === 1 ? navegar('/app/rotinas') : setEtapa((e) => e - 1))}
          className="rounded-lg p-2 text-texto-suave hover:bg-superficie-2 hover:text-texto"
          aria-label="Voltar"
        >
          <ArrowLeft size={22} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <Wand2 size={20} className="text-primaria" aria-hidden />
            Criar rotina
          </h1>
          <p className="text-sm text-texto-suave">Passo {etapa} de 3</p>
        </div>
      </header>

      {/* Barra de progresso do assistente */}
      <div className="flex gap-1.5" aria-hidden>
        {[1, 2, 3].map((n) => (
          <div key={n} className={`h-1.5 flex-1 rounded-full ${n <= etapa ? 'bg-primaria' : 'bg-superficie-2'}`} />
        ))}
      </div>

      {etapa === 1 && (
        <section className="flex flex-col gap-5">
          <div>
            <h2 className="font-semibold">Quantos dias por semana você treina?</h2>
            <p className="mb-3 text-sm text-texto-suave">Dá para mudar depois, sem problema.</p>
            <div className="grid grid-cols-5 gap-2">
              {[2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  onClick={() => setDias(n)}
                  aria-pressed={dias === n}
                  className={`min-h-[64px] rounded-xl border text-lg font-bold transition-colors ${
                    dias === n
                      ? 'border-primaria bg-primaria text-sobre-primaria'
                      : 'border-borda bg-superficie-2 text-texto-suave'
                  }`}
                >
                  {n}x
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-semibold">Qual é o seu objetivo?</h2>
            <p className="mb-3 text-sm text-texto-suave">Usamos isso para sugerir a divisão.</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(OBJETIVOS).map(([valor, rotulo]) => (
                <button
                  key={valor}
                  onClick={() => setObjetivo(valor)}
                  aria-pressed={objetivo === valor}
                  className={`min-h-[52px] rounded-xl border px-3 text-sm font-medium transition-colors ${
                    objetivo === valor
                      ? 'border-primaria bg-primaria text-sobre-primaria'
                      : 'border-borda bg-superficie-2 text-texto-suave'
                  }`}
                >
                  {rotulo}
                </button>
              ))}
            </div>
          </div>

          <Botao tamanho="lg" larguraTotal onClick={() => setEtapa(2)}>
            Continuar
          </Botao>
        </section>
      )}

      {etapa === 2 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-semibold">Escolha um ponto de partida</h2>
            <p className="text-sm text-texto-suave">
              Para {plural(dias, 'dia', 'dias')} por semana, essas divisões costumam funcionar bem.
            </p>
          </div>

          {sugestoes.slice(0, 3).map((modelo, i) => (
            <button key={modelo.slug} onClick={() => setEscolha(modelo.slug)} className="text-left">
              <Cartao className={escolha === modelo.slug ? 'border-primaria' : undefined}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{modelo.nome}</h3>
                      {i === 0 && (
                        <Distintivo cor="primaria">
                          <Sparkles size={11} /> recomendado
                        </Distintivo>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-texto-suave">{modelo.descricao}</p>
                    <p className="mt-2 text-xs text-texto-suave">
                      {modelo.dias.map((d) => d.nome.split('—')[0].trim()).join(' · ')}
                    </p>
                  </div>
                  {escolha === modelo.slug && <Check size={20} className="shrink-0 text-primaria" aria-hidden />}
                </div>
              </Cartao>
            </button>
          ))}

          <button onClick={() => setEscolha('do-zero')} className="text-left">
            <Cartao className={escolha === 'do-zero' ? 'border-primaria' : undefined}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="flex items-center gap-2 font-semibold">
                    <Dumbbell size={17} className="text-primaria" aria-hidden />
                    Montar do meu jeito
                  </h3>
                  <p className="mt-1 text-sm text-texto-suave">
                    Criamos {plural(dias, 'dia de treino', 'dias de treino')} vazios e você escolhe cada exercício.
                  </p>
                </div>
                {escolha === 'do-zero' && <Check size={20} className="shrink-0 text-primaria" aria-hidden />}
              </div>
            </Cartao>
          </button>

          <Botao
            tamanho="lg"
            larguraTotal
            disabled={!escolha}
            onClick={() => {
              setNome(modeloEscolhido?.nome ?? 'Minha rotina');
              setEtapa(3);
            }}
          >
            Continuar
          </Botao>
        </section>
      )}

      {etapa === 3 && (
        <section className="flex flex-col gap-4">
          <div>
            <h2 className="font-semibold">Quase lá</h2>
            <p className="text-sm text-texto-suave">Dê um nome e confirme.</p>
          </div>

          <Campo
            rotulo="Nome da rotina"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Meu ABC"
          />

          <Cartao className="text-sm text-texto-suave">
            <p className="mb-2 font-medium text-texto">O que vai ser criado</p>
            {escolha === 'do-zero' ? (
              <ul className="flex flex-col gap-1">
                {NOMES_DOS_DIAS.slice(0, dias).map((dia) => (
                  <li key={dia}>• {dia} (sem exercícios ainda)</li>
                ))}
              </ul>
            ) : (
              <ul className="flex flex-col gap-1">
                {modeloEscolhido?.dias.map((dia) => (
                  <li key={dia.nome}>
                    • {dia.nome} — {plural(dia.exercicios.length, 'exercício')}
                  </li>
                ))}
              </ul>
            )}
          </Cartao>

          <label className="flex items-center gap-2.5 text-sm text-texto-suave">
            <input
              type="checkbox"
              checked={ativar}
              onChange={(e) => setAtivar(e.target.checked)}
              className="h-4 w-4 rounded border-borda bg-superficie-2 text-primaria focus:ring-primaria"
            />
            Usar como rotina ativa (aparece na tela inicial)
          </label>

          <Botao tamanho="lg" larguraTotal carregando={criar.isPending} onClick={() => criar.mutate()}>
            Criar rotina
          </Botao>
        </section>
      )}
    </div>
  );
}
