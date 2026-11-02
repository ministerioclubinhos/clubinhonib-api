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
