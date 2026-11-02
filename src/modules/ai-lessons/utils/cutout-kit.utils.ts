import { ConflictException } from '@nestjs/common';
import { CutoutCategory } from '../enums/lesson.enums';
import { CUTOUT_SKY_KEYWORDS } from '../constants/story-visual-quality.constants';
import { lessonString } from '../utils';

type JsonObject = Record<string, unknown>;

const SIZES = ['LARGE', 'MEDIUM', 'SMALL'];
const CATEGORIES = Object.values(CutoutCategory) as string[];

function asObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function normalize(value: string): string {
  return value
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

/** Índices em ordem de geração: pranchas CHARACTERS primeiro; o array salvo não muda. */
export function cutoutKitGenerationOrder(assets: JsonObject[]): number[] {
  const indices = assets.map((_, index) => index);
  return [
    ...indices.filter(
      (index) => assets[index].category === CutoutCategory.CHARACTERS,
    ),
    ...indices.filter(
      (index) => assets[index].category !== CutoutCategory.CHARACTERS,
    ),
  ];
}

/**
 * Valida o kit de recortes. Lança ConflictException com mensagem em
 * português, usada pelo mecanismo de correção automática.
 */
export function validateCutoutKit(
  generated: JsonObject,
  completeStory: string,
  quantity?: number,
): void {
  const assets = Array.isArray(generated.assets)
    ? generated.assets.map(asObject)
    : [];
  if (!completeStory.trim())
    throw new ConflictException(
      'A lição aprovada precisa conter a narrativa completa antes de gerar os visuais.',
    );
  if (quantity !== undefined && assets.length !== quantity)
    throw new ConflictException(
      `A geração precisa retornar exatamente ${quantity} imagens.`,
    );
  const ids = assets.map((asset) => lessonString(asset.id).trim());
  if (
    ids.some(
      (id, index) => id !== `kit-${String(index + 1).padStart(2, '0')}`,
    ) ||
    new Set(ids).size !== ids.length
  )
    throw new ConflictException(
      'Os visuais do kit precisam usar IDs sequenciais no formato kit-01, kit-02 e assim por diante.',
    );

  const story = normalize(completeStory);
  const presentCategories = new Set<string>();
  let extraCount = 0;
  for (const asset of assets) {
    const id = lessonString(asset.id);
    if (!CATEGORIES.includes(lessonString(asset.category)))
      throw new ConflictException(
        `A prancha ${id} precisa de uma categoria válida.`,
      );
    if (!lessonString(asset.layoutPlan).trim())
      throw new ConflictException(
        `A prancha ${id} precisa declarar o layoutPlan com o tamanho relativo dos elementos.`,
      );
    const items = Array.isArray(asset.items) ? asset.items.map(asObject) : [];
    if (!items.length)
      throw new ConflictException(
        `A prancha ${id} precisa conter elementos em items.`,
      );
    for (const item of items) {
      const label = lessonString(item.label).trim();
      if (!label || !lessonString(item.description).trim())
        throw new ConflictException(
          `Todos os elementos da prancha ${id} precisam de label e description.`,
        );
      if (!SIZES.includes(lessonString(item.size)))
        throw new ConflictException(
          `O elemento "${label}" precisa declarar o tamanho LARGE, MEDIUM ou SMALL.`,
        );
      const category =
        lessonString(item.category) || lessonString(asset.category);
      if (!CATEGORIES.includes(category))
        throw new ConflictException(
          `O elemento "${label}" precisa de uma categoria válida.`,
        );
      presentCategories.add(category);
      const extra = item.extra === true;
      if (extra) extraCount++;
      const evidence = lessonString(item.storyEvidence).trim();
      if (evidence) {
        if (!story.includes(normalize(evidence)))
          throw new ConflictException(
            `O storyEvidence do elemento "${label}" precisa ser um trecho literal da LIÇÃO BÍBLICA.`,
          );
      } else if (!extra && category !== CutoutCategory.SKY_AND_NATURE)
        throw new ConflictException(
          `O elemento "${label}" precisa de storyEvidence literal da LIÇÃO BÍBLICA.`,
        );
    }
  }

  const checklist = Array.isArray(generated.coverageChecklist)
    ? generated.coverageChecklist.map(asObject)
    : [];
  for (const category of CATEGORIES) {
    const entry = checklist.find((item) => item.category === category);
    if (!entry)
      throw new ConflictException(
        `O coverageChecklist precisa conter a categoria ${category}.`,
      );
    if (entry.status === 'NOT_APPLICABLE') {
      if (!lessonString(entry.justification).trim())
        throw new ConflictException(
          `A categoria ${category} marcada como NOT_APPLICABLE precisa de justificativa.`,
        );
    } else if (entry.status !== 'COVERED' || !presentCategories.has(category))
      throw new ConflictException(
        `A categoria ${category} está marcada como coberta, mas não possui elementos no kit.`,
      );
  }

  if (!presentCategories.has(CutoutCategory.CHARACTERS))
    throw new ConflictException(
      'O kit precisa conter ao menos uma prancha de personagens.',
    );
  if (
    !presentCategories.has(CutoutCategory.SCENERY) &&
    !presentCategories.has(CutoutCategory.BUILDINGS)
  )
    throw new ConflictException(
      'O kit precisa conter ao menos uma prancha de cenário ou construções.',
    );
  if (!presentCategories.has(CutoutCategory.SKY_AND_NATURE))
    throw new ConflictException(
      CUTOUT_SKY_KEYWORDS.test(completeStory)
        ? 'A lição menciona período do dia, clima ou corpos celestes: o kit precisa de itens SKY_AND_NATURE correspondentes.'
        : 'O kit precisa de uma prancha SKY_AND_NATURE com o conjunto mínimo (nuvens, sol, pássaros).',
    );
  const sheets = quantity ?? assets.length;
  if (sheets > 4 && extraCount < sheets - 4)
    throw new ConflictException(
      `Com ${sheets} pranchas, o kit precisa acrescentar ao básico ao menos ${sheets - 4} elementos marcados com extra true.`,
    );
}
