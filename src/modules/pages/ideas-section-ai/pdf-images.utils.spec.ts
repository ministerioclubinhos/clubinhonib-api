import { countPdfImages } from './pdf-images.utils';

const image = (width: number, height: number, extra = '') =>
  `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} ${extra}/Length 10 >>\nstream\nxxxx\nendstream\nendobj\n`;
const pdf = (...objects: string[]) =>
  Buffer.from(`%PDF-1.4\n${objects.join('')}%%EOF`, 'latin1');
const MIN = 40_000;

describe('countPdfImages', () => {
  it('counts nothing in a text-only PDF', () => {
    expect(
      countPdfImages(pdf('1 0 obj\n<< /Type /Page >>\nendobj\n'), MIN),
    ).toBe(0);
  });

  it('counts an image big enough to be content', () => {
    expect(countPdfImages(pdf(image(432, 611)), MIN)).toBe(1);
  });

  it('ignores logos and icons below the minimum size', () => {
    expect(countPdfImages(pdf(image(40, 40), image(100, 100)), MIN)).toBe(0);
  });

  it('reads width and height in any key order', () => {
    const reordered =
      '7 0 obj\n<< /Height 300 /Width 400 /Subtype /Image /Type /XObject /Length 4 >>\nstream\nxxxx\nendstream\nendobj\n';
    expect(countPdfImages(pdf(reordered), MIN)).toBe(1);
  });

  it('is cautious when the size cannot be read', () => {
    const unknown =
      '8 0 obj\n<< /Type /XObject /Subtype /Image /Length 4 >>\nstream\nxxxx\nendstream\nendobj\n';
    expect(countPdfImages(pdf(unknown), MIN)).toBe(1);
  });

  it('does not borrow the size of a neighboring object', () => {
    const page = '1 0 obj\n<< /Width 9999 /Height 9999 >>\nendobj\n';
    const small =
      '2 0 obj\n<< /Subtype /Image /Width 10 /Height 10 /Length 4 >>\nstream\nxxxx\nendstream\nendobj\n';
    expect(countPdfImages(pdf(page, small), MIN)).toBe(0);
  });
});
