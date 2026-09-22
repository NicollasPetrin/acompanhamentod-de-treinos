import { useEffect, useState } from 'react';
import { BellRing, Send, Timer, Dumbbell } from 'lucide-react';
import { apiGet } from '../lib/api';
import {
  desligarNotificacoes,
  enviarTeste,
  estadoNotificacoes,
  lerPreferencias,
  ligarNotificacoes,
  salvarPreferencias,
  type EstadoNotificacoes,
  type PreferenciasNotificacao,
} from '../lib/notificacoes';
import { Botao, Cartao, TituloSecao } from './ui';
import { useAvisos } from './Notificacoes';

type Agendamento = 'qstash' | 'processo' | 'sem-agendador';

const EXPLICACAO: Partial<Record<EstadoNotificacoes, string>> = {
  'nao-suportado': 'Este navegador não recebe notificações. No iPhone, use o app instalado na Tela de Início (iOS 16.4 ou mais novo).',
  'instalar-primeiro':
    'No iPhone, as notificações só funcionam com o app na Tela de Início: no Safari, toque em Compartilhar → "Adicionar à Tela de Início" e abra o app por lá.',
  bloqueado:
    'As notificações estão bloqueadas para o app. No iPhone: Ajustes → Notificações → Treinos. No Android ou no computador: nas permissões do site.',
};

/** Seção das configurações: avisos do treino com o app fechado. */
export default function AjustesNotificacoes({ userId }: { userId: string }) {
  const { sucesso, avisar, erro } = useAvisos();
  const [estado, setEstado] = useState<EstadoNotificacoes | null>(null);
  const [prefs, setPrefs] = useState<PreferenciasNotificacao>(() => lerPreferencias(userId));
  const [agendamento, setAgendamento] = useState<Agendamento | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    setPrefs(lerPreferencias(userId));
    void estadoNotificacoes(userId).then(setEstado);
  }, [userId]);

  useEffect(() => {
    if (estado !== 'ligado') return;
    void apiGet<{ agendamento: Agendamento }>('/notificacoes/chave')
      .then((r) => setAgendamento(r.agendamento))
      .catch(() => undefined);
  }, [estado]);

  const mudarPreferencia = (campo: 'descanso' | 'retomada') => {
    const novas = { ...prefs, [campo]: !prefs[campo] };
    setPrefs(novas);
    salvarPreferencias(userId, novas);
  };

  // Chamado direto do toque: o iPhone só pergunta a permissão assim
  const ligar = async () => {
    setOcupado(true);
    try {
      const resultado = await ligarNotificacoes(userId);
      setEstado(resultado);
      setPrefs(lerPreferencias(userId));
      if (resultado === 'ligado') sucesso('Notificações ligadas neste aparelho.');
      else if (resultado === 'desligado') avisar('Sem permissão, não dá para mandar os avisos.');
    } catch {
      erro('Não foi possível ligar as notificações agora.');
    } finally {
      setOcupado(false);
    }
  };

  const desligar = async () => {
    setOcupado(true);
    try {
      await desligarNotificacoes(userId);
      setEstado('desligado');
      setPrefs(lerPreferencias(userId));
    } finally {
      setOcupado(false);
    }
  };

  const testar = async () => {
    setOcupado(true);
    try {
      const entregues = await enviarTeste();
      if (entregues > 0) sucesso('Enviamos uma notificação de teste.');
      else avisar('Nenhum aparelho recebeu. Tente desligar e ligar de novo.');
    } catch {
      erro('Não foi possível enviar o teste.');
    } finally {
      setOcupado(false);
    }
  };

  if (!estado) return null;
  const ligado = estado === 'ligado';

  return (
    <section>
      <TituloSecao titulo="Notificações do treino" descricao="Avisos com o app fechado ou o celular bloqueado" />
      <Cartao className="flex flex-col gap-4">
        {EXPLICACAO[estado] ? (
          <p className="text-sm text-texto-suave">{EXPLICACAO[estado]}</p>
        ) : (
          <>
            <div>
              <p className="rotulo flex items-center gap-2">
                <BellRing size={15} /> Neste aparelho
              </p>
              <Botao variante={ligado ? 'primario' : 'secundario'} carregando={ocupado} onClick={ligado ? desligar : ligar}>
                {ligado ? 'Ligadas' : 'Ativar notificações'}
              </Botao>
              <p className="mt-1.5 text-xs text-texto-suave">
                {ligado
                  ? 'Com o app na tela, quem avisa é o próprio cronômetro, com som e vibração.'
                  : 'Você escolhe abaixo o que quer receber. Com o app aberto, nada aparece.'}
              </p>
            </div>

            {ligado && (
              <>
                <Opcao
                  icone={<Timer size={15} />}
                  titulo="Descanso acabou"
                  descricao="Com som, na hora em que o descanso termina."
                  ligada={prefs.descanso}
                  aoMudar={() => mudarPreferencia('descanso')}
                />
                <Opcao
                  icone={<Dumbbell size={15} />}
                  titulo="Treino em andamento"
                  descricao="Sem som, ao bloquear o celular no meio do treino. Um toque volta para ele."
                  ligada={prefs.retomada}
                  aoMudar={() => mudarPreferencia('retomada')}
                />
                <Botao variante="secundario" icone={<Send size={16} />} disabled={ocupado} onClick={testar}>
                  Enviar teste
                </Botao>
                {agendamento === 'sem-agendador' && (
                  <p className="rounded-xl bg-superficie-2 p-3 text-xs text-texto-suave">
                    Neste servidor, o aviso de fim do descanso com o app fechado pode atrasar. Quem cuida do servidor
                    pode ligar o agendador gratuito (QStash) — veja “Notificações” no README.
                  </p>
                )}
              </>
            )}
          </>
        )}
      </Cartao>
    </section>
  );
}

function Opcao({
  icone, titulo, descricao, ligada, aoMudar,
}: { icone: React.ReactNode; titulo: string; descricao: string; ligada: boolean; aoMudar: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-medium">
          {icone} {titulo}
        </p>
        <p className="text-xs text-texto-suave">{descricao}</p>
      </div>
      <button
        role="switch"
        aria-checked={ligada}
        aria-label={titulo}
        onClick={aoMudar}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${ligada ? 'bg-primaria' : 'bg-superficie-2 border border-borda'}`}
      >
        <span
          className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow transition-all ${ligada ? 'left-6' : 'left-1'}`}
        />
      </button>
    </div>
  );
}
