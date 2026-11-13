import { LessonVisualStyle, LessonVisualType } from '../enums/lesson.enums';

/** Style of a new generation when none is chosen. */
export const DEFAULT_LESSON_VISUAL_STYLE = LessonVisualStyle.CUTE_CARTOON;
/** Style of a version saved before styles existed: it was drawn this way. */
export const LEGACY_LESSON_VISUAL_STYLE = LessonVisualStyle.ILLUSTRATED;

/** Never realistic, whatever the style: these are drawings for children. */
const NOT_REALISTIC =
  'É desenho para crianças: nunca fotorrealista, nunca pintura realista, sem texturas detalhadas de pelo, pele, madeira ou tecido. Animais e objetos seguem o mesmo traço, sem raças, marcas ou detalhes modernos reconhecíveis.';

/** Story-visual formats of a weekly lesson; the cutout kit stays the default. */
export const REGULAR_STORY_VISUAL_TYPES: readonly LessonVisualType[] = [
  LessonVisualType.CUTOUT_KIT,
  LessonVisualType.STORY_SEQUENCE,
];

/** Concrete drawing direction sent to the art director and to every image. */
export const LESSON_VISUAL_STYLE_PROMPTS: Record<LessonVisualStyle, string> = {
  [LessonVisualStyle.CUTE_CARTOON]: `Desenho infantil fofo, estilo cartoon de material bíblico para crianças pequenas: personagens com cabeça grande (cerca de um terço da altura), olhos grandes, redondos e brilhantes, bochechas rosadas, expressões alegres e simples, corpo pequeno e arredondado; formas simples e arredondadas; cores vivas e saturadas com sombreamento suave em poucos tons (cel shading); contorno escuro grosso e uniforme em todas as formas. ${NOT_REALISTIC}`,
  [LessonVisualStyle.ILLUSTRATED]: `Livro ilustrado infantil: pintura digital suave, cores claras e luminosas, proporções levemente estilizadas e expressões amigáveis, contornos nítidos e contraste suficiente para impressão e recorte. ${NOT_REALISTIC}`,
  [LessonVisualStyle.CLASSIC_CARTOON]: `Desenho bíblico clássico de material infantil impresso: contorno preto forte e contínuo em todas as formas, cores chapadas e vivas, sombra simples em um único tom, poucos detalhes, proporções de desenho animado (cabeça um pouco maior), expressões claras e amigáveis. Nada de pintura, aquarela ou degradê. Sol, nuvens, plantas e objetos não têm rosto. ${NOT_REALISTIC}`,
};

/** Every cutout piece carries a scissors line, whatever the drawing style. */
export const CUTOUT_CUT_LINE_RULE =
  'LINHA DE CORTE: cada elemento tem um contorno externo preto, grosso e contínuo (bem mais grosso que os traços internos) acompanhando toda a silhueta, para o professor recortar com tesoura. Silhueta simples e fechada, sem partes finas soltas; elementos separados por espaço branco, sem se tocar nem se sobrepor; fundo branco puro.';

/** Long side over short side of an A4 sheet (297 × 210 mm). */
export const A4_ASPECT_RATIO = Math.SQRT2;
/** Images this close to A4 are left untouched. */
export const A4_ASPECT_TOLERANCE = 0.01;
/** Edge pixels dropped before a full-bleed card is extended to A4. */
export const A4_PAD_EDGE_TRIM_PX = 4;
/** Rows (or columns) sampled next to an edge to find its background colour. */
export const A4_PAD_BACKGROUND_SAMPLE_PX = 40;
/** How far (per channel, 0–255) a column may drift from the edge colour and still be background. */
export const A4_PAD_BACKGROUND_TOLERANCE = 24;

/**
 * Verse cards are full-bleed: the background reaches every edge and is
 * extended (never cropped) to the A4 proportion, so the text keeps its margin.
 */
export const VERSE_CARD_A4_RULE =
  'FOLHA A4 SEM BORDA: o cartão será impresso numa folha A4 paisagem, de ponta a ponta; o fundo será estendido em cima e embaixo até a proporção do A4. O fundo vai até todas as bordas, sem moldura, margem ou faixa branca, e é contínuo nas bordas de cima e de baixo (sem desenhos cortados ali). Mantenha o texto a pelo menos 5% de todas as bordas, porque a impressora perde alguns milímetros.';

/** Full-page visuals are cropped to A4; the white margin is what the crop removes. */
export const A4_COMPOSITION_RULE =
  'FOLHA A4: esta imagem será impressa sozinha numa folha A4 e recortada no centro para a proporção do A4 (1 : 1,41). Componha para essa proporção e mantenha todos os elementos dentro da área central, com margem branca de pelo menos 8% em todas as bordas; nada encostado ou cortado nas bordas.';
