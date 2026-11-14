import {
  normalizeOlderMeditationSequence,
  olderMeditationSequenceIssue,
} from './older-meditation-sequence.utils';
import { meditationCodeMatches } from './meditation-code.utils';
import {
  repairOlderMeditationActivity,
  repairOlderMeditationGoals,
} from './older-meditation-repair.utils';
import { OLDER_MEDITATION_LAYOUT } from '../constants/older-meditation-layout.constants';
import {
  OlderMeditationGoal as Goal,
  OlderMeditationMechanic as Mechanic,
} from '../enums/older-meditation.enums';
import { OLDER_MEDITATION_LIMITS as L } from '../constants/older-meditation-contract.constants';
import type { MeditationJson } from '../types/younger-meditation.types';
import { meditationWordSearchIssue } from './meditation-word-search.utils';
import { repairMeditationWordSearch } from './repair-meditation-word-search.utils';

function object(value: unknown): MeditationJson {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as MeditationJson)
    : {};
}
function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
function signature(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
export function olderMeditationInstructionWords(value: unknown): number {
  return (
    text(value)
      .split(/\r?\n/)
      .filter((line) => !/^[A-ZÀ-Ü\s]{4,}$/.test(line.trim()))
      .join(' ')
      .match(/\S+/g)?.length ?? 0
  );
}

/**
 * Words the child actually reads in a question: context, command and the
 * prompts and options of its subitems. Exercise data (word-search or
 * crossword grids, code tables, ciphered sentences, word banks) is excluded:
 * it is solved, not read, and the page fit is checked by the layout.
 */
export function olderMeditationReadingWords(activity: MeditationJson): number {
  const subitems = Array.isArray(activity.subitems)
    ? activity.subitems.map(object)
    : [];
  return (
    olderMeditationInstructionWords(activity.context) +
    olderMeditationInstructionWords(activity.command) +
    subitems.reduce(
      (sum, item) =>
        sum +
        olderMeditationInstructionWords(item.prompt) +
        (Array.isArray(item.options)
          ? item.options.reduce<number>(
              (total, option) =>
                total + olderMeditationInstructionWords(option),
              0,
            )
          : 0),
      0,
    )
  );
}

/** The model supplies executable elements; only this adapter builds printable instructions. */
export function normalizeOlderMeditation(
  content: MeditationJson,
): MeditationJson {
  const activities = Array.isArray(content.activities)
    ? content.activities.map((raw, index) => {
        const original = repairOlderMeditationActivity(object(raw));
        const activity =
          original.mechanic === Mechanic.SEQUENCE
            ? normalizeOlderMeditationSequence(original)
            : original;
        if (!Array.isArray(activity.subitems)) return activity;
        let items = activity.subitems.map(object);
        let supportText = text(activity.supportText);
        if (activity.mechanic === Mechanic.WORD_SEARCH) {
          const repaired = repairMeditationWordSearch(
            {
              activities: [
                {
                  number: index + 1,
                  instruction: supportText,
                  answer: items.map((item) => text(item.answer)).join('\n'),
                },
              ],
            },
            // Generated sheets always get a server-built grid, as in the
            // printed sheets: random filler, words in several directions.
            true,
          );
          const puzzle = object((repaired.activities as MeditationJson[])[0]);
          if (text(puzzle.instruction) !== supportText && items.length === 1) {
            supportText = text(puzzle.instruction);
            items = [{ ...items[0], answer: text(puzzle.answer) }];
          }
        }
        // Como nas folhas impressas: o trecho da história e o comando formam
        // um único parágrafo, logo depois do número da questão.
        const instruction = [
          [text(activity.context), text(activity.command)]
            .filter(Boolean)
            .join(' '),
          supportText,
          ...items.map((item, number) => {
            const options = Array.isArray(item.options)
              ? item.options.map(text).filter(Boolean)
              : [];
            // As in the handmade sheets: "( ) option" to mark.
            const choices = options.map((option) => `( ) ${option}`);
            const compact = choices.join('   ');
            // Open answers get lines to write on, as in the printed sheets.
            const writing =
              [Mechanic.SHORT_ANSWER, Mechanic.CODE].includes(
                activity.mechanic as Mechanic,
              ) && !options.length
                ? [
                    OLDER_MEDITATION_LAYOUT.writingLine,
                    OLDER_MEDITATION_LAYOUT.writingLine,
                  ]
                : [];
            return [
              `${String.fromCharCode(97 + number)}) ${text(item.prompt)}`,
              ...writing,
              ...(compact.length <=
              OLDER_MEDITATION_LAYOUT.inlineOptionsMaximumCharacters
                ? compact
                  ? [compact]
                  : []
                : choices),
            ].join('\n');
          }),
        ]
          .filter(Boolean)
          .join('\n');
        return {
          ...activity,
          number: index + 1,
          supportText,
          subitems: items,
          instruction,
          answer: items
            .map(
              (item, number) =>
                `${String.fromCharCode(97 + number)}) ${text(item.answer)}`,
            )
            .join('\n'),
        };
      })
    : [];
  return reconcileOlderMeditationArt({
    ...content,
    activities: repairOlderMeditationGoals(activities.map(object)),
  });
}

export function olderMeditationLessonSource(
  content: MeditationJson | null,
): MeditationJson | null {
  if (!content) return null;
  return {
    title: content.title,
    biblicalReference: content.biblicalReference,
    story: content.story,
    memoryVerse: content.memoryVerse,
    purpose: content.purpose,
    applicationAndAppeal: content.applicationAndAppeal,
  };
}
export function olderMeditationExpansionContext(
  content: MeditationJson,
): string {
  return `Corrija o JSON completo preservando o tema, as mecânicas válidas e as instruções do administrador. Não acrescente texto para atingir contagem de palavras. Cada bloco precisa ser executável, diferente dos demais e ter gabarito completo. VERSÃO A CORRIGIR:\n${JSON.stringify(content)}`;
}

/**
 * Imagens da folha: no máximo uma por questão, só nas questões com
 * visualRequired true, com id igual ao número da questão. Questões de texto
 * (completar, código, caça-palavras) não têm imagem, como nas folhas impressas.
 */
export function olderMeditationAssetIssue(
  assets: MeditationJson[],
  activities: MeditationJson[],
): string | null {
  const ids = assets.map((asset) => text(asset.id));
  const valid = activities.map((_, index) => String(index + 1));
  if (new Set(ids).size !== ids.length || ids.some((id) => !valid.includes(id)))
    return `Cada arte precisa de um ID único igual ao número de uma questão (1 a ${activities.length}).`;
  for (const [index, activity] of activities.entries()) {
    const label = `Desafio ${index + 1}:`;
    const own = assets.filter((asset) => text(asset.id) === String(index + 1));
    if (activity.visualRequired === true && own.length !== 1)
      return `${label} marcou visualRequired true e precisa de exatamente uma arte.`;
    if (activity.visualRequired !== true && own.length)
      return `${label} tem arte sem visualRequired true; marque a questão como ilustrada ou remova a arte.`;
    if (own.some((asset) => !text(asset.prompt)))
      return `${label} a arte precisa de composição completa.`;
  }
  return null;
}

/**
 * Progressão das folhas impressas: a questão 1 recorda a história e ao menos
 * uma questão trabalha compreensão ou aplicação. A ordem das demais é livre,
 * como nos modelos da equipe.
 */
export function olderMeditationGoalIssue(
  activities: MeditationJson[],
): string | null {
  if (activities[0]?.goal !== Goal.NARRATIVE)
    return 'Desafio 1: a primeira questão recorda a história (goal NARRATIVE).';
  if (!activities.some((activity) => activity.goal !== Goal.NARRATIVE))
    return 'A folha precisa de ao menos uma questão de compreensão ou aplicação, de preferência a última.';
  return null;
}

export function olderMeditationContentIssue(
  content: MeditationJson,
): string | null {
  const activities = Array.isArray(content.activities)
    ? content.activities.map(object)
    : [];
  if (
    activities.length < L.minimumActivities ||
    activities.length > L.maximumActivities
  )
    return `A folha precisa de ${L.minimumActivities} a ${L.maximumActivities} questões completas, conforme o tamanho dos exercícios.`;
  const introWords = olderMeditationInstructionWords(content.introduction);
  if (introWords > L.maximumIntroductionWords)
    return `A introdução é opcional e curta: até ${L.maximumIntroductionWords} palavras (recebidas: ${introWords}). O contexto vai dentro de cada questão.`;
  if (
    !text(content.prayer) ||
    olderMeditationInstructionWords(content.prayer) > L.maximumPrayerWords
  )
    return 'A oração deve ser uma frase curta ligada à aplicação.';
  const seenQuestions = new Set<string>();
  const seenMechanics = new Set<string>();
  const assets = Array.isArray(content.printableAssets)
    ? content.printableAssets.map(object)
    : [];
  const assetIssue = olderMeditationAssetIssue(assets, activities);
  if (assetIssue) return assetIssue;
  const goalIssue = olderMeditationGoalIssue(activities);
  if (goalIssue) return goalIssue;
  for (const [index, activity] of activities.entries()) {
    const label = `Desafio ${index + 1}:`;
    const mechanic = text(activity.mechanic) as Mechanic;
    if (mechanic === Mechanic.SEQUENCE) {
      const issue = olderMeditationSequenceIssue(activity);
      if (issue) return `${label} ${issue}`;
    }
    if (!Object.values(Mechanic).includes(mechanic))
      return `${label} declare uma mecânica reconhecida ou OTHER.`;
    if (seenMechanics.has(mechanic))
      return `${label} repete a mecânica de outro bloco.`;
    seenMechanics.add(mechanic);
    if (!Object.values(Goal).includes(activity.goal as Goal))
      return `${label} declare o objetivo da questão (narrativa, compreensão ou aplicação).`;
    if (!text(activity.sourceExcerpt))
      return `${label} falta o trecho da lição que fundamenta a atividade.`;
    if (
      !text(activity.command) ||
      olderMeditationInstructionWords(activity.command) >
        L.maximumCommandWords ||
      olderMeditationInstructionWords(activity.context) > L.maximumContextWords
    )
      return `${label} use contexto breve e um comando claro, sem introdução longa.`;
    const items = Array.isArray(activity.subitems)
      ? activity.subitems.map(object)
      : [];
    if (items.length < L.minimumSubitems || items.length > L.maximumSubitems)
      return `${label} forneça ${L.minimumSubitems}–${L.maximumSubitems} subitens completos, conforme a complexidade da atividade.`;
    for (const [itemIndex, item] of items.entries()) {
      const itemLabel = `${label} item ${String.fromCharCode(97 + itemIndex)})`;
      if (
        !text(item.prompt) ||
        !text(item.answer) ||
        !Array.isArray(item.options)
      )
        return `${label} cada subitem precisa de enunciado, alternativas (ou lista vazia) e gabarito.`;
      const question = signature(text(item.prompt));
      if (seenQuestions.has(question))
        return `${label} repete uma pergunta da folha.`;
      seenQuestions.add(question);
      const options = item.options.map(text);
      if (
        options.some((option) => !option) ||
        new Set(options.map(signature)).size !== options.length
      )
        return `${label} alternativas vazias ou repetidas.`;
      if ([Mechanic.MULTIPLE_CHOICE, Mechanic.TRUE_FALSE].includes(mechanic)) {
        // The printed sheets circle between two options too ("Marta / Maria").
        if (options.length < L.minimumChoiceOptions)
          return `${itemLabel} a escolha precisa de ao menos ${L.minimumChoiceOptions} alternativas (recebidas: ${options.length}).`;
        if (
          !options.some(
            (option) => signature(option) === signature(text(item.answer)),
          )
        )
          return `${itemLabel} o gabarito "${text(item.answer)}" não é igual a nenhuma alternativa (${options.join(' / ')}); copie no gabarito exatamente a alternativa correta.`;
      }
      if (mechanic === Mechanic.FILL_BLANK && !/_{2,}/.test(text(item.prompt)))
        return `${label} a frase precisa de uma lacuna para preencher.`;
    }
    const instruction = text(activity.instruction);
    if (/\*\*|^\s*#{1,6}\s/m.test(instruction))
      return `${label} remova Markdown do texto imprimível.`;
    if (olderMeditationReadingWords(activity) > L.maximumActivityWords)
      return `${label} ficou longo demais; simplifique sem remover pistas ou dados.`;
    // A code must decode, with its own legend, into the answer key.
    if (
      mechanic === Mechanic.CODE &&
      !meditationCodeMatches(
        text(activity.supportText),
        items.map((item) => text(item.answer)).join(' '),
      )
    )
      return `${label} o código, decifrado pela própria tabela, não forma a resposta do gabarito; confira a tabela e a frase cifrada.`;
    if (mechanic === Mechanic.WORD_SEARCH) {
      const support = text(activity.supportText);
      if (
        !/^\s*palavras\s*:/im.test(support) ||
        support
          .split(/\r?\n/)
          .filter((line) => /^[A-ZÀ-Ü\s]{4,}$/.test(line.trim())).length < 3
      )
        return `${label} o caça-palavras precisa de lista e grade completa na própria folha.`;
    }
    const puzzleIssue = meditationWordSearchIssue(instruction);
    if (puzzleIssue) return `${label} ${puzzleIssue}`;
  }
  const totalWords = activities.reduce(
    (sum, activity) => sum + olderMeditationReadingWords(object(activity)),
    introWords,
  );
  if (totalWords > L.maximumSheetWords)
    return 'A folha excede o espaço legível de uma página; reduza a extensão preservando os exercícios.';
  return null;
}

/**
 * Makes each question's visualRequired flag agree with the art planned for
 * it, so a mismatch is repaired locally instead of costing a correction
 * call: a question with planned art becomes illustrated, a question marked
 * illustrated without art becomes text-only, and duplicated or out-of-range
 * art is dropped.
 */
export function reconcileOlderMeditationArt(
  content: MeditationJson,
): MeditationJson {
  const activities = Array.isArray(content.activities)
    ? content.activities.map(object)
    : [];
  if (!Array.isArray(content.printableAssets)) return content;
  const seen = new Set<string>();
  const assets = content.printableAssets.map(object).filter((asset) => {
    const id = text(asset.id);
    const valid =
      Number.isInteger(Number(id)) &&
      Number(id) >= 1 &&
      Number(id) <= activities.length &&
      !seen.has(id);
    if (valid) seen.add(id);
    return valid;
  });
  return {
    ...content,
    printableAssets: assets,
    activities: activities.map((activity, index) => ({
      ...activity,
      visualRequired: seen.has(String(index + 1)),
    })),
  };
}
