import { forwardRef, useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Loader2, X } from 'lucide-react';
import clsx from 'clsx';

/* -------------------------------------------------------------------------- */
/* Botão                                                                       */
/* -------------------------------------------------------------------------- */

type Variante = 'primario' | 'secundario' | 'fantasma' | 'perigo';
type Tamanho = 'sm' | 'md' | 'lg';

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-primaria text-sobre-primaria hover:bg-primaria-escura hover:text-white active:scale-[0.98] font-semibold',
  secundario: 'bg-superficie-2 text-texto border border-borda hover:border-primaria/60 active:scale-[0.98]',
  fantasma: 'text-texto-suave hover:text-texto hover:bg-superficie-2',
  perigo: 'bg-perigo/15 text-perigo border border-perigo/40 hover:bg-perigo/25',
};

const TAMANHOS: Record<Tamanho, string> = {
  // Alvos de toque generosos: a tela é usada com uma mão, na academia
  sm: 'min-h-[38px] px-3 text-sm gap-1.5',
  md: 'min-h-[46px] px-4 text-[15px] gap-2',
  lg: 'min-h-[56px] px-6 text-base gap-2.5',
};

interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamanho?: Tamanho;
  carregando?: boolean;
  larguraTotal?: boolean;
  icone?: ReactNode;
}

export const Botao = forwardRef<HTMLButtonElement, BotaoProps>(function Botao(
  { variante = 'primario', tamanho = 'md', carregando, larguraTotal, icone, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || carregando}
      className={clsx(
        'inline-flex items-center justify-center rounded-xl transition-all duration-150',
        'disabled:opacity-50 disabled:pointer-events-none select-none',
        VARIANTES[variante],
        TAMANHOS[tamanho],
        larguraTotal && 'w-full',
        className,
      )}
      {...props}
    >
      {carregando ? <Loader2 size={18} className="animate-spin" aria-hidden /> : icone}
      {children}
    </button>
  );
});

/* -------------------------------------------------------------------------- */
/* Cartão                                                                      */
/* -------------------------------------------------------------------------- */

export function Cartao({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('cartao p-4', className)} {...props}>
      {children}
    </div>
  );
}

export function TituloSecao({ titulo, acao, descricao }: { titulo: string; descricao?: string; acao?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div>
        <h2 className="text-lg font-semibold">{titulo}</h2>
        {descricao && <p className="text-sm text-texto-suave mt-0.5">{descricao}</p>}
      </div>
      {acao}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Campos de formulário                                                        */
/* -------------------------------------------------------------------------- */

interface CampoProps extends InputHTMLAttributes<HTMLInputElement> {
  rotulo?: string;
  erro?: string;
  dica?: string;
  sufixo?: ReactNode;
}

export const Campo = forwardRef<HTMLInputElement, CampoProps>(function Campo(
  { rotulo, erro, dica, sufixo, className, id, ...props },
  ref,
) {
  const idCampo = id ?? props.name ?? rotulo?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="w-full">
      {rotulo && (
        <label htmlFor={idCampo} className="rotulo">
          {rotulo}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={idCampo}
          aria-invalid={Boolean(erro)}
          aria-describedby={erro ? `${idCampo}-erro` : dica ? `${idCampo}-dica` : undefined}
          className={clsx('campo', erro && 'border-perigo focus:border-perigo focus:ring-perigo/40', sufixo && 'pr-14', className)}
          {...props}
        />
        {sufixo && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-texto-suave">{sufixo}</span>
        )}
      </div>
      {erro && (
        <p id={`${idCampo}-erro`} className="mt-1.5 text-sm text-perigo">
          {erro}
        </p>
      )}
      {!erro && dica && (
        <p id={`${idCampo}-dica`} className="mt-1.5 text-xs text-texto-suave">
          {dica}
        </p>
      )}
    </div>
  );
});

interface SelecaoProps extends SelectHTMLAttributes<HTMLSelectElement> {
  rotulo?: string;
  erro?: string;
}

export const Selecao = forwardRef<HTMLSelectElement, SelecaoProps>(function Selecao(
  { rotulo, erro, className, id, children, ...props },
  ref,
) {
  const idCampo = id ?? props.name ?? rotulo?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="w-full">
      {rotulo && (
        <label htmlFor={idCampo} className="rotulo">
          {rotulo}
        </label>
      )}
      <select ref={ref} id={idCampo} className={clsx('campo appearance-none pr-10', className)} {...props}>
        {children}
      </select>
      {erro && <p className="mt-1.5 text-sm text-perigo">{erro}</p>}
    </div>
  );
});

interface AreaTextoProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  rotulo?: string;
}

export const AreaTexto = forwardRef<HTMLTextAreaElement, AreaTextoProps>(function AreaTexto(
  { rotulo, className, id, ...props },
  ref,
) {
  const idCampo = id ?? props.name ?? rotulo?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="w-full">
      {rotulo && (
        <label htmlFor={idCampo} className="rotulo">
          {rotulo}
        </label>
      )}
      <textarea ref={ref} id={idCampo} rows={3} className={clsx('campo resize-y', className)} {...props} />
    </div>
  );
});

/* -------------------------------------------------------------------------- */
/* Distintivos, progresso e estados                                            */
/* -------------------------------------------------------------------------- */

export function Distintivo({
  children,
  cor = 'neutro',
  className,
}: {
  children: ReactNode;
  cor?: 'neutro' | 'primaria' | 'alerta' | 'info' | 'perigo';
  className?: string;
}) {
  const cores = {
    neutro: 'bg-superficie-2 text-texto-suave border-borda',
    primaria: 'bg-primaria/15 text-primaria border-primaria/30',
    alerta: 'bg-alerta/15 text-alerta border-alerta/30',
    info: 'bg-info/15 text-info border-info/30',
    perigo: 'bg-perigo/15 text-perigo border-perigo/30',
  };
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-medium', cores[cor], className)}>
      {children}
    </span>
  );
}

export function BarraProgresso({ valor, rotulo, cor }: { valor: number; rotulo?: string; cor?: string }) {
  const pct = Math.max(0, Math.min(100, valor));
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-superficie-2"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={rotulo}
    >
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: cor ?? 'rgb(var(--cor-primaria))' }}
      />
    </div>
  );
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-texto-suave">
      <Loader2 size={28} className="animate-spin text-primaria" aria-hidden />
      <p className="text-sm">{texto}</p>
    </div>
  );
}

export function Vazio({
  icone,
  titulo,
  descricao,
  acao,
}: {
  icone?: ReactNode;
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-borda px-6 py-12 text-center">
      {icone && <div className="text-texto-suave">{icone}</div>}
      <div>
        <h3 className="font-semibold">{titulo}</h3>
        {descricao && <p className="mt-1 text-sm text-texto-suave max-w-xs mx-auto">{descricao}</p>}
      </div>
      {acao}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Modal / bottom sheet                                                        */
/* -------------------------------------------------------------------------- */

interface ModalProps {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  children: ReactNode;
  rodape?: ReactNode;
  largo?: boolean;
}

/**
 * No celular sobe de baixo (bottom sheet); no desktop vira um diálogo central.
 * Fecha com Esc e com clique fora.
 */
export function Modal({ aberto, aoFechar, titulo, children, rodape, largo }: ModalProps) {
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = '';
    };
  }, [aberto, aoFechar]);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={aoFechar} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={clsx(
          'relative w-full bg-superficie border border-borda shadow-2xl animate-sobe-suave',
          'rounded-t-2xl sm:rounded-2xl flex flex-col',
          'max-h-[calc(100vh-var(--seguro-topo)-1rem)] pb-[var(--seguro-base)] sm:max-h-[92vh] sm:pb-0',
          largo ? 'sm:max-w-2xl' : 'sm:max-w-md',
        )}
      >
        <div className="flex items-center justify-between gap-4 border-b border-borda px-4 py-3">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <button
            type="button"
            onClick={aoFechar}
            className="rounded-lg p-2 text-texto-suave hover:bg-superficie-2 hover:text-texto"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {rodape && <div className="border-t border-borda px-4 py-3">{rodape}</div>}
      </div>
    </div>
  );
}

export function ConfirmarAcao({
  aberto,
  titulo,
  mensagem,
  textoConfirmar = 'Confirmar',
  perigoso,
  aoConfirmar,
  aoCancelar,
  carregando,
}: {
  aberto: boolean;
  titulo: string;
  mensagem: string;
  textoConfirmar?: string;
  perigoso?: boolean;
  aoConfirmar: () => void;
  aoCancelar: () => void;
  carregando?: boolean;
}) {
  return (
    <Modal
      aberto={aberto}
      aoFechar={aoCancelar}
      titulo={titulo}
      rodape={
        <div className="flex gap-2">
          <Botao variante="secundario" larguraTotal onClick={aoCancelar}>
            Cancelar
          </Botao>
          <Botao
            variante={perigoso ? 'perigo' : 'primario'}
            larguraTotal
            onClick={aoConfirmar}
            carregando={carregando}
          >
            {textoConfirmar}
          </Botao>
        </div>
      }
    >
      <p className="text-texto-suave">{mensagem}</p>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Abas roláveis                                                               */
/* -------------------------------------------------------------------------- */

export function Abas<T extends string | number>({
  abas,
  ativa,
  aoTrocar,
}: {
  abas: Array<{ valor: T; rotulo: string; contador?: number }>;
  ativa: T;
  aoTrocar: (valor: T) => void;
}) {
  return (
    <div role="tablist" className="rolagem-oculta flex gap-2 overflow-x-auto pb-1">
      {abas.map((aba) => (
        <button
          key={aba.valor}
          role="tab"
          aria-selected={ativa === aba.valor}
          onClick={() => aoTrocar(aba.valor)}
          className={clsx(
            'shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-colors min-h-[40px]',
            ativa === aba.valor
              ? 'bg-primaria text-sobre-primaria'
              : 'bg-superficie-2 text-texto-suave hover:text-texto border border-borda',
          )}
        >
          {aba.rotulo}
          {aba.contador !== undefined && <span className="ml-1.5 opacity-70">{aba.contador}</span>}
        </button>
      ))}
    </div>
  );
}

/** Número grande com rótulo — usado nos resumos e dashboards. */
export function Estatistica({
  valor,
  rotulo,
  icone,
  cor,
  variacao,
}: {
  valor: ReactNode;
  rotulo: string;
  icone?: ReactNode;
  cor?: string;
  variacao?: number;
}) {
  return (
    <div className="cartao p-3.5">
      <div className="flex items-center gap-2 text-texto-suave">
        {icone}
        <span className="text-xs font-medium uppercase tracking-wide">{rotulo}</span>
      </div>
      <p className="mt-1.5 text-2xl font-bold" style={cor ? { color: cor } : undefined}>
        {valor}
      </p>
      {variacao !== undefined && variacao !== 0 && (
        <p className={clsx('mt-0.5 text-xs font-medium', variacao > 0 ? 'text-primaria' : 'text-perigo')}>
          {variacao > 0 ? '▲' : '▼'} {Math.abs(variacao).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
        </p>
      )}
    </div>
  );
}
