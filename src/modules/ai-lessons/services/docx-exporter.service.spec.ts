import { ConfigService } from '@nestjs/config';
import * as JSZip from 'jszip';
import { DocxExporterService } from './docx-exporter.service';
import { LessonStageType, LessonVersionSource } from '../enums/lesson.enums';
import { FORMATTED_LESSON_DOCUMENT } from '../fixtures/lesson-document.fixture';

jest.mock('node:fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue(Buffer.from('mock-logo')),
}));

describe('DocxExporterService lesson header', () => {
  it('preserva estilos, espaçamento, links e células mescladas no documento que origina o PDF', async () => {
    const exporter = new DocxExporterService({
      get: jest.fn(),
    } as unknown as ConfigService);
    const buffer = await exporter.buildDocxFromTiptapOrStructuredJson(
      {
        [LessonStageType.LESSON]: {
          structuredDataJson: {},
          tiptapAstJson: FORMATTED_LESSON_DOCUMENT,
        },
      },
      20,
    );
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file('word/document.xml')!.async('string');
    const relationships = await zip
      .file('word/_rels/document.xml.rels')!
      .async('string');
    expect(xml).toContain('w:ascii="Arial"');
    expect(xml).toContain('w:ascii="Times New Roman"');
    expect(xml).toContain('<w:sz w:val="48"');
    expect(xml).toContain('<w:sz w:val="32"');
    expect(xml).toContain('w:color w:val="C53030"');
    expect(xml).toContain('w:fill="FFF200"');
    expect(xml).toContain('w:line="480"');
    expect(xml).toContain('w:line="360"');
    expect(xml).toContain('<w:jc w:val="right"');
    expect(xml).toContain('<w:gridSpan w:val="2"');
    expect(xml).toContain('<w:vMerge w:val="restart"');
    expect(xml).toContain('<w:vMerge w:val="continue"');
    expect(xml).toContain('w:w="4500"');
    expect(xml).toContain('Célula mesclada');
    expect(xml).toContain('Segunda linha');
    expect(xml).toContain('<w:hyperlink');
    expect(relationships).toContain('https://example.com/apoio');
  });

  it('não duplica NVI na referência exportada do conteúdo estruturado', async () => {
    const exporter = new DocxExporterService({
      get: jest.fn(),
    } as unknown as ConfigService);
    const buffer = await exporter.buildDocxFromTiptapOrStructuredJson({
      LESSON: {
        structuredDataJson: {
          title: 'O PÃO DA VIDA',
          memoryVerse: {
            text: 'Eu sou o pão da vida.',
            reference: 'João 6:35 NVI',
            version: 'NVI',
          },
        },
      },
    });
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('João 6:35 — NVI');
    expect(xml).not.toContain('João 6:35 NVI');
  });

  it.each([true, false])(
    'preserva os subtítulos no PDF via DOCX, com AST presente=%s',
    async (withAst) => {
      const exporter = new DocxExporterService({
        get: jest.fn(),
      } as unknown as ConfigService);
      const first = 'A Primeira Multiplicação dos Pães';
      const second = 'A Segunda Multiplicação dos Pães';
      const buffer = await exporter.buildDocxFromTiptapOrStructuredJson({
        LESSON: {
          structuredDataJson: {
            title: 'Duas multiplicações',
            story: `Hoje veremos duas histórias.\n\n### ${first}\nCinco pães.\n\n### ${second}\nSete pães.`,
          },
          tiptapAstJson: withAst
            ? {
                type: 'doc',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', text: 'Hoje veremos duas histórias.' },
                    ],
                  },
                  ...[first, second].map((text) => ({
                    type: 'heading',
                    attrs: { level: 3, textAlign: 'left' },
                    content: [{ type: 'text', text }],
                  })),
                ],
              }
            : null,
        },
      });
      const zip = await JSZip.loadAsync(buffer);
      const xml = await zip.file('word/document.xml')!.async('string');
      const paragraphs = xml.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) ?? [];
      for (const title of [first, second]) {
        const paragraph = paragraphs.find((item) => item.includes(title));
        expect(paragraph).toContain('w:pStyle w:val="Heading3"');
        expect(paragraph).toContain('w:jc w:val="left"');
      }
      expect(xml).not.toContain('###');
      expect(xml.indexOf(first)).toBeLessThan(xml.indexOf(second));
    },
  );

  it.each([
    LessonStageType.MEDITATION_YOUNGER,
    LessonStageType.MEDITATION_OLDER,
  ])(
    'exporta o documento editado da meditação %s em lugar do conteúdo estruturado antigo',
    async (type) => {
      const exporter = new DocxExporterService({
        get: jest.fn(),
      } as unknown as ConfigService);
      const buffer = await exporter.buildDocxFromTiptapOrStructuredJson({
        [type]: {
          createdSource: LessonVersionSource.MANUAL_EDIT,
          structuredDataJson: { title: 'Conteúdo antigo que deve desaparecer' },
          tiptapAstJson: FORMATTED_LESSON_DOCUMENT,
        },
      });
      const zip = await JSZip.loadAsync(buffer);
      const xml = await zip.file('word/document.xml')!.async('string');
      expect(xml).toContain('Texto revisado com fonte maior.');
      expect(xml).not.toContain('Conteúdo antigo que deve desaparecer');
      expect(xml).toContain('<w:sz w:val="48"');
    },
  );
  it('mantém duas cópias da folha dos menores após edição, com atividades e sem gabarito', async () => {
    const exporter = new DocxExporterService({
      get: jest.fn(),
    } as unknown as ConfigService);
    const buffer = await exporter.buildDocxFromTiptapOrStructuredJson({
      [LessonStageType.MEDITATION_YOUNGER]: {
        createdSource: LessonVersionSource.MANUAL_EDIT,
        structuredDataJson: {
          title: 'Tema original',
          verseText: 'Jesus vive.',
          verseReference: 'João 11:25',
          prayer: 'Obrigado, Jesus.',
          activities: [
            { instruction: 'Pinte a cena.', answer: 'Gabarito privado' },
            { instruction: 'Circule a resposta.' },
          ],
        },
        tiptapAstJson: {
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 1 },
              content: [{ type: 'text', text: 'Tema revisado' }],
            },
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'INSTRUÇÃO' }],
            },
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'Pinte Jesus e seus amigos.',
                  marks: [
                    { type: 'bold' },
                    { type: 'textStyle', attrs: { color: '#ff0000' } },
                  ],
                },
              ],
            },
          ],
        },
      },
    });
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file('word/document.xml')!.async('string');
    for (const value of [
      'TEMA REVISADO',
      'Pinte Jesus e seus amigos.',
      'Circule a resposta.',
      'FALANDO COM DEUS:',
    ]) {
      expect(xml.split(value)).toHaveLength(3);
    }
    expect(xml).not.toContain('Gabarito privado');
    expect(xml).not.toContain('Tema original');
    expect(xml.match(/w:color w:val="FF0000"/g)).toHaveLength(2);
    expect(xml).toContain('w:fill="FFF200"');
    expect(xml).toContain('w:val="dashed"');
    expect(xml).toContain('w:w="11906"');
    expect(xml.match(/w:hRule="exact"/g)).toHaveLength(2);
    const media = Object.keys(zip.files).filter(
      (name) => name.startsWith('word/media/') && !zip.files[name].dir,
    );
    expect(media).toHaveLength(1);
  });

  it('exports older meditation once with all challenges and internal answers hidden', async () => {
    const exporter = new DocxExporterService({
      get: jest.fn(),
    } as unknown as ConfigService);
    const buffer = await exporter.buildDocxFromTiptapOrStructuredJson({
      [LessonStageType.MEDITATION_OLDER]: {
        structuredDataJson: {
          title: 'Jesus cuida de nós',
          verseText: 'Jesus vive.',
          verseReference: 'João 11:25',
          biblicalText: 'João 11:1-44',
          introduction: 'Leia e recorde a lição.',
          prayer: 'Senhor, ajuda-nos.',
          activities: [
            {
              instruction: 'Circule a resposta correta.',
              answer: 'Gabarito privado',
            },
            { instruction: 'Complete usando a legenda.' },
            { instruction: 'Numere os acontecimentos.' },
          ],
          printableAssets: [],
        },
      },
    });
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file('word/document.xml')!.async('string');
    for (const value of [
      'MEDITAÇÃO PARA CRIANÇAS MAIORES',
      'Circule a resposta correta.',
      'Complete usando a legenda.',
      'Numere os acontecimentos.',
      'FALANDO COM DEUS:',
    ]) {
      expect(xml.split(value)).toHaveLength(2);
    }
    expect(xml).not.toContain('Gabarito privado');
    expect(xml).not.toContain('w:hRule="exact"');
    expect(xml).toContain('w:val="15400" w:hRule="atLeast"');
  });

  it('exports an existing combined title as separate paragraphs and preserves edited content', async () => {
    const exporter = new DocxExporterService({
      get: jest.fn(),
    } as unknown as ConfigService);
    const buffer = await exporter.buildDocxFromTiptapOrStructuredJson(
      {
        [LessonStageType.LESSON]: {
          structuredDataJson: { title: 'Título estruturado antigo' },
          tiptapAstJson: {
            type: 'doc',
            content: [
              {
                type: 'heading',
                attrs: { level: 1 },
                content: [{ type: 'text', text: 'LIÇÃO 20 – O SEMEADOR' }],
              },
              {
                type: 'heading',
                attrs: { level: 2 },
                content: [{ type: 'text', text: 'TEXTO BÍBLICO' }],
              },
              {
                type: 'paragraph',
                content: [
                  { type: 'text', text: 'Referência revisada pelo professor.' },
                ],
              },
            ],
          },
        },
      },
      20,
    );
    const zip = await JSZip.loadAsync(buffer);
    const xml: string = await zip.file('word/document.xml')!.async('string');
    const paragraphs = xml.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) ?? [];
    const texts = paragraphs.map((paragraph: string) =>
      paragraph.replace(/<[^>]+>/g, ''),
    );
    expect(texts).toEqual(
      expect.arrayContaining([
        'LIÇÃO 20',
        'TÍTULO',
        'O SEMEADOR',
        'TEXTO BÍBLICO',
        'Referência revisada pelo professor.',
      ]),
    );
    expect(texts).not.toContain('LIÇÃO 20 – O SEMEADOR');
    expect(xml).not.toContain('Título estruturado antigo');
  });

  it('T-B12: rejeita URLs de assets proibidas (SSRF) antes de tentar download', async () => {
    const exporter = new DocxExporterService({
      get: jest.fn(),
    } as unknown as ConfigService);

    await expect(
      exporter.buildDocxFromTiptapOrStructuredJson(
        {
          [LessonStageType.LESSON_VISUALS]: {
            structuredDataJson: {
              assets: [
                {
                  id: 'visual-1',
                  url: 'http://169.254.169.254/latest/meta-data/',
                  instruction: 'Passo 1',
                },
              ],
            },
          },
        },
        20,
      ),
    ).rejects.toThrow(
      'Acesso a endereço IP privado ou de metadados não é permitido.',
    );
  });
});
