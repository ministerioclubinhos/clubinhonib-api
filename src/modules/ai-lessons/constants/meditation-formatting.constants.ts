export const MEDITATION_ACTIVITY_FIELDS = [
  'firstActivity',
  'secondActivity',
  'thirdActivity',
] as const;
export const MEDITATION_FORMATTING_LABELS: Record<string, string> = {
  verseText: 'VERSÍCULO PARA MEMORIZAR',
  verseReference: 'VERSÍCULO PARA MEMORIZAR',
  prayer: 'FALANDO COM DEUS',
  biblicalText: 'TEXTO BÍBLICO',
  introduction: 'ENTENDENDO A LIÇÃO',
};
export const MEDITATION_HEADING_SCALE: Record<number, number> = {
  1: 2,
  2: 1.5,
  3: 1.2,
};
