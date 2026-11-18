/** Limits and texts of the memory-verse change tool. */
export const LESSON_VERSE_CHANGE = {
  TEXT_MIN_LENGTH: 10,
  TEXT_MAX_LENGTH: 600,
  REFERENCE_MAX_LENGTH: 120,
  /** Heading of the verse section in the item 1 document. */
  SECTION_HEADINGS: ['VERSÍCULO PARA MEMORIZAR'],
  CHANGE_SUMMARY_PREFIX: 'Versículo alterado',
  NOT_ACKNOWLEDGED_MESSAGE:
    'Você está alterando o versículo. O item 1 volta para produção e os itens seguintes já gerados ficam desatualizados e precisam ser gerados de novo. Confirme para continuar.',
  NOT_GENERATED_MESSAGE:
    'Gere o item 1 (Lição completa) antes de alterar o versículo.',
  TERMINAL_MESSAGE:
    'O versículo de uma lição publicada ou arquivada não pode ser alterado.',
  INVALID_REFERENCE_MESSAGE:
    'A referência não está no formato Livro capítulo:versículo (ex.: João 3:16).',
} as const;
