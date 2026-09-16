import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { notFound } from '../lib/errors';

export const photosRouter = Router();

/**
 * GET /api/fotos/:id — serve a imagem guardada no banco.
 *
 * Sem autenticação, pelo mesmo motivo de qualquer arquivo estático: a tag
 * <img> do navegador não envia o token. O id é um cuid, impossível de adivinhar,
 * e nada além da imagem é exposto — mesmo nível de privacidade de um arquivo
 * servido de uma pasta pública.
 */
photosRouter.get('/:id', async (req, res, next) => {
  try {
    const foto = await prisma.photo.findUnique({ where: { id: req.params.id } });
    if (!foto) throw notFound('Foto não encontrada');

    res
      .type(foto.mimeType)
      // O conteúdo de um id nunca muda: pode ficar em cache para sempre
      .set('Cache-Control', 'public, max-age=31536000, immutable')
      .send(Buffer.from(foto.data));
  } catch (err) {
    next(err);
  }
});
