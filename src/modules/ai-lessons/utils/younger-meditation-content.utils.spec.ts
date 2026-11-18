import { editedYoungerMeditation } from './younger-meditation-content.utils';
import { buildYoungerMeditationImagePrompt } from './younger-meditation-image.utils';

describe('meditação dos menores', () => {
  it('recupera atividades de versões antigas sem apagar imagens nem o gabarito interno', () => {
    const data = {
      activities: [{ instruction: 'Pinte Jesus.', answer: 'Jesus' }],
      printableAssets: [{ url: 'imagem-salva' }],
    };
    expect(editedYoungerMeditation(data, { content: [] })).toEqual(data);
  });

  it('aplica o versículo e a oração revisados à folha duplicada', () => {
    const heading = (text: string) => ({
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text }],
    });
    const paragraph = (text: string) => ({
      type: 'paragraph',
      content: [{ type: 'text', text }],
    });
    expect(
      editedYoungerMeditation(
        { verseText: 'Antigo', prayer: 'Antiga' },
        {
          content: [
            heading('VERSÍCULO PARA MEMORIZAR'),
            paragraph('“Jesus vive.”'),
            paragraph('João 11:25 — NVI'),
            heading('FALANDO COM DEUS'),
            paragraph('Jesus, obrigado pela vida.'),
          ],
        },
      ),
    ).toMatchObject({
      verseText: 'Jesus vive.',
      verseReference: 'João 11:25',
      prayer: 'Jesus, obrigado pela vida.',
    });
  });

  it('gera a arte necessária à instrução sem repetir a moldura da página', () => {
    const prompt = buildYoungerMeditationImagePrompt(
      'Pinte o nome MARIA.',
      'Jesus e Maria no jardim.',
    );
    expect(prompt).toContain('Pinte o nome MARIA.');
    expect(prompt).toContain('Jesus e Maria no jardim.');
    expect(prompt).toContain('desafio executável');
    expect(prompt).toContain('Letras, números e palavras curtas');
    expect(prompt).toContain('Não acrescente cabeçalho');
  });
});

it('conserva campos explicitamente vazios do core de edição', () => {
  const document = {
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'FALANDO COM DEUS' }],
      },
      { type: 'paragraph', content: [] },
    ],
  };
  expect(
    editedYoungerMeditation({ prayer: 'Oração antiga' }, document),
  ).toMatchObject({ prayer: '' });
});
