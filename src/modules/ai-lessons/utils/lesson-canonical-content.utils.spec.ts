import { ConflictException } from '@nestjs/common';
import { LessonStageType } from '../enums/lesson.enums';
import {
  attachOwnedAssetUrls,
  extractOwnedLessonVersionAssetUrls,
  preserveServerOwnedAssetsOnManualSave,
} from './lesson-asset-ownership.utils';
import {
  assertStageReadyForCompletionOrPublication,
  reconcileStageStructuredContent,
} from './lesson-canonical-content.utils';

describe('lesson-canonical-content & lesson-asset-ownership utils (BE02/BE03)', () => {
  it('reconciles emptied LESSON story and memoryVerse instead of keeping stale structured values', () => {
    const previous = {
      title: 'LIÇÃO: AMOR DE DEUS',
      biblicalReference: 'João 3:16',
      story: 'História original completa que foi apagada no editor.',
      memoryVerse: {
        text: 'Porque Deus amou o mundo.',
        reference: 'João 3:16',
        version: 'NVI',
      },
    };
    const emptiedAst = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'LIÇÃO BÍBLICA' }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'VERSÍCULO PARA MEMORIZAR' }],
        },
      ],
    };

    const reconciled = reconcileStageStructuredContent(
      LessonStageType.LESSON,
      previous,
      undefined,
      emptiedAst,
    );

    expect(reconciled.story).toBe('');
    expect(reconciled.memoryVerse).toEqual({
      text: '',
      reference: '',
      version: '',
    });
    expect(() =>
      assertStageReadyForCompletionOrPublication(
        LessonStageType.LESSON,
        reconciled,
        emptiedAst,
      ),
    ).toThrow(ConflictException);
  });

  it('synchronizes edited game steps into assets[].instruction when step count matches', () => {
    const previous = {
      name: 'Roda da Alegria',
      steps: ['Passo antigo 1', 'Passo antigo 2'],
      assets: [
        {
          id: 'instrucao-01',
          stepNumber: 1,
          instruction: 'Passo antigo 1',
          url: 'https://studio-bucket.s3.us-east-1.amazonaws.com/lesson-1-STANDARD_GAME-instrucao-01.png',
        },
        {
          id: 'instrucao-02',
          stepNumber: 2,
          instruction: 'Passo antigo 2',
          url: 'https://studio-bucket.s3.us-east-1.amazonaws.com/lesson-1-STANDARD_GAME-instrucao-02.png',
        },
      ],
    };
    const editedAst = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'PASSO A PASSO' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Passo revisado 1' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Passo revisado 2' }],
                },
              ],
            },
          ],
        },
      ],
    };

    const reconciled = reconcileStageStructuredContent(
      LessonStageType.STANDARD_GAME,
      previous,
      undefined,
      editedAst,
    );

    expect(reconciled.steps).toEqual(['Passo revisado 1', 'Passo revisado 2']);
    expect(reconciled.assets).toEqual([
      expect.objectContaining({
        id: 'instrucao-01',
        stepNumber: 1,
        instruction: 'Passo revisado 1',
        url: 'https://studio-bucket.s3.us-east-1.amazonaws.com/lesson-1-STANDARD_GAME-instrucao-01.png',
      }),
      expect.objectContaining({
        id: 'instrucao-02',
        stepNumber: 2,
        instruction: 'Passo revisado 2',
        url: 'https://studio-bucket.s3.us-east-1.amazonaws.com/lesson-1-STANDARD_GAME-instrucao-02.png',
      }),
    ]);
    expect(() =>
      assertStageReadyForCompletionOrPublication(
        LessonStageType.STANDARD_GAME,
        reconciled,
        editedAst,
      ),
    ).not.toThrow();
  });

  it('rejects game completion when edited step count diverges from generated instructional images', () => {
    const previous = {
      name: 'Roda da Alegria',
      steps: ['Passo 1', 'Passo 2'],
      assets: [
        {
          id: 'instrucao-01',
          stepNumber: 1,
          instruction: 'Passo 1',
          url: 'https://studio-bucket.s3.us-east-1.amazonaws.com/lesson-1-STANDARD_GAME-instrucao-01.png',
        },
        {
          id: 'instrucao-02',
          stepNumber: 2,
          instruction: 'Passo 2',
          url: 'https://studio-bucket.s3.us-east-1.amazonaws.com/lesson-1-STANDARD_GAME-instrucao-02.png',
        },
      ],
    };
    const editedAstWithOneStep = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'PASSO A PASSO' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Apenas um passo restante' }],
                },
              ],
            },
          ],
        },
      ],
    };

    const reconciled = reconcileStageStructuredContent(
      LessonStageType.STANDARD_GAME,
      previous,
      undefined,
      editedAstWithOneStep,
    );

    expect(reconciled.steps).toEqual(['Apenas um passo restante']);
    expect(() =>
      assertStageReadyForCompletionOrPublication(
        LessonStageType.STANDARD_GAME,
        reconciled,
        editedAstWithOneStep,
      ),
    ).toThrow('quantidade de passos do texto editado não corresponde');
  });

  it('reconciles MEDITATION_YOUNGER edits into structuredDataJson on saveContent', () => {
    const previous = {
      title: 'Título Antigo',
      prayer: 'Oração antiga.',
      activities: [
        { number: 1, instruction: 'Pinte o desenho antigo.' },
        { number: 2, instruction: 'Ligue os pontos.' },
      ],
      printableAssets: [
        {
          id: 'med-01',
          url: 'https://studio-bucket.s3.us-east-1.amazonaws.com/lesson-1-MEDITATION_YOUNGER-med-01.png',
        },
      ],
    };
    const editedAst = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Título Novo dos Menores' }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'INSTRUÇÃO' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Circule o personagem principal.' }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'FALANDO COM DEUS' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Obrigado, Senhor.' }],
        },
      ],
    };

    const reconciled = reconcileStageStructuredContent(
      LessonStageType.MEDITATION_YOUNGER,
      previous,
      undefined,
      editedAst,
    );

    expect(reconciled.title).toBe('Título Novo dos Menores');
    expect(reconciled.prayer).toBe('Obrigado, Senhor.');
    expect(reconciled.activities).toEqual([
      expect.objectContaining({
        instruction: 'Circule o personagem principal.',
      }),
      expect.objectContaining({
        instruction: 'Ligue os pontos.',
      }),
    ]);
  });

  it('prevents arbitrary S3 URLs injected into structuredDataJson or text fields from being treated as lesson-owned on delete', () => {
    const lessonId = 'lesson-111';
    const ownedUrl =
      'https://studio-bucket.s3.us-east-1.amazonaws.com/lesson-111-LESSON_VISUALS-visual-01.png';
    const foreignLessonUrl =
      'https://studio-bucket.s3.us-east-1.amazonaws.com/lesson-999-LESSON_VISUALS-visual-01.png';
    const sharedMediaUrl =
      'https://studio-bucket.s3.us-east-1.amazonaws.com/shared-banner.png';

    const withOwned = attachOwnedAssetUrls(
      {
        assets: [{ id: 'visual-01', url: ownedUrl }],
      },
      [ownedUrl],
    );

    const afterManualSave = preserveServerOwnedAssetsOnManualSave(withOwned, {
      story: `Veja ${sharedMediaUrl} e ${foreignLessonUrl}`,
      _ownedAssetUrls: [sharedMediaUrl, foreignLessonUrl],
      assets: [{ id: 'visual-01', url: sharedMediaUrl }],
    });

    expect(afterManualSave._ownedAssetUrls).toEqual([ownedUrl]);
    expect(afterManualSave.assets).toEqual([
      expect.objectContaining({ url: ownedUrl }),
    ]);

    const extracted = extractOwnedLessonVersionAssetUrls(
      lessonId,
      {
        docxS3Key: null,
        pdfS3Key: null,
        structuredDataJson: {
          ...afterManualSave,
          story: `Texto com link ${sharedMediaUrl}`,
          _ownedAssetUrls: [ownedUrl, sharedMediaUrl, foreignLessonUrl],
        },
      },
      'studio-bucket',
    );

    expect(extracted).toEqual([ownedUrl]);
  });
});

const heading = (text: string, level = 2) => ({
  type: 'heading',
  attrs: { level },
  content: [{ type: 'text', text }],
});
const para = (text: string) => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
});
const doc = (...content: unknown[]) => ({ type: 'doc', content });
const lessonBase = {
  title: 'O BOM PASTOR',
  purpose: 'OLD PURPOSE',
  songs: ['s1'],
  memoryVerse: { text: 'Antigo.', reference: 'João 10:11', version: 'NVI' },
  story: 'História antiga.',
  applicationAndAppeal: 'OLD APP',
  counseling: 'OLD C',
  reviewQuestions: [{ question: 'Antiga?', answer: 'Sim.' }],
  closingPrayer: 'OLD PRAYER',
};
const reconcileLesson = (ast: Record<string, unknown>, base = lessonBase) =>
  reconcileStageStructuredContent(LessonStageType.LESSON, base, undefined, ast);

describe('canonical reconciliation — verse, sections and questions (BE03)', () => {
  it.each([
    [
      'versículo em dois parágrafos seguido da referência',
      [
        para('“Linha um do versículo,'),
        para('linha dois do versículo”'),
        para('Salmos 23:1 — NVI'),
      ],
      {
        text: 'Linha um do versículo, linha dois do versículo',
        reference: 'Salmos 23:1',
        version: 'NVI',
      },
    ],
    [
      'versículo com travessão em linha única',
      [
        para(
          '“Deus é amor — e quem permanece no amor permanece em Deus” — 1 João 4:16 — NVI',
        ),
      ],
      {
        text: 'Deus é amor — e quem permanece no amor permanece em Deus',
        reference: '1 João 4:16',
        version: 'NVI',
      },
    ],
    [
      'referência entre parênteses',
      [para('“Jesus chorou.” (João 11:35 - NVI)')],
      { text: 'Jesus chorou.', reference: 'João 11:35', version: 'NVI' },
    ],
    [
      'intervalo de versículos com meia-risca',
      [para('“O Senhor é o meu pastor.”'), para('Salmos 23:1–3 — NVI')],
      {
        text: 'O Senhor é o meu pastor.',
        reference: 'Salmos 23:1–3',
        version: 'NVI',
      },
    ],
    [
      'somente o texto: mantém a referência já aprovada',
      [para('“Eu sou o bom pastor.”')],
      { text: 'Eu sou o bom pastor.', reference: 'João 10:11', version: 'NVI' },
    ],
  ])('lê %s', (_label, nodes, expected) => {
    const reconciled = reconcileLesson(
      doc(heading('VERSÍCULO PARA MEMORIZAR'), ...nodes),
    );
    expect(reconciled.memoryVerse).toEqual(expected);
  });

  it('explica quando a referência não pôde ser identificada em vez de gravar texto como referência', () => {
    const ast = doc(
      heading('VERSÍCULO PARA MEMORIZAR'),
      para('“Primeira parte do versículo,'),
      para('segunda parte sem referência”'),
      heading('LIÇÃO BÍBLICA'),
      para('Jesus contou uma história completa.'),
    );
    const reconciled = reconcileLesson(ast);
    expect(reconciled.memoryVerse).toEqual({
      text: 'Primeira parte do versículo, segunda parte sem referência',
      reference: '',
      version: 'NVI',
    });
    expect(() =>
      assertStageReadyForCompletionOrPublication(
        LessonStageType.LESSON,
        reconciled,
        ast,
      ),
    ).toThrow('Não foi possível identificar a referência do versículo');
  });

  it('rejeita com mensagem específica uma referência fora do formato Livro capítulo:versículo', () => {
    expect(() =>
      assertStageReadyForCompletionOrPublication(LessonStageType.LESSON, {
        story: 'Narrativa completa.',
        memoryVerse: {
          text: 'Texto.',
          reference: 'referência',
          version: 'NVI',
        },
      }),
    ).toThrow('não está no formato Livro capítulo:versículo');
  });

  it('não trunca a narrativa em um subtítulo livre e separa células de tabela', () => {
    const reconciled = reconcileLesson(
      doc(
        heading('LIÇÃO BÍBLICA'),
        para('Início.'),
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                { type: 'tableCell', content: [para('celA')] },
                { type: 'tableCell', content: [para('celB')] },
              ],
            },
          ],
        },
        heading('Meu subtítulo'),
        para('Texto depois do subtítulo.'),
        heading('Aplicação & Apelo'),
        para('Nova aplicação.'),
      ),
    );
    expect(reconciled.story).toBe(
      'Início.\n\ncelA | celB\n\n### Meu subtítulo\n\nTexto depois do subtítulo.',
    );
    // "&" and accents do not prevent recognising the section.
    expect(reconciled.applicationAndAppeal).toBe('Nova aplicação.');
  });

  it('esvazia campos editoriais cujo título foi removido do documento', () => {
    const reconciled = reconcileLesson(
      doc(
        heading('O BOM PASTOR', 1),
        heading('LIÇÃO BÍBLICA'),
        para('Só a história.'),
      ),
    );
    expect(reconciled).toMatchObject({
      title: 'O BOM PASTOR',
      story: 'Só a história.',
      purpose: '',
      songs: [],
      memoryVerse: { text: '', reference: '', version: '' },
      applicationAndAppeal: '',
      counseling: '',
      reviewQuestions: [],
      closingPrayer: '',
    });
  });

  it('não altera os dados quando o documento livre não tem nenhuma seção conhecida', () => {
    expect(reconcileLesson(doc(para('Texto solto.')))).toEqual(lessonBase);
  });

  it('mantém respostas de vários parágrafos e pergunta com resposta na mesma linha', () => {
    const reconciled = reconcileLesson(
      doc(
        heading('PERGUNTAS DA LIÇÃO'),
        para('1. Quem criou tudo?'),
        para('Resposta: Deus.'),
        para('Ele criou em seis dias.'),
        para('2. Onde? Resposta: no Éden'),
        para('Quem pecou?'),
      ),
    );
    expect(reconciled.reviewQuestions).toEqual([
      {
        question: 'Quem criou tudo?',
        answer: 'Deus.\nEle criou em seis dias.',
      },
      { question: 'Onde?', answer: 'no Éden' },
      { question: 'Quem pecou?', answer: '' },
    ]);
  });

  it('sincroniza duração, objetivo removido e adaptações por idade da brincadeira', () => {
    const base = {
      name: 'Roda',
      objective: 'OLD OBJ',
      durationMinutes: 10,
      steps: ['a'],
      ageAdaptations: { ages5To7: 'antigo 5', ages8To11: 'antigo 8' },
    };
    const reconciled = reconcileStageStructuredContent(
      LessonStageType.STANDARD_GAME,
      base,
      undefined,
      doc(
        heading('NOME'),
        para('Roda Nova'),
        heading('DURAÇÃO EM MINUTOS'),
        para('25'),
        heading('PASSO A PASSO'),
        para('1. Formar a roda'),
        heading('ADAPTAÇÕES POR IDADE'),
        heading('CRIANÇAS DE 5 A 7 ANOS', 3),
        para('Mais devagar.'),
      ),
    );
    expect(reconciled).toMatchObject({
      name: 'Roda Nova',
      objective: '',
      durationMinutes: 25,
      steps: ['Formar a roda'],
      ageAdaptations: { ages5To7: 'Mais devagar.', ages8To11: '' },
    });
  });

  it('ignora chaves enviadas pelo cliente e nunca apaga dados do servidor', () => {
    const server = {
      story: 'Narrativa do servidor.',
      memoryVerse: { text: 'Texto.', reference: 'João 3:16', version: 'NVI' },
    };
    expect(
      reconcileStageStructuredContent(
        LessonStageType.LESSON,
        server,
        { injected: 'x', story: '' },
        doc(para('sem seções')),
      ),
    ).toEqual(server);
    expect(
      reconcileStageStructuredContent(LessonStageType.LESSON, server, {}, null),
    ).toEqual(server);

    const visuals = {
      visualConfig: { type: 'CUTOUT_KIT', quantity: 4 },
      assets: [
        {
          id: 'kit-01',
          caption: 'old',
          url: 'https://b.s3.amazonaws.com/a.png',
        },
      ],
    };
    expect(
      reconcileStageStructuredContent(
        LessonStageType.LESSON_VISUALS,
        visuals,
        {
          visualConfig: { type: 'HACK', quantity: 99 },
          assets: [
            { id: 'kit-01', caption: 'NEW', url: 'http://169.254.169.254/' },
          ],
          extra: true,
        },
        doc(para('qualquer')),
      ),
    ).toEqual(visuals);
  });

  it('exige o conteúdo obrigatório de cada etapa mesmo quando a chave não existe', () => {
    const ast = doc(para('Documento sem seções.'));
    const cases: Array<[LessonStageType, string]> = [
      [LessonStageType.LESSON, 'LIÇÃO BÍBLICA vazio'],
      [LessonStageType.STANDARD_GAME, 'ao menos um passo'],
      [LessonStageType.LESSON_VISUALS, 'imagens válidas'],
      [LessonStageType.VERSE_VISUALS, 'artes imprimíveis'],
      [LessonStageType.MANUAL_WORK, 'artes imprimíveis'],
    ];
    for (const [stage, message] of cases) {
      expect(() =>
        assertStageReadyForCompletionOrPublication(stage, {}, ast),
      ).toThrow(message);
    }
    expect(() =>
      assertStageReadyForCompletionOrPublication(
        LessonStageType.MEDITATION_OLDER,
        { activities: [] },
        ast,
      ),
    ).toThrow('instruções preenchidas');
    // Legacy free-form meditation without structured activities is still allowed.
    expect(() =>
      assertStageReadyForCompletionOrPublication(
        LessonStageType.MEDITATION_YOUNGER,
        { title: 'Antiga' },
        ast,
      ),
    ).not.toThrow();
  });

  describe('brincadeira divertida com imagem de compilado', () => {
    const game = (url: string) => ({
      name: 'Missão Resgate',
      steps: [
        'Forme duas equipes.',
        'Leve as ovelhas ao aprisco.',
        'Comemore juntos.',
      ],
      assets: [
        {
          id: 'compilado-01',
          purpose: 'Resumo da brincadeira',
          prompt: 'Infográfico',
          altText: 'Resumo',
          url,
        },
      ],
    });

    it('aceita uma única imagem com qualquer quantidade de passos', () => {
      expect(() =>
        assertStageReadyForCompletionOrPublication(
          LessonStageType.STANDARD_GAME,
          game(
            'https://studio-bucket.s3.us-east-1.amazonaws.com/compilado.png',
          ),
        ),
      ).not.toThrow();
    });

    it('exige a imagem do compilado gerada', () => {
      expect(() =>
        assertStageReadyForCompletionOrPublication(
          LessonStageType.STANDARD_GAME,
          game(''),
        ),
      ).toThrow(ConflictException);
    });

    it('não amarra o compilado a um passo quando o texto é editado', () => {
      const editedAst = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'PASSO A PASSO' }],
          },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Passo único revisado' }],
                  },
                ],
              },
            ],
          },
        ],
      };
      const reconciled = reconcileStageStructuredContent(
        LessonStageType.STANDARD_GAME,
        game('https://studio-bucket.s3.us-east-1.amazonaws.com/compilado.png'),
        undefined,
        editedAst,
      );
      expect(reconciled.steps).toEqual(['Passo único revisado']);
      const [asset] = reconciled.assets as Record<string, unknown>[];
      expect(asset.id).toBe('compilado-01');
      expect(asset.stepNumber).toBeUndefined();
      expect(asset.instruction).toBeUndefined();
    });
  });
});
