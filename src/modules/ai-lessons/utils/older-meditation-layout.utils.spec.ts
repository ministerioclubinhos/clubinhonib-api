import { Document, Packer } from 'docx';
import * as JSZip from 'jszip';
import { buildOlderMeditationSheet } from './older-meditation-layout.utils';

describe('older meditation PDF layout', () => {
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
