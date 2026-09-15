import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Dumbbell, Eye, EyeOff, X } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../lib/auth';
import { ErroApi } from '../lib/api';
import { Botao, Campo } from '../components/ui';

/** Mesmas regras do backend — o usuário vê o resultado enquanto digita. */
function avaliarSenha(senha: string) {
  const criterios = [
    { texto: 'Pelo menos 8 caracteres', ok: senha.length >= 8 },
    { texto: 'Pelo menos uma letra', ok: /[a-zA-Z]/.test(senha) },
    { texto: 'Pelo menos um número', ok: /[0-9]/.test(senha) },
  ];
  let forca = 0;
  if (senha.length >= 8) forca++;
  if (senha.length >= 12) forca++;
  if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) forca++;
  if (/[0-9]/.test(senha)) forca++;
  if (/[^a-zA-Z0-9]/.test(senha)) forca++;

  return { criterios, valida: criterios.every((c) => c.ok), forca: Math.min(forca, 4) };
}

const ROTULOS_FORCA = ['Muito fraca', 'Fraca', 'Razoável', 'Boa', 'Forte'];
const CORES_FORCA = ['bg-perigo', 'bg-perigo', 'bg-alerta', 'bg-info', 'bg-primaria'];

export default function Cadastrar() {
  const { cadastrar } = useAuth();
  const navegar = useNavigate();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const avaliacao = useMemo(() => avaliarSenha(senha), [senha]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro('');
    if (!avaliacao.valida) {
      setErro('Escolha uma senha que atenda aos critérios abaixo.');
      return;
    }
    setEnviando(true);
    try {
      await cadastrar(nome.trim(), email.trim(), senha);
      navegar('/app', { replace: true });
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : 'Não foi possível criar a conta.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center px-4 py-10">
      <div className="mx-auto w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 text-xl font-bold">
          <Dumbbell className="text-primaria" aria-hidden />
          Treinos
        </Link>

        <h1 className="text-2xl font-bold">Criar conta</h1>
        <p className="mt-1 text-texto-suave">Leva menos de um minuto.</p>

        <form onSubmit={enviar} className="mt-6 flex flex-col gap-4" noValidate>
          <Campo
            rotulo="Nome"
            name="nome"
            autoComplete="name"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Como quer ser chamado"
          />
          <Campo
            rotulo="E-mail"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
          />

          <div>
            <div className="relative">
              <Campo
                rotulo="Senha"
                name="senha"
                type={verSenha ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Crie uma senha"
              />
              <button
                type="button"
                onClick={() => setVerSenha((v) => !v)}
                className="absolute right-3 top-9 p-1 text-texto-suave hover:text-texto"
                aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {verSenha ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {senha && (
              <div className="mt-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-1.5 flex-1 gap-1" aria-hidden>
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={clsx('h-full flex-1 rounded-full', i < avaliacao.forca ? CORES_FORCA[avaliacao.forca] : 'bg-superficie-2')}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-texto-suave">{ROTULOS_FORCA[avaliacao.forca]}</span>
                </div>

                <ul className="mt-2 flex flex-col gap-1">
                  {avaliacao.criterios.map((criterio) => (
                    <li
                      key={criterio.texto}
                      className={clsx('flex items-center gap-1.5 text-xs', criterio.ok ? 'text-primaria' : 'text-texto-suave')}
                    >
                      {criterio.ok ? <Check size={14} /> : <X size={14} />}
                      {criterio.texto}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {erro && (
            <p role="alert" className="rounded-xl border border-perigo/40 bg-perigo/10 px-3 py-2 text-sm text-perigo">
              {erro}
            </p>
          )}

          <Botao type="submit" tamanho="lg" larguraTotal carregando={enviando}>
            Criar conta
          </Botao>
        </form>

        <p className="mt-5 text-center text-sm text-texto-suave">
          Já tem conta?{' '}
          <Link to="/entrar" className="font-medium text-primaria underline underline-offset-2">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
