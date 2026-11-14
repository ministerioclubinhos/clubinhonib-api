import { ConflictException } from '@nestjs/common';
import { CutoutCategory } from '../enums/lesson.enums';
import {
  CUTOUT_COVERAGE_COVERED,
  CUTOUT_COVERAGE_NOT_APPLICABLE,
  CUTOUT_DEFAULT_ITEM_SIZE,
  CUTOUT_DEFAULT_NOT_APPLICABLE_JUSTIFICATION,
  CUTOUT_EVIDENCE_MAX_LENGTH,
  CUTOUT_EVIDENCE_MIN_FRAGMENT,
  CUTOUT_LABEL_MIN_TERM,
  CUTOUT_ITEM_SIZES,
  CUTOUT_SKY_KEYWORDS,
} from '../constants/story-visual-quality.constants';
import { lessonString } from '../utils';

type JsonObject = Record<string, unknown>;

const CATEGORIES: string[] = Object.values(CutoutCategory);
const SKY_AND_NATURE: string = CutoutCategory.SKY_AND_NATURE;

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

/**
 * Texto reduzido a letras e números, para comparar citação e lição.
 *
 * A IA copia o trecho quase sempre certo, mas troca a pontuação, o tipo de
 * aspas, um travessão ou um acento. Nada disso muda o que foi citado, e era o
 * bastante para reprovar o kit inteiro.
 */
function comparable(value: string): string {
  return normalize(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * A citação está na lição?
 *
 * Reticências dividem a citação em pedaços: cada um precisa aparecer. Pedaços
 * minúsculos não provam nada e são ignorados, desde que sobre algum.
 */
export function isLiteralStoryEvidence(
  evidence: string,
  story: string,
): boolean {
  const haystack = comparable(story);
  const fragments = evidence
    .split(/\.{3,}|…|\[\.\.\.\]/)
    .map(comparable)
    .filter((fragment) => fragment.length >= CUTOUT_EVIDENCE_MIN_FRAGMENT);
  if (!fragments.length) {
    const whole = comparable(evidence);
    return whole.length > 0 && haystack.includes(whole);
  }
  return fragments.every((fragment) => haystack.includes(fragment));
}

/** Frases da lição, na ordem em que aparecem. */
function storySentences(story: string): string[] {
  return story
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/** Primeira frase da lição que cita o elemento, ou `null`. */
function sentenceMentioning(label: string, story: string): string | null {
  const whole = comparable(label);
  if (!whole) return null;
  // O rótulo pode trazer um qualificador ("Jesus sentado"): vale o nome inteiro
  // e, se não achar, as palavras com tamanho para identificar alguém.
  const terms = [
    whole,
    ...whole.split(' ').filter((word) => word.length >= CUTOUT_LABEL_MIN_TERM),
  ];
  const sentences = storySentences(story);
  for (const term of terms) {
    const pattern = new RegExp(`(^| )${term}( |$)`);
    const found = sentences.find((sentence) =>
      pattern.test(comparable(sentence)),
    );
    if (found) return found.slice(0, CUTOUT_EVIDENCE_MAX_LENGTH);
  }
  return null;
}

/**
 * Conserta a evidência que não confere com a lição, sem chamar a IA de novo.
 *
 * A validação exige que `storyEvidence` seja um trecho da lição. Quando a IA
 * parafraseia em vez de copiar, a correção automática — outra chamada paga —
 * costuma errar do mesmo jeito, e a geração falha depois de duas cobranças.
 * Aqui o conserto é determinístico:
 *
 * - se a lição cita o elemento, a evidência vira a frase real que o cita;
 * - se não cita, a afirmação falsa sai e o elemento passa a `extra` — é um
 *   acréscimo, que o revisor pode manter ou tirar.
 *
 * Altera o kit recebido e devolve o que mudou, para o log.
 */
export function repairCutoutStoryEvidence(
  generated: JsonObject,
  completeStory: string,
): { requoted: string[]; demoted: string[] } {
  const requoted: string[] = [];
  const demoted: string[] = [];
  const assets = Array.isArray(generated.assets) ? generated.assets : [];

  for (const rawAsset of assets) {
    const items = Array.isArray(asObject(rawAsset).items)
      ? (asObject(rawAsset).items as unknown[])
      : [];
    for (const rawItem of items) {
      const item = asObject(rawItem);
      const evidence = lessonString(item.storyEvidence).trim();
      if (!evidence || isLiteralStoryEvidence(evidence, completeStory))
        continue;

      const label = lessonString(item.label).trim();
      const sentence = sentenceMentioning(label, completeStory);
      if (sentence) {
        item.storyEvidence = sentence;
        requoted.push(label);
      } else {
        item.storyEvidence = '';
        item.extra = true;
        demoted.push(label);
      }
    }
  }

  return { requoted, demoted };
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
 * Conserta o que é só formato no kit: numeração, tamanhos e lista de categorias.
 *
 * São erros que não dizem nada sobre a qualidade do conteúdo — a IA numerou
 * `kit-1` em vez de `kit-01`, esqueceu o tamanho de um elemento ou marcou como
 * coberta uma categoria sem itens — e que têm uma resposta certa calculável.
 * Reprovar por eles custava uma geração paga inteira.
 *
 * O que depende de conteúdo continua com a validação: quantidade de pranchas,
 * presença de personagens, cenário e céu, e os extras exigidos.
 */
export function normalizeCutoutKitStructure(generated: JsonObject): void {
  const assets = Array.isArray(generated.assets)
    ? generated.assets.map(asObject)
    : [];
  const present = new Set<string>();

  assets.forEach((asset, index) => {
    asset.id = `kit-${String(index + 1).padStart(2, '0')}`;
    const items = Array.isArray(asset.items) ? asset.items.map(asObject) : [];
    for (const item of items) {
      if (!CUTOUT_ITEM_SIZES.includes(lessonString(item.size))) {
        item.size = CUTOUT_DEFAULT_ITEM_SIZE;
      }
      const category =
        lessonString(item.category) || lessonString(asset.category);
      if (CATEGORIES.includes(category)) present.add(category);
    }
  });

  // A lista de cobertura passa a refletir o que o kit realmente traz.
  const declared = Array.isArray(generated.coverageChecklist)
    ? generated.coverageChecklist.map(asObject)
    : [];
  generated.coverageChecklist = CATEGORIES.map((category) => {
    const entry = declared.find((item) => item.category === category) ?? {};
    if (present.has(category)) {
      return { ...entry, category, status: CUTOUT_COVERAGE_COVERED };
    }
    return {
      ...entry,
      category,
      status: CUTOUT_COVERAGE_NOT_APPLICABLE,
      justification:
        lessonString(entry.justification).trim() ||
        CUTOUT_DEFAULT_NOT_APPLICABLE_JUSTIFICATION,
    };
  });
}

/**
 * Marca como `extra` todo elemento que veio sem evidência na lição.
 *
 * O contrato do kit diz que `storyEvidence` só fica vazio em item neutro de céu
 * e natureza ou em item `extra` — o acréscimo além do básico. Um animal de
 * contexto que a IA incluiu sem citar a lição É um extra; ela apenas esqueceu de
 * marcar. Antes isso derrubava a geração inteira, depois de duas chamadas pagas
 * (a original e a correção automática), por causa de um único "Pombo".
 *
 * Só cobre a evidência AUSENTE. Evidência inventada — um trecho que não está na
 * lição — continua sendo erro: ali a IA afirmou algo falso sobre o texto.
 *
 * Altera o kit recebido e devolve os rótulos corrigidos, para o log.
 */
export function markUnsupportedCutoutItemsAsExtra(
  generated: JsonObject,
): string[] {
  const assets = Array.isArray(generated.assets) ? generated.assets : [];
  const marked: string[] = [];

  for (const rawAsset of assets) {
    const asset = asObject(rawAsset);
    const items = Array.isArray(asset.items) ? asset.items : [];
    for (const rawItem of items) {
      const item = asObject(rawItem);
      const category =
        lessonString(item.category) || lessonString(asset.category);
      const unsupported =
        !lessonString(item.storyEvidence).trim() &&
        item.extra !== true &&
        category !== SKY_AND_NATURE;
      if (!unsupported) continue;

      item.extra = true;
      marked.push(lessonString(item.label).trim());
    }
  }

  return marked;
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
      if (!CUTOUT_ITEM_SIZES.includes(lessonString(item.size)))
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
        if (!isLiteralStoryEvidence(evidence, completeStory))
          throw new ConflictException(
            `O storyEvidence do elemento "${label}" precisa ser um trecho literal da LIÇÃO BÍBLICA.`,
          );
      } else if (!extra && category !== SKY_AND_NATURE)
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
    if (entry.status === CUTOUT_COVERAGE_NOT_APPLICABLE) {
      if (!lessonString(entry.justification).trim())
        throw new ConflictException(
          `A categoria ${category} marcada como NOT_APPLICABLE precisa de justificativa.`,
        );
    } else if (
      entry.status !== CUTOUT_COVERAGE_COVERED ||
      !presentCategories.has(category)
    )
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
