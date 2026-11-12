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
