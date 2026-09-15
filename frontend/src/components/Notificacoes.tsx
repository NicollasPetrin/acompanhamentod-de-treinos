import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';

type TipoAviso = 'sucesso' | 'erro' | 'info';

interface Aviso {
  id: number;
  tipo: TipoAviso;
  texto: string;
}

interface ContextoAvisos {
  avisar: (texto: string, tipo?: TipoAviso) => void;
  sucesso: (texto: string) => void;
  erro: (texto: string) => void;
}

const Contexto = createContext<ContextoAvisos | null>(null);

const ICONES = {
  sucesso: CheckCircle2,
  erro: TriangleAlert,
  info: Info,
};

const CORES: Record<TipoAviso, string> = {
  sucesso: 'border-primaria/60 text-primaria',
  erro: 'border-perigo/60 text-perigo',
  info: 'border-info/60 text-info',
};

/** Avisos curtos (toasts) anunciados também para leitores de tela. */
export function NotificacoesProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  const avisar = useCallback((texto: string, tipo: TipoAviso = 'info') => {
    const id = Date.now() + Math.random();
    setAvisos((atuais) => [...atuais, { id, tipo, texto }]);
    setTimeout(() => setAvisos((atuais) => atuais.filter((a) => a.id !== id)), 4200);
  }, []);

  const valor = useMemo<ContextoAvisos>(
    () => ({
      avisar,
      sucesso: (texto: string) => avisar(texto, 'sucesso'),
      erro: (texto: string) => avisar(texto, 'erro'),
    }),
    [avisar],
  );

  return (
    <Contexto.Provider value={valor}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-x-3 bottom-24 z-[60] flex flex-col gap-2 sm:left-auto sm:right-4 sm:bottom-4 sm:w-96"
      >
        {avisos.map((aviso) => {
          const Icone = ICONES[aviso.tipo];
          return (
            <div
              key={aviso.id}
              className={`cartao ${CORES[aviso.tipo]} flex items-start gap-3 px-4 py-3 shadow-lg animate-sobe-suave`}
            >
              <Icone size={20} className="mt-0.5 shrink-0" aria-hidden />
              <p className="flex-1 text-sm text-texto">{aviso.texto}</p>
              <button
                type="button"
                onClick={() => setAvisos((atuais) => atuais.filter((a) => a.id !== aviso.id))}
                className="text-texto-suave hover:text-texto"
                aria-label="Fechar aviso"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </Contexto.Provider>
  );
}

export function useAvisos() {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useAvisos precisa estar dentro de <NotificacoesProvider>');
  return contexto;
}
