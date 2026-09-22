import { useEffect, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { estadoNotificacoes, ligarNotificacoes, type EstadoNotificacoes } from '../lib/notificacoes';
import { useAvisos } from './Notificacoes';

const chaveDispensado = (userId: string) => `treinos.convite-notificacoes.${userId}`;

function foiDispensado(userId: string) {
  try {
    return localStorage.getItem(chaveDispensado(userId)) === '1';
  } catch {
    return false;
  }
}

/**
 * Convite, dentro do cronômetro de descanso, para ligar as notificações — é
 * ali que a pessoa entende para que servem. Aparece até ela ligar ou dispensar.
 */
export default function ConviteNotificacoes({ userId }: { userId: string }) {
  const { sucesso, avisar, erro } = useAvisos();
  const [estado, setEstado] = useState<EstadoNotificacoes | null>(null);
  const [ligando, setLigando] = useState(false);
  const [dispensado, setDispensado] = useState(() => foiDispensado(userId));

  useEffect(() => {
    if (dispensado) return;
    let ativo = true;
    void estadoNotificacoes(userId).then((e) => ativo && setEstado(e));
    return () => {
      ativo = false;
    };
  }, [userId, dispensado]);

  if (dispensado || (estado !== 'desligado' && estado !== 'instalar-primeiro')) return null;

  const dispensar = () => {
    try {
      localStorage.setItem(chaveDispensado(userId), '1');
    } catch {
      /* navegação privada */
    }
    setDispensado(true);
  };

  const ligar = async () => {
    setLigando(true);
    try {
      const resultado = await ligarNotificacoes(userId);
      setEstado(resultado);
      if (resultado === 'ligado') sucesso('Pronto! Avisamos quando o descanso acabar, mesmo com o app fechado.');
      else if (resultado === 'bloqueado') avisar('As notificações estão bloqueadas. Libere nos ajustes do celular.');
    } catch {
      erro('Não foi possível ligar as notificações agora.');
    } finally {
      setLigando(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl items-center gap-3 border-b border-borda px-4 py-2.5 text-sm">
      <BellRing size={18} className="shrink-0 text-primaria" aria-hidden />
      <p className="min-w-0 flex-1 text-texto-suave">
        {estado === 'instalar-primeiro'
          ? 'Quer o aviso do descanso com o app fechado? Adicione o app à Tela de Início pelo Safari.'
          : 'Quer um aviso quando o descanso acabar, mesmo com o celular bloqueado?'}
      </p>
      {estado === 'desligado' && (
        <button
          onClick={ligar}
          disabled={ligando}
          className="min-h-[38px] shrink-0 rounded-lg bg-primaria px-3 font-semibold text-sobre-primaria disabled:opacity-60"
        >
          {ligando ? 'Ligando…' : 'Ativar'}
        </button>
      )}
      <button
        onClick={dispensar}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-texto-suave hover:bg-superficie-2"
        aria-label="Dispensar convite"
      >
        <X size={16} />
      </button>
    </div>
  );
}
