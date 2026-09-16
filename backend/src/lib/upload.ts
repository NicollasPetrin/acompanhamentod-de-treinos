import multer from 'multer';
import { env } from '../env';
import { badRequest } from './errors';

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Upload de imagens (foto de perfil e fotos de progresso).
 *
 * O arquivo fica em memória e vai para o banco — hospedagens gratuitas
 * descartam o disco a cada deploy, então guardar em `uploads/` significaria
 * perder as fotos. O app comprime a imagem antes de enviar.
 */
export const uploadImagem = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!TIPOS_PERMITIDOS.includes(file.mimetype)) {
      return cb(badRequest('Formato de imagem não suportado (use JPG, PNG, WEBP ou GIF)'));
    }
    cb(null, true);
  },
});

/** Caminho público de uma foto guardada no banco. */
export const urlDaFoto = (id: string) => `/api/fotos/${id}`;
