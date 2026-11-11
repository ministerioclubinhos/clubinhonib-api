import { UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
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

describe('DocxExporterService — robustez da exportação', () => {
  const BUCKET = 'studio-bucket';
  const assetUrl = (name: string): string =>
    `https://${BUCKET}.s3.us-east-2.amazonaws.com/prod/uploads/1762700000000_ab12cd34_${name}`;
  const png = (width: number, height: number): Buffer => {
    const data = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(data);
    data.writeUInt32BE(13, 8);
    data.write('IHDR', 12, 'latin1');
    data.writeUInt32BE(width, 16);
    data.writeUInt32BE(height, 20);
    return data;
  };
  const jpeg = (width: number, height: number): Buffer => {
    const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, 0, 0, 0, 0, 0x03]);
    sof.writeUInt16BE(height, 5);
    sof.writeUInt16BE(width, 7);
    return Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46]),
      sof,
      Buffer.alloc(12),
    ]);
  };
  const exporterWithS3 = (image: Buffer) => {
    const downloadOwned = jest.fn().mockResolvedValue(image);
    const exporter = new DocxExporterService(
      {
        get: jest.fn((key: string) =>
          key === 'AWS_S3_BUCKET_NAME' ? BUCKET : undefined,
        ),
      } as unknown as ConfigService,
      { downloadOwned } as unknown as AwsS3Service,
    );
    return { exporter, downloadOwned };
  };
  const plainExporter = () =>
    new DocxExporterService({ get: jest.fn() } as unknown as ConfigService);
  const documentXml = async (buffer: Buffer): Promise<string> =>
    (await JSZip.loadAsync(buffer)).file('word/document.xml')!.async('string');
  const text = (value: string, marks?: unknown[]) => ({
    type: 'text',
    text: value,
    ...(marks ? { marks } : {}),
  });
  const paragraph = (...content: unknown[]) => ({ type: 'paragraph', content });
  const item = (...content: unknown[]) => ({ type: 'listItem', content });

  it('exporta cores rgb()/nomeadas e remove caracteres de controle sem derrubar o documento', async () => {
    const xml = await documentXml(
      await plainExporter().buildDocxFromTiptapOrStructuredJson({
        [LessonStageType.LESSON]: {
          tiptapAstJson: {
            type: 'doc',
            content: [
              paragraph(
                text('vermelho\u0001 colado\u000b', [
                  { type: 'textStyle', attrs: { color: 'rgb(255, 0, 0)' } },
                  { type: 'highlight', attrs: { color: 'yellow' } },
                ]),
                text('variável', [
                  { type: 'textStyle', attrs: { color: 'var(--x)' } },
                ]),
              ),
            ],
          },
        },
      }),
    );
    expect(xml).toContain('vermelho colado');
    expect(xml).toContain('w:color w:val="FF0000"');
    expect(xml).toContain('w:fill="FFFF00"');
    expect(
      Array.from(xml).some((character) => {
        const code = character.charCodeAt(0);
        return code < 0x20 && ![0x09, 0x0a, 0x0d].includes(code);
      }),
    ).toBe(false);
  });

  it('mantém todos os blocos de um item de lista, respeita start e não duplica o recuo', async () => {
    const xml = await documentXml(
      await plainExporter().buildDocxFromTiptapOrStructuredJson({
        [LessonStageType.LESSON]: {
          tiptapAstJson: {
            type: 'doc',
            content: [
              {
                type: 'orderedList',
                attrs: { start: 5 },
                content: [
                  item(
                    {
                      type: 'heading',
                      attrs: { level: 3 },
                      content: [text('Título no item')],
                    },
                    { type: 'codeBlock', content: [text('codigo()')] },
                    {
                      type: 'bulletList',
                      content: [
                        item(paragraph(text('nível dois')), {
                          type: 'bulletList',
                          content: [item(paragraph(text('nível três')))],
                        }),
                      ],
                    },
                  ),
                  item(paragraph(text('sexto'))),
                ],
              },
            ],
          },
        },
      }),
    );
    expect(xml).toContain('Título no item');
    expect(xml).toContain('codigo()');
    expect(xml).toContain('5. ');
    expect(xml).toContain('6. ');
    expect(xml).not.toContain('>1. <');
    const indents = [...xml.matchAll(/<w:ind w:left="(\d+)"/g)].map((match) =>
      Number(match[1]),
    );
    expect(new Set(indents)).toEqual(new Set([360, 720, 1080]));
  });

  it('quebra a linha entre pergunta e resposta no documento sem AST', async () => {
    const xml = await documentXml(
      await plainExporter().buildDocxFromTiptapOrStructuredJson({
        [LessonStageType.LESSON]: {
          structuredDataJson: {
            title: 'TEMA',
            reviewQuestions: [{ question: 'Quem?', answer: 'Jesus.' }],
          },
        },
      }),
    );
    expect(xml).toContain('1. Quem?');
    expect(xml).toMatch(/<w:br\/>\s*<w:t[^>]*>Resposta: Jesus\./);
    expect(xml).not.toContain('Quem?\nResposta');
  });

  it('lê os assets do bucket pelo SDK, uma vez por URL, com proporção e tipo reais', async () => {
    const { exporter, downloadOwned } = exporterWithS3(png(1536, 1024));
    const url = assetUrl('lesson-1-LESSON_VISUALS-kit-01.png');
    const buffer = await exporter.buildDocxFromTiptapOrStructuredJson({
      [LessonStageType.LESSON_VISUALS]: {
        structuredDataJson: {
          assets: [
            { id: 'kit-01', url },
            { id: 'kit-02', url },
            {
              id: 'kit-03',
              url: assetUrl('lesson-1-LESSON_VISUALS-kit-03.png'),
            },
          ],
        },
      },
    });
    expect(downloadOwned).toHaveBeenCalledTimes(2);
    expect(downloadOwned).toHaveBeenCalledWith(url, expect.any(Number));
    const xml = await documentXml(buffer);
    // 1070 × 713 px at 9525 EMU per pixel: 1536×1024 fitted, not stretched to 1070×758.
    expect(xml).toContain('cx="10191750" cy="6791325"');
    expect(xml).not.toContain('cy="7219950"');
  });

  it('declara JPEG como JPEG no pacote', async () => {
    const { exporter } = exporterWithS3(jpeg(1024, 1536));
    const zip = await JSZip.loadAsync(
      await exporter.buildDocxFromTiptapOrStructuredJson({
        [LessonStageType.VERSE_VISUALS]: {
          structuredDataJson: {
            printableAssets: [
              { id: 'card-01', url: assetUrl('l-VERSE_VISUALS-1.jpg') },
            ],
          },
        },
      }),
    );
    const media = Object.keys(zip.files).filter((name) =>
      name.startsWith('word/media/'),
    );
    expect(media.some((name) => name.endsWith('.jpg'))).toBe(true);
  });

  it.each([
    [
      'imagem sem URL em etapa visual',
      {
        [LessonStageType.STANDARD_GAME]: {
          structuredDataJson: {
            name: 'Roda',
            steps: ['a'],
            assets: [{ id: 'instrucao-01', instruction: 'a' }],
          },
        },
      },
      'Uma imagem obrigatória deste item ainda não foi gerada',
    ],
    [
      'trabalho manual sem arte',
      {
        [LessonStageType.MANUAL_WORK]: {
          structuredDataJson: { verseText: 'Texto', printableAssets: [] },
        },
      },
      'ainda não possui a arte para colorir',
    ],
    [
      'folha dos menores com atividades além do suportado',
      {
        [LessonStageType.MEDITATION_YOUNGER]: {
          structuredDataJson: {
            title: 'Tema',
            activities: [
              { instruction: 'Um.' },
              { instruction: 'Dois.' },
              { instruction: 'Três.' },
            ],
          },
        },
      },
      'comporta no máximo 2 atividades',
    ],
  ])(
    'responde 422 para %s em vez de omitir conteúdo',
    async (_label, input, message) => {
      const error = await plainExporter()
        .buildDocxFromTiptapOrStructuredJson(input)
        .catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(UnprocessableEntityException);
      expect((error as Error).message).toContain(message);
    },
  );

  it('rejeita a folha dos menores cujo texto não cabe em vez de cortá-la no PDF', async () => {
    const long =
      'Leia com atenção e pinte somente o que aconteceu na história. '.repeat(
        40,
      );
    await expect(
      plainExporter().buildDocxFromTiptapOrStructuredJson({
        [LessonStageType.MEDITATION_YOUNGER]: {
          structuredDataJson: {
            title: 'Tema',
            verseText: 'Jesus vive.',
            verseReference: 'João 11:25',
            prayer: 'Obrigado, Jesus.',
            activities: [{ instruction: long }, { instruction: long }],
          },
        },
      }),
    ).rejects.toThrow('não cabe nas duas cópias da folha');
  });
});
