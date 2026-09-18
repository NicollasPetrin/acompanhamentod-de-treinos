import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, CalendarDays, Dumbbell, Flame, GraduationCap, Play, Timer, TrendingUp, Users, Wand2, X,
} from 'lucide-react';
import { apiGet, urlDeMidia } from '../lib/api';
import { useAuth, useUnidade } from '../lib/auth';
import { formatarDataRelativa, formatarMinutos, formatarVolume, plural } from '../lib/formato';
import { GRUPOS_MUSCULARES } from '../lib/constantes';
import type { Meta, ResumoHome, TreinoDoMural } from '../lib/tipos';
import { Botao, Cartao, Carregando, Distintivo, Estatistica, TituloSecao, Vazio, BarraProgresso } from '../components/ui';
import { TreinoNoMural } from '../components/Social';

const saudacao = () => {
  const hora = new Date().getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
};

const CHAVE_BOAS_VINDAS = 'treinos.boas-vindas-dispensadas';

export default function Inicio() {
  const { usuario } = useAuth();
  const unidade = useUnidade();
  const navegar = useNavigate();
  const [boasVindasDispensadas, setBoasVindasDispensadas] = useState(
    () => localStorage.getItem(CHAVE_BOAS_VINDAS) === 'sim',
  );

  const { data: resumo, isLoading } = useQuery({
    queryKey: ['resumo-home'],
    queryFn: () => apiGet<ResumoHome>('/progresso/resumo'),
  });

  const { data: metas } = useQuery({
    queryKey: ['metas', 'abertas'],
    queryFn: () => apiGet<Meta[]>('/metas?abertas=true'),
  });

  // Treinos que os amigos terminaram — só aparece para quem está em algum grupo
  const { data: atividade } = useQuery({
    queryKey: ['atividade-dos-grupos'],
    queryFn: () => apiGet<TreinoDoMural[]>('/grupos/atividade?limite=3'),
  });

  if (isLoading) return <Carregando />;

  const primeiroNome = (usuario?.name ?? '').split(' ')[0];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-texto-suave">{saudacao()},</p>
          <h1 className="text-2xl font-bold">{primeiroNome} 💪</h1>
        </div>
        <Link to="/app/configuracoes" aria-label="Perfil e configurações">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-borda bg-superficie-2 font-semibold">
            {usuario?.photoUrl ? (
              <img src={urlDeMidia(usuario.photoUrl)} alt="" className="h-full w-full object-cover" />
            ) : (
              primeiroNome.charAt(0).toUpperCase()
            )}
          </div>
        </Link>
      </header>

      {/* Quem está começando vê o caminho das pedras antes de qualquer número */}
      {!resumo?.rotinaAtiva && !resumo?.totalTreinos && !boasVindasDispensadas && (
        <Cartao className="border-primaria/50 bg-primaria/5">
          <div className="flex items-start justify-between gap-2">
            <h2 className="font-semibold">Bem-vindo! Vamos montar seu primeiro treino?</h2>
            <button
              onClick={() => {
                localStorage.setItem(CHAVE_BOAS_VINDAS, 'sim');
                setBoasVindasDispensadas(true);
              }}
              className="shrink-0 rounded-lg p-1.5 text-texto-suave hover:bg-superficie-2 hover:text-texto"
              aria-label="Dispensar boas-vindas"
            >
              <X size={18} />
            </button>
          </div>
          <p className="mt-1 text-sm text-texto-suave">
            O assistente pergunta quantos dias você treina e já deixa a ficha pronta — leva menos de um minuto.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Link to="/app/rotinas/nova" className="w-full">
              <Botao larguraTotal icone={<Wand2 size={18} />}>
                Criar minha rotina
              </Botao>
            </Link>
            <Link to="/app/ajuda" className="w-full">
              <Botao variante="secundario" larguraTotal icone={<GraduationCap size={18} />}>
                Ver como funciona
              </Botao>
            </Link>
          </div>
          <p className="mt-3 text-sm text-texto-suave">
            Treina com os amigos?{' '}
            <Link to="/app/grupos" className="inline-flex items-center gap-1 font-medium text-primaria">
              <Users size={14} aria-hidden />
              Crie um grupo
            </Link>{' '}
            e os treinos de todo mundo aparecem juntos.
          </p>
        </Cartao>
      )}

      {/* Treino em andamento tem prioridade sobre tudo */}
      {resumo?.treinoEmAndamento && (
        <Cartao className="border-primaria/50 bg-primaria/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Distintivo cor="primaria">Em andamento</Distintivo>
              <h2 className="mt-2 font-semibold">{resumo.treinoEmAndamento.name}</h2>
              <p className="text-sm text-texto-suave">
                Começou {formatarDataRelativa(resumo.treinoEmAndamento.startedAt)}
              </p>
            </div>
            <Botao onClick={() => navegar(`/app/treino/${resumo.treinoEmAndamento!.id}`)} icone={<Play size={18} />}>
              Retomar
            </Botao>
          </div>
        </Cartao>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Estatistica
          rotulo="Sequência"
          valor={`${resumo?.streak ?? 0} ${resumo?.streak === 1 ? 'dia' : 'dias'}`}
          icone={<Flame size={16} />}
          cor={resumo?.streak ? 'rgb(var(--cor-primaria))' : undefined}
        />
        <Estatistica rotulo="Na semana" valor={plural(resumo?.semana.treinos ?? 0, 'treino')} icone={<CalendarDays size={16} />} />
        <Estatistica rotulo="Volume" valor={formatarVolume(resumo?.semana.volume ?? 0, unidade)} icone={<TrendingUp size={16} />} />
        <Estatistica rotulo="Tempo" valor={formatarMinutos((resumo?.semana.minutos ?? 0) * 60)} icone={<Timer size={16} />} />
      </section>

      <section>
        <TituloSecao
          titulo="Rotina ativa"
          acao={
            <Link to="/app/rotinas" className="text-sm font-medium text-primaria">
              Ver todas
            </Link>
          }
        />

        {resumo?.rotinaAtiva ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-texto-suave">{resumo.rotinaAtiva.name}</p>
            {resumo.rotinaAtiva.dias.map((dia) => {
              const sugerido = resumo.proximoTreino?.id === dia.id;
              return (
                <Cartao
                  key={dia.id}
                  className={`flex items-center justify-between gap-3 ${sugerido ? 'border-primaria/50' : ''}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-semibold">{dia.name}</h3>
                      {sugerido && <Distintivo cor="primaria">Próximo</Distintivo>}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-texto-suave">
                      {plural(dia.exercicios, 'exercício')}
                      {dia.grupos.length > 0 && ` · ${dia.grupos.map((g) => GRUPOS_MUSCULARES[g] ?? g).join(', ')}`}
                    </p>
                  </div>
                  <Botao
                    tamanho="sm"
                    variante={sugerido ? 'primario' : 'secundario'}
                    icone={<Play size={16} />}
                    onClick={() => navegar(`/app/treino?dia=${dia.id}`)}
                  >
                    Iniciar
                  </Botao>
                </Cartao>
              );
            })}
          </div>
        ) : (
          <Vazio
            icone={<Dumbbell size={32} />}
            titulo="Nenhuma rotina ativa"
            descricao="Crie sua ficha de treino ou comece por um modelo pronto (ABC, Push/Pull/Legs, Full Body…)."
            acao={
              <Link to="/app/rotinas/nova">
                <Botao icone={<Wand2 size={18} />}>Criar com o assistente</Botao>
              </Link>
            }
          />
        )}

        <Botao
          variante="secundario"
          larguraTotal
          className="mt-3"
          icone={<Activity size={18} />}
          onClick={() => navegar('/app/treino')}
        >
          Treino livre (sem rotina)
        </Botao>
      </section>

      {atividade && atividade.length > 0 && (
        <section>
          <TituloSecao
            titulo="A galera treinou"
            acao={
              <Link to="/app/grupos" className="text-sm font-medium text-primaria">
                Ver grupos
              </Link>
            }
          />
          <div className="flex flex-col gap-2">
            {atividade.map((treino) => (
              <TreinoNoMural key={treino.id} treino={treino} unidade={unidade} mostrarGrupo />
            ))}
          </div>
        </section>
      )}

      {metas && metas.length > 0 && (
        <section>
          <TituloSecao
            titulo="Metas em andamento"
            acao={
              <Link to="/app/metas" className="text-sm font-medium text-primaria">
                Ver todas
              </Link>
            }
          />
          <div className="flex flex-col gap-3">
            {metas.slice(0, 3).map((meta) => (
              <Cartao key={meta.id} className="p-3.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{meta.title}</p>
                  <span className="shrink-0 text-sm text-texto-suave">{Math.round(meta.progress)}%</span>
                </div>
                <BarraProgresso valor={meta.progress} rotulo={meta.title} />
              </Cartao>
            ))}
          </div>
        </section>
      )}

      <section>
        <TituloSecao
          titulo="Últimos treinos"
          acao={
            <Link to="/app/historico" className="text-sm font-medium text-primaria">
              Histórico
            </Link>
          }
        />
        {resumo?.ultimosTreinos.length ? (
          <div className="flex flex-col gap-2">
            {resumo.ultimosTreinos.map((treino) => (
              <Link key={treino.id} to={`/app/historico/${treino.id}`}>
                <Cartao className="flex items-center justify-between gap-3 p-3.5 transition-colors hover:border-primaria/40">
                  <div className="min-w-0">
                    <h3 className="truncate font-medium">{treino.name}</h3>
                    <p className="text-sm text-texto-suave">
                      {formatarDataRelativa(treino.startedAt)} · {plural(treino.totalSets, 'série')}
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
          <Vazio titulo="Nenhum treino registrado ainda" descricao="Seu primeiro treino aparece aqui assim que você finalizar." />
        )}
      </section>
    </div>
  );
}
