import { Document, Packer, Table } from 'docx';
import * as JSZip from 'jszip';
import { buildOlderMeditationSheet } from './older-meditation-layout.utils';
import { olderMeditationActivityBlocks } from './older-meditation-activity.utils';
import { fitOlderMeditationSheet } from './older-meditation-fit.utils';

describe('older meditation PDF layout', () => {
  it('reports overflow instead of silently shrinking a dense sheet below readable size', () => {
    const dense =
      'Leia os fatos da lição e responda aos seis subitens com atenção.\n' +
      Array.from(
        { length: 6 },
        (_, index) =>
          `${index + 1}) Recorde o que aconteceu na história e explique como Jesus demonstrou compaixão pelas pessoas. Escreva uma resposta breve ligada ao acontecimento estudado. ____________________`,
      ).join('\n');
    const fit = fitOlderMeditationSheet({
      title:
        'O PODER DE JESUS SOBRE A MORTE (RESSURREIÇÃO DE LÁZARO E O FILHO DA VIÚVA).',
      verse:
        'Disse-lhe Jesus: Eu sou a ressurreição e a vida. Aquele que crê em mim, ainda que morra, viverá; e todo aquele que vive e crê em mim nunca morrerá. Você crê nisso?\nJoão 11:25-26 — NVI',
      biblicalText: 'João 11:1-44; Lucas 7:11-17',
      introduction:
        'Hoje, vamos aprender sobre o incrível poder de Jesus sobre a morte. Ele ressuscitou duas pessoas, mostrando que é o Senhor da vida!',
      prayer:
        'Obrigada, Jesus, pelo Teu poder sobre a morte e por nos dar a esperança da vida eterna. Ajuda-me a confiar sempre em Ti. Amém!',
      logo: Buffer.from('logo'),
      activities: [
        { instruction: dense },
        { instruction: dense },
        {
          instruction:
            'Caça-palavras: encontre os nomes.\n' +
            'A B C D E F G H I J K L M N\n'.repeat(8) +
            'Palavras: JESUS, VIDA',
        },
      ],
    });
    expect(fit.fontSize).toBeLessThan(22);
    expect(fit.fontSize).toBeGreaterThanOrEqual(20);
    expect(fit.fits).toBe(false);
    expect(
      fit.weights.reduce((sum, height) => sum + height, 0),
    ).toBeGreaterThan(fit.activitySpace);
  });
  it('reduces image boxes incrementally to fit all three without reducing text below 10pt', () => {
    const base = {
      title: 'Tema da lição',
      verse: 'Versículo da lição.',
      biblicalText: 'Referência',
      introduction: 'Uma introdução breve para a folha.',
      prayer: 'Senhor, ajuda-nos.',
      logo: Buffer.alloc(0),
      activities: [1, 2, 3].map(() => ({
        instruction:
          'Observe a cena e responda.\n' +
          'Uma pergunta sobre o relato.\n'.repeat(8),
        image: Buffer.alloc(0),
      })),
    };
    const fit = fitOlderMeditationSheet(base);
    expect(fit.fits).toBe(true);
    expect(fit.fontSize).toBeGreaterThanOrEqual(20);
    expect(fit.imageHeight).toBeLessThan(230);
    expect(fit.imageHeight).toBeGreaterThanOrEqual(140);
    expect(fit.weights).toHaveLength(3);
  });
  it('renders a rectangular puzzle as equal native cells and preserves styled prose without duplicate block numbers', async () => {
    const instruction =
      '3. Caça-palavras: encontre JESUS.\nJESUS\nABCDE\nFGHIJ\nPalavras: JESUS';
    const document = {
      content: [
        {
          type: 'paragraph',
          attrs: { meditationField: 'thirdActivity' },
          content: [
            { type: 'text', text: instruction, marks: [{ type: 'bold' }] },
          ],
        },
      ],
    };
    const buffer = await Packer.toBuffer(
      new Document({
        sections: [
          {
            children: olderMeditationActivityBlocks(
              document,
              2,
              instruction,
              22,
            ),
          },
        ],
      }),
    );
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('3. Caça-palavras: encontre JESUS.');
    expect(xml).not.toContain('3. 3.');
    expect(xml).toContain('Courier New');
    expect(xml.match(/<w:tc>/g)).toHaveLength(15);
    expect(xml.match(/<w:gridCol w:w="320"/g)).toHaveLength(5);
    expect(xml).toContain('<w:b/>');
    expect(xml).toContain('Palavras: JESUS');
  });
  it('reserves room for a long header and the entire prayer instead of allocating it to activities', async () => {
    const xml = async (verse: string) => {
      const buffer = await Packer.toBuffer(
        new Document({
          sections: [
            {
              children: buildOlderMeditationSheet({
                title:
                  'O PODER DE JESUS SOBRE A MORTE (Ressurreição de Lázaro e o filho da viúva).',
                verse,
                biblicalText: 'João 11:1-44; Lucas 7:11-17',
                introduction:
                  'Jesus mostrou seu poder sobre a morte e sua compaixão por duas famílias.',
                prayer:
                  'Senhor Jesus, obrigado por cuidar de nós e nos ensinar a confiar em ti. FIM DA ORAÇÃO.',
                logo: Buffer.from('test-logo'),
                activities: [
                  {
                    instruction:
                      'Complete as frases sobre o milagre em Naim.\nA) Jesus teve compaixão da viúva.\nB) O jovem voltou à vida.',
                  },
                  {
                    instruction:
                      'Circule as alternativas sobre Lázaro.\nA) Marta e Maria eram suas irmãs.\nB) Jesus mandou retirar a pedra.',
                  },
                  {
                    instruction:
                      'Escreva como você pode demonstrar compaixão nesta semana.',
                  },
                ],
              }),
            },
          ],
        }),
      );
      const zip = await JSZip.loadAsync(buffer);
      return zip.file('word/document.xml')!.async('string');
    };
    const short = await xml('Eu sou a ressurreição e a vida. João 11:25');
    const long = await xml(
      'Disse-lhe Jesus: Eu sou a ressurreição e a vida. Aquele que crê em mim, ainda que morra, viverá; e todo aquele que vive e crê em mim nunca morrerá. Você crê nisso? João 11:25-26 — NVI',
    );
    const activityHeight = (document: string) =>
      Array.from(
        document.matchAll(/<w:trHeight w:val="(\d+)" w:hRule="atLeast"\/>/g),
      )
        .filter((match) => Number(match[1]) !== 15400)
        .reduce((sum, match) => sum + Number(match[1]), 0);
    expect(activityHeight(long)).toBeGreaterThan(0);
    expect(activityHeight(long)).toBeLessThan(10000);
    expect(activityHeight(long)).toBeLessThanOrEqual(activityHeight(short));
    expect(long).toContain('FALANDO COM DEUS:');
    expect(long).toContain('FIM DA ORAÇÃO.');
    expect(long).toContain('w:val="15400" w:hRule="atLeast"');
  });
});

describe('older meditation overflow protection', () => {
  it('rejects a sheet that cannot fit rather than clipping exercises or prayer', () => {
    expect(() =>
      buildOlderMeditationSheet({
        title: 'Tema',
        verse: 'Versículo',
        biblicalText: 'Referência',
        introduction: 'Introdução',
        prayer: 'Oração final.',
        logo: Buffer.from('logo'),
        activities: Array.from({ length: 3 }, () => ({
          instruction: 'Texto extenso '.repeat(1000),
        })),
      }),
    ).toThrow('não cabe');
  });
});

describe('older meditation edited formatting', () => {
  it('detects oversized saved font sizes instead of trusting only plain text length', () => {
    const sheet = {
      title: 'Tema',
      verse: 'Versículo',
      biblicalText: 'Referência',
      introduction: 'Introdução',
      prayer: 'Oração',
      logo: Buffer.from('logo'),
      activities: [
        { instruction: 'Questão curta.' },
        { instruction: 'Outra questão.' },
        { instruction: 'Aplicação.' },
      ],
    };
    expect(fitOlderMeditationSheet(sheet).fits).toBe(true);
    const withFontSize = (fontSize: string) => ({
      ...sheet,
      document: {
        content: [
          {
            type: 'paragraph',
            attrs: { meditationField: 'firstActivity' },
            content: [
              {
                type: 'text',
                text: 'Questão com fonte ampliada no editor. '.repeat(12),
                marks: [{ type: 'textStyle', attrs: { fontSize } }],
              },
            ],
          },
        ],
      },
    });
    expect(fitOlderMeditationSheet(withFontSize('96pt')).fits).toBe(false);
    // Sizes the exporter refuses to render (above 96 pt) are measured as the
    // default size too, so measurement and PDF never disagree.
    expect(fitOlderMeditationSheet(withFontSize('300pt')).fits).toBe(true);
  });

  it('does not turn three identical answer-blank lines into a puzzle grid', () => {
    const blocks = olderMeditationActivityBlocks(
      undefined,
      0,
      'Caça-palavras: escreva o que encontrou.\n______\n______\n______',
      22,
    );
    expect(blocks.some((block) => block instanceof Table)).toBe(false);
  });
});
