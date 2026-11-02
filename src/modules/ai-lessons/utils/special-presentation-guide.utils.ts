import { HeadingLevel, Paragraph, TextRun } from 'docx';
import { lessonString } from '../utils';

/** Printable teacher notes, kept outside the full-page artwork. */
export function specialPresentationGuide(assets: unknown): Paragraph[] {
  if (!Array.isArray(assets) || !assets.length) return [];
  const paragraphs = [
    new Paragraph({
      text: 'GUIA DE APRESENTAÇÃO DOS CARTAZES',
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
    }),
  ];
  assets.forEach((value: unknown, index: number) => {
    if (!value || typeof value !== 'object') return;
    const asset = value as Record<string, unknown>;
    paragraphs.push(new Paragraph({
      text: `Cartaz ${index + 1}${lessonString(asset.title) ? ` — ${lessonString(asset.title)}` : ''}`,
      heading: HeadingLevel.HEADING_2,
      keepNext: true,
    }));
    for (const text of [lessonString(asset.sourceExcerpt), lessonString(asset.purpose)]) {
      for (const line of text.split(/\r?\n/).filter((item) => item.trim())) {
        paragraphs.push(new Paragraph({
          children: [new TextRun(line)],
          spacing: { after: 120 },
        }));
      }
    }
  });
  return paragraphs;
}
