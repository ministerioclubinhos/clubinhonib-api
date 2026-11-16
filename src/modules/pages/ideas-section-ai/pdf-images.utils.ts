/**
 * Conta as imagens embutidas de um PDF lendo os bytes, sem renderizar.
 *
 * Uma imagem do PDF é um objeto de stream, e streams nunca ficam dentro de
 * object streams comprimidos: o dicionário (`/Subtype /Image`, `/Width`,
 * `/Height`) aparece em texto puro entre `obj` e `stream`. O pdf.js do
 * `pdf-parse` não serve aqui: para listar imagens ele precisa carregar fontes
 * e derruba o processo no Node.
 */
const IMAGE_SUBTYPE = /\/Subtype\s*\/Image\b/g;
const WIDTH = /\/Width\s+(\d+)/;
const HEIGHT = /\/Height\s+(\d+)/;

export function countPdfImages(pdf: Buffer, minPixels: number): number {
  const raw = pdf.toString('latin1');
  let count = 0;
  for (const match of raw.matchAll(IMAGE_SUBTYPE)) {
    const at = match.index ?? 0;
    const start = Math.max(raw.lastIndexOf(' obj', at), 0);
    const streamAt = raw.indexOf('stream', at);
    const end = streamAt === -1 ? Math.min(at + 600, raw.length) : streamAt;
    const dictionary = raw.slice(start, end);
    const width = Number(WIDTH.exec(dictionary)?.[1]);
    const height = Number(HEIGHT.exec(dictionary)?.[1]);
    // Sem tamanho legível, vale a cautela: conta como imagem.
    if (!width || !height || width * height >= minPixels) count++;
  }
  return count;
}
