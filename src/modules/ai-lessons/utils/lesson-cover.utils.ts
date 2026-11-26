import {
  LESSON_COVER,
  LESSON_COVER_BRIEF_PROMPT,
  LESSON_COVER_BRIEF_SCHEMA,
  LESSON_COVER_HEADLINE,
} from '../constants/lesson-cover.constants';
import { LessonCategory, LessonStageType } from '../enums/lesson.enums';
import type { LessonLlmGenerationInput } from '../providers/lesson-llm.types';
import { getLessonTemplate } from '../templates/special-lesson-templates';
import type { LessonCoverBrief } from '../types/lesson-cover.types';
import type { LessonJsonObject } from '../types/lesson-generation.types';
import type { LessonStructuredRequest } from '../types/lesson-image-brief.types';
import { lessonString } from '../utils';
import { sharp } from './sharp.utils';
import { withLessonVisualStyle } from './story-visual-mode.utils';

export interface LessonCoverSource {
  theme: string;
  biblicalReference: string;
  category: LessonCategory;
  specialContext: string | null;
  weekNumber?: number | null;
  editorialPurpose?: string | null;
}

const clean = (
  value: unknown,
  max: number = LESSON_COVER.MAX_FIELD_LENGTH,
): string => lessonString(value).replace(/\s+/g, ' ').trim().slice(0, max);

/** Story without the sub-story markers, cut at a word boundary. */
export function lessonCoverStoryExcerpt(
  content: LessonJsonObject,
  max: number = LESSON_COVER.STORY_EXCERPT_MAX_CHARS,
): string {
  const story = lessonString(content.story)
    .replace(/^###\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (story.length <= max) return story;
  const cut = story.slice(0, max);
  const at = cut.lastIndexOf(' ');
  return `${cut.slice(0, at > 0 ? at : cut.length)}…`;
}

const wordsOf = (text: string): string[] => text.split(' ').filter(Boolean);

const isConnector = (word: string): boolean =>
  (LESSON_COVER_HEADLINE.TRAILING_CONNECTORS as readonly string[]).includes(
    word.toLocaleLowerCase('pt-BR'),
  );

/** Title without quotes, emojis or closing punctuation, on a single line. */
export function normalizeHeadline(raw: string): string {
  return raw
    .replace(/["“”‘’«»`´]/g, '')
    .replace(/[^\p{L}\p{N}\s'’:;,.\-–—?!]/gu, '')
    .replace(/[\s.,:;\-–—!?]+$/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The title fits the image: few words and few letters. */
export function headlineFits(headline: string): boolean {
  return (
    headline.length > 0 &&
    headline.length <= LESSON_COVER_HEADLINE.MAX_CHARS &&
    wordsOf(headline).length <= LESSON_COVER_HEADLINE.MAX_WORDS
  );
}

/**
 * Short form of a long title, without a model: keeps the part before the
 * subtitle and the leading words that fit, never ending on a connector.
 */
export function simplifyLessonTitle(title: string): string {
  const normalized = normalizeHeadline(title);
  if (headlineFits(normalized)) return normalized;
  const [main] = normalized.split(LESSON_COVER_HEADLINE.SUBTITLE_SEPARATORS);
  const chosen: string[] = [];
  for (const word of wordsOf(main || normalized)) {
    const next = [...chosen, word].join(' ');
    if (
      chosen.length >= LESSON_COVER_HEADLINE.MAX_WORDS ||
      next.length > LESSON_COVER_HEADLINE.MAX_CHARS
    )
      break;
    chosen.push(word);
  }
  while (chosen.length > 1 && isConnector(chosen[chosen.length - 1]))
    chosen.pop();
  // A single word longer than the limit is cut: the image still gets a title.
  return (chosen.join(' ') || normalized).slice(
    0,
    LESSON_COVER_HEADLINE.MAX_CHARS,
  );
}

/** Capital letters, which read best on a card and leave fewer shapes to get wrong. */
export function coverHeadline(candidate: string, theme: string): string {
  const normalized = normalizeHeadline(candidate);
  const short = headlineFits(normalized)
    ? normalized
    : simplifyLessonTitle(normalized || theme);
  return short.toLocaleUpperCase('pt-BR');
}

/** What the text model receives to write the cover brief. */
export function buildCoverBriefRequest(
  lesson: LessonCoverSource,
  content: LessonJsonObject,
): LessonStructuredRequest {
  return {
    name: LESSON_COVER.BRIEF_SCHEMA_NAME,
    label: LESSON_COVER.BRIEF_LOG_LABEL,
    system: LESSON_COVER_BRIEF_PROMPT,
    user: JSON.stringify({
      licao: {
        tema: lesson.theme,
        referenciaBiblica: lesson.biblicalReference,
        tipoDeMaterial: lesson.category,
        contextoEspecial:
          lesson.category === LessonCategory.SPECIAL
            ? lesson.specialContext
            : null,
        propositoEditorial: lesson.editorialPurpose ?? null,
        relato: lessonCoverStoryExcerpt(content),
      },
      limitesDoTitulo: {
        maximoDePalavras: LESSON_COVER_HEADLINE.MAX_WORDS,
        maximoDeCaracteres: LESSON_COVER_HEADLINE.MAX_CHARS,
      },
    }),
    schema: LESSON_COVER_BRIEF_SCHEMA as unknown as Record<string, unknown>,
  };
}

/** The model's answer, or the reason it cannot be used. */
export function parseCoverBrief(
  raw: LessonJsonObject,
  lesson: Pick<LessonCoverSource, 'theme'>,
): { brief: LessonCoverBrief } | { problem: string } {
  const character =
    raw.character && typeof raw.character === 'object'
      ? (raw.character as LessonJsonObject)
      : {};
  const name = clean(character.name, 120);
  const appearance = clean(character.appearance);
  const scene = clean(raw.scene);
  if (!name || !appearance) return { problem: 'personagem principal ausente' };
  if (!scene) return { problem: 'cena ausente' };
  const palette = (Array.isArray(raw.palette) ? raw.palette : [])
    .map((color) => clean(color, 40))
    .filter(Boolean)
    .slice(0, 4);
  return {
    brief: {
      // A headline that does not fit is shortened, never a reason to retry.
      headline: coverHeadline(clean(raw.headline, 200), lesson.theme),
      character: { name, appearance },
      scene,
      palette,
      origin: 'AI',
    },
  };
}

/** Brief built from the lesson alone, when the text model is unavailable. */
export function fallbackCoverBrief(
  lesson: LessonCoverSource,
): LessonCoverBrief {
  return {
    headline: coverHeadline(lesson.theme, lesson.theme),
    character: { name: '', appearance: '' },
    scene: '',
    palette: [],
    origin: 'FALLBACK',
  };
}

/** Context the text provider logs and uses for its model settings. */
export function lessonCoverLlmContext(
  lesson: LessonCoverSource,
): LessonLlmGenerationInput {
  return {
    theme: lesson.theme,
    biblicalReference: lesson.biblicalReference,
    weekNumber: lesson.weekNumber ?? null,
    category: lesson.category,
    specialContext: lesson.specialContext,
    editorialPurpose: lesson.editorialPurpose ?? null,
    stage: LessonStageType.LESSON,
    template: getLessonTemplate(LessonStageType.LESSON, lesson.category, null),
    approvedUpstream: null,
    adminPrompt: '',
  };
}

const section = (title: string, lines: ReadonlyArray<string | false>): string =>
  `${title}\n${lines.filter(Boolean).join('\n')}`;

/**
 * The image prompt: a 3:2 cover with the short title and the protagonist.
 * Everything the model must not improvise (the exact letters, the safe area,
 * the single line of text) is stated outright, because the provider only
 * sees this text.
 */
export function buildLessonCoverPrompt(
  brief: LessonCoverBrief,
  lesson: LessonCoverSource,
  content: LessonJsonObject,
): string {
  const hasCharacter = Boolean(brief.character.name);
  const story = lessonCoverStoryExcerpt(content, 900);
  const letters = [...brief.headline.replace(/\s+/g, ' ')].join(' ');
  const prompt = [
    section('FINALIDADE', [
      'Capa horizontal (proporção 3:2) do card de um material bíblico infantil do Clubinho NIB, para crianças de 5 a 11 anos. Ela mistura um TÍTULO CURTO escrito na arte com o PERSONAGEM PRINCIPAL da lição, e será vista em tamanho pequeno: poucos elementos, formas grandes, cores vivas.',
    ]),
    section('PERSONAGEM PRINCIPAL (um só, em destaque)', [
      hasCharacter
        ? `${brief.character.name}. Aparência fixa, siga à risca: ${brief.character.appearance}`
        : `O protagonista da história abaixo (apenas um personagem), com roupas e acessórios da época do relato, expressão amigável.`,
      'Ocupa cerca de dois terços da altura do quadro, com o rosto inteiro visível, nítido e sorridente ou confiante. Corpo de cartoon infantil com cabeça grande. Fica de um lado do quadro (direita), virado levemente para o centro.',
    ]),
    section('CENA E CENÁRIO', [
      brief.scene
        ? `${brief.scene}`
        : 'Um cenário simples, fiel ao relato, com no máximo dois elementos que ajudem a reconhecer a história.',
      'Fundo colorido e simples, com profundidade suave (céu, chão e uma ou duas formas ao fundo), que preenche todo o quadro.',
      brief.palette.length > 0 && `Paleta: ${brief.palette.join(', ')}.`,
      lesson.category === LessonCategory.SPECIAL &&
        Boolean(lesson.specialContext?.trim()) &&
        `Contexto do material especial: ${lesson.specialContext?.trim()}`,
    ]),
    section('TEXTO NA IMAGEM (o único texto permitido)', [
      `Escreva exatamente este título, em MAIÚSCULAS: "${brief.headline}".`,
      `Letra por letra: ${letters}. Mesmas letras, mesmos acentos, mesma ordem, em português do Brasil. Não acrescente, não troque nem repita letras.`,
      'Tipografia: letras grossas e arredondadas de livro infantil, em caixa-alta, com preenchimento claro, contorno escuro grosso e sombra suave, para ter contraste forte com o fundo e ficar legível em miniatura.',
      'Posição: no lado esquerdo, em no máximo duas linhas, alinhado à esquerda, ocupando cerca de 45% da largura, sem tocar no personagem.',
      "Nenhum outro texto: sem subtítulo, número da semana, referência bíblica, versículo, legenda, assinatura, marca d'água ou logotipo.",
    ]),
    section('ENQUADRAMENTO E MARGEM DE SEGURANÇA', [
      'A imagem será cortada nas bordas para caber no card: mantenha o título inteiro e o rosto do personagem dentro da área central (80% da largura e 80% da altura), com margem livre de pelo menos 8% em cada borda.',
      'O fundo vai até as bordas: sem moldura, sem borda branca, sem cantos arredondados desenhados, sem sombra projetada fora do quadro.',
    ]),
    story &&
      section(
        'RELATO (apenas para conferir fidelidade; não desenhe cenas além da pedida)',
        [story],
      ),
    section('CONFERÊNCIA ANTES DE FINALIZAR', [
      `O texto da imagem é exatamente "${brief.headline}". Há um único personagem principal. O título e o rosto estão dentro da área de segurança. Nada violento, assustador ou realista.`,
    ]),
  ]
    .filter(Boolean)
    .join('\n\n');
  return withLessonVisualStyle(prompt, undefined);
}

export function lessonCoverFileName(
  lessonId: string,
  extension: 'jpg' | 'png',
): string {
  return `${lessonId}-${LESSON_COVER.FILE_NAME_SUFFIX}.${extension}`;
}

/** Centred crop to the card proportion; an unreadable image is returned as is for the upload validation to reject. */
export async function cropToCoverProportion(image: Buffer): Promise<Buffer> {
  try {
    const { width, height } = await sharp(image).metadata();
    if (!width || !height) return image;
    const ratio = width / height;
    if (
      Math.abs(ratio - LESSON_COVER.ASPECT_RATIO) <
      LESSON_COVER.ASPECT_TOLERANCE
    )
      return image;
    const tooWide = ratio > LESSON_COVER.ASPECT_RATIO;
    const cropWidth = tooWide
      ? Math.round(height * LESSON_COVER.ASPECT_RATIO)
      : width;
    const cropHeight = tooWide
      ? height
      : Math.round(width / LESSON_COVER.ASPECT_RATIO);
    return await sharp(image)
      .extract({
        left: Math.floor((width - cropWidth) / 2),
        top: Math.floor((height - cropHeight) / 2),
        width: cropWidth,
        height: cropHeight,
      })
      .png()
      .toBuffer();
  } catch {
    return image;
  }
}
