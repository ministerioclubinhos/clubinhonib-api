import { OLDER_MEDITATION_EXECUTABLE_ART_MECHANICS } from '../constants/older-meditation-puzzle.constants';
import { OlderMeditationMechanic } from '../enums/older-meditation.enums';
import type { MeditationJson } from '../types/younger-meditation.types';
import { buildMeditationActivityImagePrompt } from './meditation-image.utils';

const text = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

/**
 * Art of a question of the older sheet. Only a maze is drawn as the exercise
 * itself; every other picture is a scene of the story beside the text, as in
 * the handmade sheets. The scene prompt never carries the question, its
 * options or its answer key: image models copy them into the art as
 * unreadable text or as the solution.
 */
export function buildOlderMeditationImagePrompt(
  ageGroup: string,
  activity: MeditationJson,
  composition: string,
): string {
  if (
    OLDER_MEDITATION_EXECUTABLE_ART_MECHANICS.includes(
      activity.mechanic as OlderMeditationMechanic,
    )
  )
    return buildMeditationActivityImagePrompt(
      ageGroup,
      text(activity.instruction),
      composition,
      text(activity.answer),
    );
  return `Crie uma ilustração de apoio para uma folha de atividades bíblicas de crianças de ${ageGroup}.
CENA DA HISTÓRIA: ${text(activity.context) || text(activity.sourceExcerpt)}
COMPOSIÇÃO PLANEJADA: ${composition}
ESTILO OBRIGATÓRIO: desenho para colorir em preto e branco, somente contornos pretos limpos sobre fundo branco puro, sem cores, sem cinza, sem sombreado e sem texturas. Personagens bíblicos com roupas da época, expressões amigáveis, figuras grandes e bem definidas.
PROIBIDO: qualquer letra, palavra, número, frase, balão de fala, legenda, etiqueta, lacuna, alternativa, seta, moldura de página, cabeçalho ou logotipo. A imagem é apenas a cena; todo o texto da questão já está impresso ao lado.
UMA ÚNICA CENA: um só desenho que ocupa a imagem inteira, com os personagens em ação e o cenário ao redor. Nunca divida a imagem em quadros, painéis, tirinha, miniaturas ou sequência de cenas, mesmo que a composição planejada peça várias cenas: nesse caso desenhe apenas o momento principal.`;
}
