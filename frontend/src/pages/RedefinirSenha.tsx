import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { apiPost, ErroApi } from '../lib/api';
import { Botao, Campo } from '../components/ui';
import { useAvisos } from '../components/Notificacoes';

export default function RedefinirSenha() {
  const [parametros] = useSearchParams();
  const token = parametros.get('token') ?? '';
  const navegar = useNavigate();
  const { sucesso } = useAvisos();

  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro('');
    if (senha !== confirmacao) {
      setErro('As senhas não coincidem.');
      return;
    }
    setEnviando(true);
    try {
      await apiPost('/auth/redefinir-senha', { token, password: senha }, { publico: true });
      sucesso('Senha alterada! Faça login com a nova senha.');
      navegar('/entrar', { replace: true });
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : 'Não foi possível alterar a senha.');
    } finally {
      setEnviando(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="cartao max-w-sm p-6 text-center">
          <h1 className="text-xl font-bold">Link inválido</h1>
          <p className="mt-2 text-sm text-texto-suave">
            Este link de recuperação está incompleto. Peça um novo na tela de login.
          </p>
          <Link to="/esqueci-senha" className="mt-4 inline-block">
            <Botao>Pedir novo link</Botao>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col justify-center px-4 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center">
          <KeyRound size={36} className="text-primaria" aria-hidden />
        </div>
        <h1 className="text-center text-2xl font-bold">Criar nova senha</h1>

        <form onSubmit={enviar} className="mt-6 flex flex-col gap-4">
          <Campo
            rotulo="Nova senha"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            dica="Mínimo de 8 caracteres, com letra e número"
          />
          <Campo
            rotulo="Confirme a nova senha"
            type="password"
            autoComplete="new-password"
            required
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
          />

          {erro && (
            <p role="alert" className="rounded-xl border border-perigo/40 bg-perigo/10 px-3 py-2 text-sm text-perigo">
              {erro}
            </p>
          )}

          <Botao type="submit" tamanho="lg" larguraTotal carregando={enviando}>
            Salvar nova senha
          </Botao>
        </form>
      </div>
    </div>
  );
}
