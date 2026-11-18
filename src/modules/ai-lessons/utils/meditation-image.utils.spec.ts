import { LessonImagePurpose } from '../providers/lesson-llm.types';
import {
  lessonImageTextPolicy,
  buildMeditationActivityImagePrompt,
} from './meditation-image.utils';
import { meditationActivityAsset } from './meditation-assets.utils';

describe('meditation functional artwork', () => {
  it('allows puzzle labels only for meditation and preserves other image policies', () => {
    expect(lessonImageTextPolicy()).toBe(
      'Sem letras, palavras, números, logotipos ou marcas.',
    );
    expect(
      lessonImageTextPolicy(LessonImagePurpose.MEDITATION_ACTIVITY),
    ).toContain('indispensáveis ao enigma');
    const prompt = buildMeditationActivityImagePrompt(
      '4 a 7 anos',
      'Ordene as cenas.',
      'Três cenas embaralhadas.',
      '2, 1, 3',
    );
    expect(prompt).toContain('INSTRUÇÃO REAL: Ordene as cenas.');
    expect(prompt).toContain('NÃO PARA IMPRIMIR: 2, 1, 3');
    expect(prompt).toContain('não ligue nem destaque a correta');
  });
  it('maps optional assets by question id rather than array position', () => {
    const assets = [{ id: '3', url: 'third.png' }];
    expect(meditationActivityAsset(assets, 0, 3)).toEqual({});
    expect(meditationActivityAsset(assets, 2, 3)).toEqual(assets[0]);
  });
});
