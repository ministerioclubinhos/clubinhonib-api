import { Document, Packer } from 'docx';
import * as JSZip from 'jszip';
import { buildOlderMeditationSheet } from './older-meditation-layout.utils';
import { olderMeditationActivityBlocks } from './older-meditation-activity.utils';
import { fitOlderMeditationSheet } from './older-meditation-fit.utils';

describe('older meditation PDF layout', () => {
  it('fits long question blocks plus native puzzle rows inside the available body before rendering the prayer', () => {
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
    expect(fit.fontSize).toBeGreaterThanOrEqual(18);
    expect(
      fit.weights.reduce((sum, height) => sum + height, 0),
    ).toBeLessThanOrEqual(fit.activitySpace);
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
      ).reduce((sum, match) => sum + Number(match[1]), 0);
    expect(activityHeight(long)).toBeGreaterThan(0);
    expect(activityHeight(long)).toBeLessThan(10000);
    expect(activityHeight(long)).toBeLessThan(activityHeight(short));
    expect(long).toContain('FALANDO COM DEUS:');
    expect(long).toContain('FIM DA ORAÇÃO.');
    expect(long).toContain('w:val="15400" w:hRule="exact"');
  });
});
