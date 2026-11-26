import { LessonStageType } from '../enums/lesson.enums';

export const LESSON_IMAGE_REGENERATION = {
  MAX_ASSETS: 20,
  ASSET_ID_MAX_LENGTH: 100,
  INSTRUCTIONS_MAX_LENGTH: 500,
  /**
   * Kept images sent as reference for each replacement. One only: handed
   * several images, the providers' edit endpoints merge their contents into a
   * single picture instead of treating them as style guides.
   */
  MAX_REFERENCE_IMAGES: 1,
  STYLE_CONTINUITY:
    'IMAGEM DE SUBSTITUIÇÃO EM UM CONJUNTO QUE CONTINUA EM USO: a imagem de referência anexada pertence ao mesmo material e ficará ao lado desta. Ela é SOMENTE guia de estilo e identidade. A nova imagem precisa parecer feita na mesma sessão: mesmo traço artístico, espessura e cor do contorno, paleta, sombreamento, textura, nível de detalhe e proporções. NÃO reproduza os personagens, objetos, construções ou cenários da referência: desenhe apenas o conteúdo pedido acima. Só quando um personagem ou lugar pedido acima também aparecer na referência, mantenha exatamente o mesmo rosto, idade aparente, cabelo, barba, tom de pele, roupas e aparência.',
  /** Heads the administrator's note inside the image prompt. */
  INSTRUCTIONS_HEADING:
    'AJUSTE PEDIDO PELO ADMINISTRADOR PARA ESTA NOVA VERSÃO DA IMAGEM (prioridade sobre a composição proposta, sem contrariar o texto da lição):',
} as const;

/** Stages whose artwork is reviewed as a set: all images or none. */
export const LESSON_IMAGE_SET_STAGES: readonly LessonStageType[] = [
  LessonStageType.MEDITATION_OLDER,
];
