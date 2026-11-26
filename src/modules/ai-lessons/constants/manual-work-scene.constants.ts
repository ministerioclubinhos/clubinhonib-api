/**
 * Moments of the story the coloring page can show. Each generation is given
 * the next one, so regenerating the item never redraws the same scene.
 */
export const MANUAL_WORK_SCENE_FOCUSES = [
  'o INÍCIO da história: os personagens e o lugar onde tudo começa, antes do acontecimento principal',
  'o PONTO DE VIRADA: o instante em que a situação muda (o encontro, o pedido, o milagre, a decisão ou a resposta)',
  'o DESFECHO: como a história termina e o que acontece com cada personagem',
  'o PERSONAGEM PRINCIPAL em destaque, de perto, com o objeto ou gesto que resume o ensino da lição',
  'um DETALHE marcante da história que as crianças lembram (um objeto, um animal, um lugar ou uma ação secundária narrada na lição), com os personagens em volta',
  'JESUS ENSINANDO essa história ou esse ensino às pessoas ou às crianças que o ouvem, quando a passagem for um ensino ou uma parábola de Jesus; caso contrário, o momento de maior alegria ou gratidão da história',
] as const;

/** Framing of the artwork, drawn at random when only the image is redrawn. */
export const MANUAL_WORK_FRAMINGS = [
  'plano aberto, com o cenário amplo e os personagens de corpo inteiro',
  'plano médio, com os personagens grandes em primeiro plano e o cenário atrás',
  'cena vista de outro ângulo, com os personagens em posições e gestos diferentes do habitual',
  'cena com mais elementos do ambiente ao redor (plantas, construções, animais e objetos da época)',
] as const;

/** Previous scenes sent to the model as negative references. */
export const MANUAL_WORK_SCENE_HISTORY_LIMIT = 12;
