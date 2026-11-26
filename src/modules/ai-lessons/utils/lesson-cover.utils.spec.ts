import {
  LESSON_COVER,
  LESSON_COVER_HEADLINE,
} from '../constants/lesson-cover.constants';
import { LessonCategory } from '../enums/lesson.enums';
import { LessonImagePurpose } from '../providers/lesson-llm.types';
import { sharp } from './sharp.utils';
import {
  buildCoverBriefRequest,
  buildLessonCoverPrompt,
  coverHeadline,
  cropToCoverProportion,
  fallbackCoverBrief,
  headlineFits,
  lessonCoverFileName,
  lessonCoverLlmContext,
  lessonCoverStoryExcerpt,
  parseCoverBrief,
  simplifyLessonTitle,
} from './lesson-cover.utils';
import { lessonImageTextPolicy } from './meditation-image.utils';

const regular = {
  theme: 'O bom pastor',
  biblicalReference: 'Salmo 23',
  category: LessonCategory.REGULAR,
  specialContext: null,
};

const aiAnswer = {
  headline: 'O bom pastor',
  character: {
    name: 'Davi',
    appearance: 'menino de 12 anos, pele morena, túnica azul, cajado',
  },
  scene: 'Davi cuida das ovelhas num campo verde ao nascer do sol.',
  palette: ['azul-céu', 'verde-pasto'],
};

describe('lesson cover headline', () => {
  it('keeps a title that already fits', () => {
    expect(simplifyLessonTitle('Deus prova Abraão')).toBe('Deus prova Abraão');
  });

  it('keeps only the part before the subtitle', () => {
    expect(
      simplifyLessonTitle('A fé de Abraão: Deus prova o seu servo no monte'),
    ).toBe('A fé de Abraão');
  });

  it('shortens a long title to few words and never ends on a connector', () => {
    const short = simplifyLessonTitle(
      'A parábola do semeador que saiu a semear e das sementes',
    );

    expect(headlineFits(short)).toBe(true);
    expect(short.split(' ').length).toBeLessThanOrEqual(
      LESSON_COVER_HEADLINE.MAX_WORDS,
    );
    expect(short.split(' ').pop()).not.toMatch(/^(de|da|do|e|que|a|o)$/i);
  });

  it('cuts a single word longer than the limit instead of returning nothing', () => {
    const short = simplifyLessonTitle(
      'Anticonstitucionalissimamente-demais-ok',
    );

    expect(short.length).toBeGreaterThan(0);
    expect(short.length).toBeLessThanOrEqual(LESSON_COVER_HEADLINE.MAX_CHARS);
  });

  it('writes the title in capital letters with accents', () => {
    expect(coverHeadline('Deus prova Abraão', 'x')).toBe('DEUS PROVA ABRAÃO');
  });

  it('strips quotes, emojis and closing punctuation', () => {
    expect(coverHeadline('"Davi e a funda!" 🎉', 'x')).toBe('DAVI E A FUNDA');
  });

  it('falls back to the theme when the model gives an empty title', () => {
    expect(coverHeadline('', 'O bom pastor')).toBe('O BOM PASTOR');
  });
});

describe('lesson cover brief', () => {
  it('sends the lesson, the story and the title limits to the text model', () => {
    const request = buildCoverBriefRequest(regular, {
      story: 'Davi e a funda.',
    });

    expect(request.name).toBe(LESSON_COVER.BRIEF_SCHEMA_NAME);
    expect(request.system).toContain('headline');
    expect(request.user).toContain('Davi e a funda.');
    expect(request.user).toContain(String(LESSON_COVER_HEADLINE.MAX_CHARS));
  });

  it('accepts a complete answer and writes the title in capitals', () => {
    const parsed = parseCoverBrief(aiAnswer, regular);

    expect(parsed).toEqual({
      brief: expect.objectContaining({
        headline: 'O BOM PASTOR',
        origin: 'AI',
        character: expect.objectContaining({ name: 'Davi' }),
      }),
    });
  });

  it('shortens a title that is too long instead of rejecting the answer', () => {
    const parsed = parseCoverBrief(
      {
        ...aiAnswer,
        headline: 'O Senhor é o meu pastor e nada me faltará jamais',
      },
      regular,
    );

    expect('brief' in parsed && headlineFits(parsed.brief.headline)).toBe(true);
  });

  it('rejects an answer without protagonist or scene', () => {
    expect(parseCoverBrief({ ...aiAnswer, character: {} }, regular)).toEqual({
      problem: 'personagem principal ausente',
    });
    expect(parseCoverBrief({ ...aiAnswer, scene: ' ' }, regular)).toEqual({
      problem: 'cena ausente',
    });
  });

  it('builds a brief from the theme alone when the model is unavailable', () => {
    expect(
      fallbackCoverBrief({ ...regular, theme: 'Deus prova Abraão' }),
    ).toEqual(
      expect.objectContaining({
        headline: 'DEUS PROVA ABRAÃO',
        origin: 'FALLBACK',
      }),
    );
  });

  it('gives the text provider a lesson context for logs and model settings', () => {
    const context = lessonCoverLlmContext({ ...regular, weekNumber: 7 });

    expect(context).toEqual(
      expect.objectContaining({ theme: 'O bom pastor', weekNumber: 7 }),
    );
  });
});

describe('lesson cover image prompt', () => {
  const brief = (parseCoverBrief(aiAnswer, regular) as { brief: never }).brief;

  it('asks for the exact title, one protagonist and a safe area', () => {
    const prompt = buildLessonCoverPrompt(brief, regular, {
      story: 'Davi cuidava das ovelhas.',
    });

    expect(prompt).toContain('"O BOM PASTOR"');
    expect(prompt).toContain('O   B O M   P A S T O R');
    expect(prompt).toContain('Davi. Aparência fixa');
    expect(prompt).toContain('túnica azul');
    expect(prompt).toContain('área central (80%');
    expect(prompt).toContain('Nenhum outro texto');
    expect(prompt).toContain('Davi cuidava das ovelhas.');
    expect(prompt).toContain('ESTILO DE DESENHO OBRIGATÓRIO');
  });

  it('still asks for a protagonist when the brief came from the fallback', () => {
    const prompt = buildLessonCoverPrompt(
      fallbackCoverBrief(regular),
      regular,
      { story: 'Davi cuidava das ovelhas.' },
    );

    expect(prompt).toContain('O protagonista da história abaixo');
    expect(prompt).toContain('"O BOM PASTOR"');
  });

  it('adds the special context only to a special material', () => {
    const special = {
      ...regular,
      category: LessonCategory.SPECIAL,
      specialContext: 'Natal das crianças',
    };

    expect(buildLessonCoverPrompt(brief, special, {})).toContain(
      'Natal das crianças',
    );
    expect(
      buildLessonCoverPrompt(
        brief,
        { ...regular, specialContext: 'Natal' },
        {},
      ),
    ).not.toContain('Natal');
  });

  it('lets the provider write only the title: the cover has its own text policy', () => {
    const policy = lessonImageTextPolicy(LessonImagePurpose.COVER);

    expect(policy).toContain('SOMENTE o título');
    expect(policy).not.toContain('Sem letras, palavras');
  });
});

describe('lesson cover files', () => {
  it('cuts the story at a word boundary and drops the sub-story markers', () => {
    const story = `### Primeira\n${'palavra '.repeat(800)}`;

    const excerpt = lessonCoverStoryExcerpt({ story });

    expect(excerpt).not.toContain('###');
    expect(excerpt.length).toBeLessThanOrEqual(
      LESSON_COVER.STORY_EXCERPT_MAX_CHARS + 1,
    );
    expect(excerpt.endsWith('…')).toBe(true);
  });

  it('names the file after the lesson', () => {
    expect(lessonCoverFileName('abc', 'png')).toBe('abc-cover.png');
  });

  it('crops a 4:3 image to the 3:2 card proportion', async () => {
    const image = await sharp({
      create: { width: 400, height: 300, channels: 3, background: '#fff' },
    })
      .png()
      .toBuffer();

    const cropped = await cropToCoverProportion(image);
    const { width, height } = await sharp(cropped).metadata();

    expect((width ?? 0) / (height ?? 1)).toBeCloseTo(
      LESSON_COVER.ASPECT_RATIO,
      1,
    );
  });

  it('returns an unreadable image untouched for the upload validation to reject', async () => {
    const bytes = Buffer.from('não é imagem');

    await expect(cropToCoverProportion(bytes)).resolves.toBe(bytes);
  });
});
