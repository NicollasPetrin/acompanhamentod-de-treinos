/**
 * Ponto de entrada da API como função serverless (Vercel).
 *
 * A Vercel roda este arquivo para qualquer caminho (ver vercel.json) e o
 * Express cuida do roteamento, exatamente como no servidor tradicional.
 * O site é publicado à parte, então aqui a API não serve arquivos estáticos.
 */
import { createApp } from '../src/app';

export default createApp({ servirFrontend: false });
