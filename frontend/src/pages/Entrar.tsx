import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Dumbbell, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { ErroApi } from '../lib/api';
import { Botao, Campo } from '../components/ui';

export default function Entrar() {
  const { entrar } = useAuth();
  const navegar = useNavigate();
  const local = useLocation() as { state?: { de?: string } };
  const [parametros] = useSearchParams();
  // Vindo do "treino em dupla": a conta atual continua salva no aparelho
  const adicionandoConta = parametros.get('adicionar') === '1';

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [lembrar, setLembrar] = useState(true);
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await entrar(email.trim(), senha, lembrar);
      navegar(local.state?.de ?? '/app', { replace: true });
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : 'Não foi possível entrar. Tente de novo.');
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

        <h1 className="text-2xl font-bold">{adicionandoConta ? 'Entrar com outra conta' : 'Bem-vindo de volta'}</h1>
        <p className="mt-1 text-texto-suave">
          {adicionandoConta
            ? 'A conta atual continua salva neste aparelho — dá para alternar entre as duas durante o treino.'
            : 'Entre para continuar seus treinos.'}
        </p>

        <form onSubmit={enviar} className="mt-6 flex flex-col gap-4" noValidate>
          <Campo
            rotulo="E-mail"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
          />

          <div className="relative">
            <Campo
              rotulo="Senha"
              name="senha"
              type={verSenha ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Sua senha"
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

          <label className="flex items-center gap-2.5 text-sm text-texto-suave">
            <input
              type="checkbox"
              checked={lembrar}
              onChange={(e) => setLembrar(e.target.checked)}
              className="h-4 w-4 rounded border-borda bg-superficie-2 text-primaria focus:ring-primaria"
            />
            Manter conectado
          </label>

          {erro && (
            <p role="alert" className="rounded-xl border border-perigo/40 bg-perigo/10 px-3 py-2 text-sm text-perigo">
              {erro}
            </p>
          )}

          <Botao type="submit" tamanho="lg" larguraTotal carregando={enviando}>
            Entrar
          </Botao>
        </form>

        <div className="mt-5 flex flex-col items-center gap-2 text-sm">
          <Link to="/esqueci-senha" className="text-texto-suave underline underline-offset-2 hover:text-texto">
            Esqueci minha senha
          </Link>
          <p className="text-texto-suave">
            Não tem conta?{' '}
            <Link to="/cadastrar" className="font-medium text-primaria underline underline-offset-2">
              Criar agora
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
