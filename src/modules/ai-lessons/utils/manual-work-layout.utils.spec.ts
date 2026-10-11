import { Document, Packer } from 'docx';
import * as JSZip from 'jszip';
import { buildManualWorkSheet } from './manual-work-layout.utils';

describe('manual work two copies on one sheet', () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1sAAAAASUVORK5CYII=',
    'base64',
  );
  it.each([
    'Versículo curto.',
    'A criança lê o versículo completo antes de pintar. '.repeat(12),
  ])(
    'keeps both copies and separator in one unsplittable row: %s',
    async (verse) => {
      const buffer = await Packer.toBuffer(
        new Document({
          sections: [{ children: buildManualWorkSheet(png, png, verse) }],
        }),
      );
      const zip = await JSZip.loadAsync(buffer);
      const xml = await zip.file('word/document.xml')!.async('string');
      expect(xml.match(/TRABALHO MANUAL/g)).toHaveLength(2);
      expect(xml.match(/<w:drawing>/g)).toHaveLength(4);
      expect(xml.match(/<w:tr>/g)).toHaveLength(3);
      expect(
        xml.match(/w:val="single" w:color="000000" w:sz="24"/g),
      ).toHaveLength(8);
      expect(xml).toContain('<w:cantSplit/>');
      expect(xml).toContain('w:val="dashed"');
      expect(xml).not.toContain('w:type="page"');
      expect(xml).not.toContain('w:hRule="exact"');
    },
  );
  it('rejects a verse that leaves no usable image space instead of clipping or splitting copies', () => {
    expect(() => buildManualWorkSheet(png, png, 'Texto '.repeat(1500))).toThrow(
      'duas cópias',
    );
  });
});
