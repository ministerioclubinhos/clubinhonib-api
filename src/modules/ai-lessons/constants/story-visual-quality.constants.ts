export const STORY_VISUAL_MAX_CORRECTIONS = 2;
export const STORY_VISUAL_CORRECTION_INSTRUCTIONS =
  'Retorne o JSON completo corrigido. Divida a narrativa aprovada inteira em trechos literais, contínuos e consecutivos no campo sourceExcerpt. Inclua também os subtítulos, a pontuação e o desfecho. Não resuma, parafraseie, repita ou omita palavras. A concatenação dos sourceExcerpt deve reproduzir toda a narrativa, na ordem. Preserve a quantidade solicitada e use IDs sequenciais visual-01, visual-02 e assim por diante. Ajuste as descrições e prompts das imagens aos trechos corrigidos, mantendo a consistência dos personagens.';

export const CUTOUT_KIT_CORRECTION_INSTRUCTIONS =
  'Retorne o JSON completo corrigido do kit de recortes. Use IDs sequenciais kit-01, kit-02 e assim por diante e preserve a quantidade de pranchas solicitada. Cada item precisa de label, description, category, size (LARGE, MEDIUM ou SMALL), storyEvidence copiado literalmente da LIÇÃO BÍBLICA (vazio apenas para itens neutros de SKY_AND_NATURE ou itens marcados com extra true), variantOf quando for variante e extra true quando for acréscimo além do básico. Cada prancha precisa de layoutPlan, prompt e altText. Preencha coverageChecklist com todas as categorias, marcando COVERED ou NOT_APPLICABLE com justificativa. Nenhum personagem, animal, construção, cenário ou objeto citado na lição pode faltar, e nenhum elemento pode ficar sem apoio no texto. Não reduza o tamanho dos elementos para caber: reorganize as pranchas.';

export const CUTOUT_CATEGORY_LABELS = {
  CHARACTERS: 'Personagens',
  ANIMALS: 'Animais',
  BUILDINGS: 'Construções',
  SCENERY: 'Cenário',
  SKY_AND_NATURE: 'Céu e natureza',
  OBJECTS: 'Objetos',
} as const;

export type CutoutKitCategoryKey = keyof typeof CUTOUT_CATEGORY_LABELS;

export type CutoutKitTier = {
  /** Categorias agrupadas em cada prancha deste nível (uma linha por prancha). */
  sheets: CutoutKitCategoryKey[][];
  /** Acréscimos introduzidos por este nível (sem número fixo de itens). */
  extras: string;
};

/**
 * Distribuição por quantidade de pranchas (4 a 10). O conjunto básico entra
 * sempre; cada nível só reorganiza categorias e acrescenta peças.
 */
export const CUTOUT_KIT_TIERS: Record<number, CutoutKitTier> = {
  4: {
    sheets: [
      ['CHARACTERS'],
      ['ANIMALS', 'OBJECTS'],
      ['BUILDINGS', 'SCENERY'],
      ['SKY_AND_NATURE'],
    ],
    extras: '',
  },
  5: {
    sheets: [
      ['CHARACTERS'],
      ['ANIMALS'],
      ['OBJECTS'],
      ['BUILDINGS', 'SCENERY'],
      ['SKY_AND_NATURE'],
    ],
    extras: 'segunda pose ou variante dos personagens principais',
  },
  6: {
    sheets: [
      ['CHARACTERS'],
      ['ANIMALS'],
      ['OBJECTS'],
      ['BUILDINGS'],
      ['SCENERY'],
      ['SKY_AND_NATURE'],
    ],
    extras:
      'mais ângulos das construções e peças extras de cenário (colinas menores, caminhos, rio)',
  },
  7: {
    sheets: [
      ['CHARACTERS'],
      ['ANIMALS'],
      ['OBJECTS'],
      ['BUILDINGS'],
      ['SCENERY'],
      ['SKY_AND_NATURE'],
      ['SKY_AND_NATURE'],
    ],
    extras:
      'céu e natureza ampliados: nuvens em mais formatos, pássaros em mais posições, lua em fases, estrelas, árvores e flores variadas',
  },
  8: {
    sheets: [
      ['CHARACTERS'],
      ['ANIMALS'],
      ['ANIMALS'],
      ['OBJECTS'],
      ['BUILDINGS'],
      ['SCENERY'],
      ['SKY_AND_NATURE'],
      ['SKY_AND_NATURE'],
    ],
    extras: 'filhotes, mais animais de contexto e variantes de estado',
  },
  9: {
    sheets: [
      ['CHARACTERS'],
      ['CHARACTERS'],
      ['ANIMALS'],
      ['ANIMALS'],
      ['OBJECTS'],
      ['BUILDINGS'],
      ['SCENERY'],
      ['SKY_AND_NATURE'],
      ['SKY_AND_NATURE'],
    ],
    extras:
      'expressões e poses adicionais em momentos-chave, figurantes e multidão em silhuetas',
  },
  10: {
    sheets: [
      ['CHARACTERS'],
      ['CHARACTERS'],
      ['ANIMALS'],
      ['ANIMALS'],
      ['OBJECTS'],
      ['OBJECTS'],
      ['BUILDINGS'],
      ['SCENERY'],
      ['SKY_AND_NATURE'],
      ['SKY_AND_NATURE'],
    ],
    extras:
      'objetos secundários, adereços de época e peças de transição (portas, cercas, tendas, barcos menores)',
  },
};

/** Resumo legível do kit para a quantidade escolhida. */
export function cutoutKitTierSummary(quantity: number): {
  sheets: string[];
  extras: string[];
} {
  const clamped = Math.min(10, Math.max(4, Math.trunc(quantity) || 4));
  const extras: string[] = [];
  for (let n = 5; n <= clamped; n++)
    if (CUTOUT_KIT_TIERS[n].extras) extras.push(CUTOUT_KIT_TIERS[n].extras);
  return {
    sheets: CUTOUT_KIT_TIERS[clamped].sheets.map((sheet) =>
      sheet.map((category) => CUTOUT_CATEGORY_LABELS[category]).join(' + '),
    ),
    extras,
  };
}

export const CUTOUT_KIT_BASIC_SET = [
  'todos os personagens nomeados da lição (uma pose base cada)',
  'todos os animais citados',
  'todas as construções e lugares citados',
  'cenário essencial: montanhas/colinas, chão/caminho e, se a lição pedir, mar/rio/deserto',
  'objetos que os personagens usam ou tocam na história',
  'céu e natureza mínimos: nuvens, sol, pássaros e uma árvore (lua e estrelas se a história for à noite)',
];

export const CUTOUT_SKY_KEYWORDS =
  /\b(dia|noite|manh[ãa]|tarde|estrelas?|lua|sol|chuva|tempestade|p[áa]ssaros?|aves?|nuvens?|c[ée]u)\b/i;

/** Texto de regras do kit usado pelos provedores de LLM. */
export function cutoutKitPromptRules(quantity: number): string {
  const summary = cutoutKitTierSummary(quantity);
  return [
    'Em VISUAIS DA HISTÓRIA, gere um KIT DE RECORTES para o professor: pranchas de elementos isolados em fundo branco, sem cena completa. Primeiro faça o inventário de todos os elementos da LIÇÃO BÍBLICA (personagens, animais, construções, cenário, céu e natureza, objetos), depois distribua em exatamente visualConfig.quantity pranchas com id kit-01, kit-02 etc.',
    `Conjunto básico obrigatório em qualquer quantidade: ${CUTOUT_KIT_BASIC_SET.join('; ')}.`,
    `Com ${quantity} pranchas, organize assim: ${summary.sheets.map((sheet, index) => `prancha ${index + 1}: ${sheet}`).join('; ')}.${summary.extras.length ? ` Além do básico, acrescente: ${summary.extras.join('; ')}.` : ' Nada além do básico.'}`,
    'Cada item tem label (legenda aplicada depois pelo sistema), description, category, size (LARGE, MEDIUM ou SMALL), storyEvidence (trecho literal da lição que justifica o item; vazio apenas para itens neutros de SKY_AND_NATURE ou extras), variantOf quando for variante (mesmo elemento com outro estado ou pose) e extra true quando for acréscimo além do básico.',
    'Elementos grandes e nítidos para o professor recortar e mostrar à distância: nunca encolha um elemento para caber. Se não couber, reorganize as pranchas e descreva em layoutPlan o tamanho relativo de cada elemento. Não gere elementos minúsculos.',
    'Escala coerente: adulto ≈ 1,0; criança ≈ 0,6; casa ≈ 3,0; árvore ≈ 2,5. Personagens mantêm o mesmo rosto, roupa e traço em todas as pranchas. Nada violento, assustador ou sexualizado e nenhum elemento sem apoio na lição, salvo os neutros de SKY_AND_NATURE.',
    'Preencha coverageChecklist com as 6 categorias (CHARACTERS, ANIMALS, BUILDINGS, SCENERY, SKY_AND_NATURE, OBJECTS), marcando COVERED ou NOT_APPLICABLE com justificativa. Prompts de imagem não pedem legendas nem texto dentro da arte e pedem, em cada elemento, contorno externo preto e grosso como linha de corte.',
  ].join(' ');
}

/** Relative sizes a cutout element may declare. */
export const CUTOUT_ITEM_SIZES: readonly string[] = [
  'LARGE',
  'MEDIUM',
  'SMALL',
];
export const CUTOUT_COVERAGE_COVERED = 'COVERED';
export const CUTOUT_COVERAGE_NOT_APPLICABLE = 'NOT_APPLICABLE';

/** Menor pedaço de citação (em caracteres comparáveis) que prova alguma coisa. */
export const CUTOUT_EVIDENCE_MIN_FRAGMENT = 6;

/** Menor palavra de um rótulo usada para achar o elemento na lição. */
export const CUTOUT_LABEL_MIN_TERM = 4;

/** Tamanho máximo da frase da lição usada como evidência consertada. */
export const CUTOUT_EVIDENCE_MAX_LENGTH = 240;

/** Tamanho assumido quando a IA devolve um elemento sem tamanho válido. */
export const CUTOUT_DEFAULT_ITEM_SIZE = 'MEDIUM';

/** Justificativa de uma categoria sem elementos que a IA não justificou. */
export const CUTOUT_DEFAULT_NOT_APPLICABLE_JUSTIFICATION =
  'A lição não cita elementos desta categoria.';
