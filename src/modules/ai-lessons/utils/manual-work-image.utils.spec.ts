import { buildManualWorkImagePrompt } from './manual-work-image.utils';
import { lessonImageTextPolicy } from './meditation-image.utils';
import { LessonImagePurpose } from '../providers/lesson-llm.types';

describe('manual work coloring image', () => {
  it.each([
    'Cena do relato com roupas vermelhas e céu azul.',
    'Uma casa e uma família.',
    'Elementos da criação.',
  ])(
    'applies the unpainted outline requirement after any proposed composition: %s',
    (composition) => {
      const prompt = buildManualWorkImagePrompt(composition);
      expect(prompt.startsWith(composition)).toBe(true);
      expect(prompt).toContain('contornos pretos sobre fundo branco puro');
      expect(prompt).toContain('áreas internas brancas amplas');
      expect(prompt).toContain('Não use cores, tons de cinza');
      expect(prompt).toContain('ignore qualquer pedido de paleta');
      expect(prompt).toContain('apenas uma arte');
      expect(prompt).toContain('Sem letras');
    },
  );
  it('gives both providers an explicit coloring-only policy', () => {
    expect(lessonImageTextPolicy(LessonImagePurpose.MANUAL_COLORING)).toContain(
      'Sem cores, cinza',
    );
    expect(
      lessonImageTextPolicy(LessonImagePurpose.MEDITATION_ACTIVITY),
    ).toContain('rótulos curtos');
  });
});
