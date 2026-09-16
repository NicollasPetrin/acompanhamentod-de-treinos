import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../env';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 587,
      secure: (env.SMTP_PORT ?? 587) === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

/**
 * Envia e-mail. Sem SMTP configurado (padrão em desenvolvimento) o conteúdo é
 * impresso no console — assim o fluxo de recuperação de senha funciona local
 * sem depender de serviço externo.
 */
export async function sendMail(options: { to: string; subject: string; html: string; text: string }) {
  const tx = getTransporter();
  if (!tx) {
    console.info(
      `\n📧 [e-mail simulado] para: ${options.to}\n   assunto: ${options.subject}\n   ${options.text}\n`,
    );
    return { simulated: true };
  }
  await tx.sendMail({ from: env.MAIL_FROM, ...options });
  return { simulated: false };
}

export function passwordResetEmail(name: string, link: string) {
  return {
    subject: 'Recuperação de senha — Treinos',
    text: `Olá, ${name}! Use o link a seguir para redefinir sua senha (expira em 1 hora): ${link}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px">
        <h2>Recuperação de senha</h2>
        <p>Olá, ${name}!</p>
        <p>Recebemos um pedido para redefinir sua senha. O link abaixo expira em <strong>1 hora</strong>.</p>
        <p><a href="${link}" style="background:#22c55e;color:#04140a;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Redefinir senha</a></p>
        <p style="color:#666;font-size:13px">Se não foi você quem pediu, pode ignorar este e-mail.</p>
      </div>`,
  };
}
