import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { apiPost } from '../lib/api';
import { Botao, Campo } from '../components/ui';

export default function EsqueciSenha() {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await apiPost('/auth/esqueci-senha', { email: email.trim() }, { publico: true });
      setEnviado(true);
    } catch {
      // A API responde igual mesmo se o e-mail não existir; qualquer falha aqui
      // é de rede, e a mensagem genérica continua valendo.
      setEnviado(true);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center px-4 py-10">
      <div className="mx-auto w-full max-w-sm">
        <Link to="/entrar" className="mb-6 inline-flex items-center gap-1.5 text-sm text-texto-suave hover:text-texto">
          <ArrowLeft size={16} />
          Voltar para o login
        </Link>

        {enviado ? (
          <div className="cartao flex flex-col items-center gap-3 p-6 text-center">
            <MailCheck size={40} className="text-primaria" aria-hidden />
            <h1 className="text-xl font-bold">Confira seu e-mail</h1>
            <p className="text-sm text-texto-suave">
              Se <strong className="text-texto">{email}</strong> estiver cadastrado, enviamos um link para redefinir
              a senha. Ele vale por 1 hora.
            </p>
            <Link to="/entrar" className="w-full">
              <Botao larguraTotal variante="secundario">
                Voltar
              </Botao>
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold">Recuperar senha</h1>
            <p className="mt-1 text-texto-suave">Enviaremos um link para você criar uma nova senha.</p>

            <form onSubmit={enviar} className="mt-6 flex flex-col gap-4">
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
              <Botao type="submit" tamanho="lg" larguraTotal carregando={enviando}>
                Enviar link
              </Botao>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
