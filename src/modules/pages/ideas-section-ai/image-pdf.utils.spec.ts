import { buildImagePdf } from './image-pdf.utils';

// Um JPEG mínimo válido (1x1, branco) para o conteúdo da página.
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64',
);

describe('buildImagePdf', () => {
  it('builds a PDF whose page has the size of the image at the given resolution', () => {
    const pdf = buildImagePdf([{ jpeg: JPEG, width: 600, height: 300 }], 150);
    const text = pdf.toString('latin1');
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('/MediaBox [0 0 288.00 144.00]');
    expect(text).toContain('/Filter /DCTDecode');
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('writes one page per image and a valid cross-reference table', () => {
    const pdf = buildImagePdf(
      [
        { jpeg: JPEG, width: 100, height: 100 },
        { jpeg: JPEG, width: 100, height: 100 },
      ],
      72,
    );
    const text = pdf.toString('latin1');
    expect(text).toContain('/Count 2');
    const startxref = Number(/startxref\n(\d+)/.exec(text)?.[1]);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');
    // Cada offset do xref aponta para "N 0 obj".
    const table = text.slice(startxref).split('\n').slice(3);
    table
      .filter((line) => line.endsWith(' n '))
      .forEach((line, index) => {
        const offset = Number(line.slice(0, 10));
        expect(text.slice(offset, offset + 8)).toBe(`${index + 1} 0 obj\n`);
      });
  });

  it('refuses an empty document', () => {
    expect(() => buildImagePdf([], 150)).toThrow('PDF sem páginas.');
  });
});
