/**
 * Compressão de imagem no próprio aparelho, antes do upload.
 *
 * Foto de celular tem de 3 a 8 MB; reduzida para 1080px de lado maior em JPEG
 * fica em algumas centenas de KB — o suficiente para comparar evolução e leve
 * o bastante para guardar no banco (e para subir pelo 4G da academia).
 */
const LARGURA_MAXIMA = 1080;
const QUALIDADE = 0.75;

export async function comprimirImagem(arquivo: File): Promise<File> {
  // GIF animado perderia a animação; arquivo já pequeno não compensa recomprimir
  if (arquivo.type === 'image/gif' || arquivo.size < 200 * 1024) return arquivo;

  try {
    const bitmap = await createImageBitmap(arquivo);
    const escala = Math.min(1, LARGURA_MAXIMA / Math.max(bitmap.width, bitmap.height));

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);

    const contexto = canvas.getContext('2d');
    if (!contexto) return arquivo;
    contexto.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolver) =>
      canvas.toBlob(resolver, 'image/jpeg', QUALIDADE),
    );
    if (!blob || blob.size >= arquivo.size) return arquivo;

    const nome = arquivo.name.replace(/\.[^.]+$/, '') || 'foto';
    return new File([blob], `${nome}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    // Navegador sem suporte a createImageBitmap/canvas: envia o original
    return arquivo;
  }
}
