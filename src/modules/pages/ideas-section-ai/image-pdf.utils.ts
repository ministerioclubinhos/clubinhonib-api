/** Uma página já tratada: JPEG e o tamanho dele em pixels. */
export interface ImagePdfPage {
  jpeg: Buffer;
  width: number;
  height: number;
}

/**
 * Monta um PDF em que cada página é uma imagem JPEG, no tamanho que ela tem
 * na resolução dada. Sem dependência: um PDF de imagens é só texto e o JPEG
 * entra como está (`DCTDecode`).
 */
export function buildImagePdf(pages: ImagePdfPage[], dpi: number): Buffer {
  if (!pages.length) throw new Error('PDF sem páginas.');
  const chunks: Buffer[] = [];
  const offsets: number[] = [];
  let size = 0;
  const write = (data: Buffer | string) => {
    const buffer =
      typeof data === 'string' ? Buffer.from(data, 'latin1') : data;
    chunks.push(buffer);
    size += buffer.length;
  };
  const object = (id: number, body: Buffer | string, stream?: Buffer) => {
    offsets[id] = size;
    write(`${id} 0 obj\n`);
    write(body);
    if (stream) {
      write('\nstream\n');
      write(stream);
      write('\nendstream');
    }
    write('\nendobj\n');
  };
  // 1 = catálogo, 2 = árvore de páginas; cada página usa 3 objetos.
  const pageId = (index: number) => 3 + index * 3;
  write('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(
    2,
    `<< /Type /Pages /Count ${pages.length} /Kids [${pages
      .map((_, index) => `${pageId(index)} 0 R`)
      .join(' ')}] >>`,
  );
  pages.forEach((page, index) => {
    const id = pageId(index);
    const widthPt = ((page.width * 72) / dpi).toFixed(2);
    const heightPt = ((page.height * 72) / dpi).toFixed(2);
    const content = Buffer.from(
      `q ${widthPt} 0 0 ${heightPt} 0 0 cm /Im0 Do Q`,
    );
    object(
      id,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${widthPt} ${heightPt}] ` +
        `/Resources << /XObject << /Im0 ${id + 1} 0 R >> >> /Contents ${id + 2} 0 R >>`,
    );
    object(
      id + 1,
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>`,
      page.jpeg,
    );
    object(id + 2, `<< /Length ${content.length} >>`, content);
  });
  const total = pageId(pages.length - 1) + 3;
  const xref = size;
  write(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let id = 1; id < total; id++)
    write(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  write(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return Buffer.concat(chunks);
}
