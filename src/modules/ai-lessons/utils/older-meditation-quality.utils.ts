import {
  normalizeOlderMeditationSequence,
  olderMeditationSequenceIssue,
} from './older-meditation-sequence.utils';
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

/** The model supplies executable elements; only this adapter builds printable instructions. */
export function normalizeOlderMeditation(
  content: MeditationJson,
): MeditationJson {
  const activities = Array.isArray(content.activities)
    ? content.activities.map((raw, index) => {
        const original = object(raw);
        const activity =
          original.mechanic === Mechanic.SEQUENCE
            ? normalizeOlderMeditationSequence(original)
            : original;
        if (!Array.isArray(activity.subitems)) return activity;
        let items = activity.subitems.map(object);
        let supportText = text(activity.supportText);
        if (activity.mechanic === Mechanic.WORD_SEARCH) {
          const repaired = repairMeditationWordSearch({
            activities: [
              {
                number: index + 1,
                instruction: supportText,
                answer: items.map((item) => text(item.answer)).join('\n'),
              },
            ],
          });
          const puzzle = object((repaired.activities as MeditationJson[])[0]);
          if (text(puzzle.instruction) !== supportText && items.length === 1) {
            supportText = text(puzzle.instruction);
            items = [{ ...items[0], answer: text(puzzle.answer) }];
          }
        }
        const instruction = [
          text(activity.context),
          text(activity.command),
          supportText,
          ...items.map((item, number) => {
            const options = Array.isArray(item.options)
              ? item.options.map(text).filter(Boolean)
              : [];
            const choices = options.map(
              (option, position) => `(${position + 1}) ${option}`,
            );
            const compact = choices.join('   ');
            return [
              `${String.fromCharCode(97 + number)}) ${text(item.prompt)}`,
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
  return { ...content, activities };
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

export function olderMeditationContentIssue(
  content: MeditationJson,
): string | null {
  const activities = Array.isArray(content.activities)
    ? content.activities.map(object)
    : [];
  if (activities.length !== L.activities)
    return 'São necessários três blocos de desafios completos.';
  const introWords = olderMeditationInstructionWords(content.introduction);
  if (!text(content.introduction) || introWords > L.maximumIntroductionWords)
    return `A introdução deve estar preenchida e ter até ${L.maximumIntroductionWords} palavras claras, sem preenchimento artificial (recebidas: ${introWords}).`;
  if (
    !text(content.prayer) ||
    olderMeditationInstructionWords(content.prayer) > L.maximumPrayerWords
  )
    return 'A oração deve ser uma frase curta ligada à aplicação.';
  const expectedGoals = [Goal.NARRATIVE, Goal.COMPREHENSION, Goal.APPLICATION];
  const seenQuestions = new Set<string>();
  const seenMechanics = new Set<string>();
  const assets = Array.isArray(content.printableAssets)
    ? content.printableAssets.map(object)
    : [];
  const ids = assets.map((asset) => text(asset.id));
  if (
    new Set(ids).size !== ids.length ||
    ids.some((id) => !['1', '2', '3'].includes(id))
  )
    return 'Cada arte precisa de um ID único correspondente ao desafio 1, 2 ou 3.';
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
    if (activity.goal !== expectedGoals[index])
      return `${label} siga a progressão narrativa, compreensão e aplicação.`;
    if (!text(activity.sourceExcerpt))
      return `${label} falta o trecho da lição que fundamenta a atividade.`;
    if (
      !text(activity.command) ||
      olderMeditationInstructionWords(activity.command) >
        L.maximumCommandWords ||
      olderMeditationInstructionWords(activity.context) > L.maximumContextWords
    )
      return `${label} use contexto breve e um comando claro, sem introdução longa.`;
    if (activity.visualRequired !== true)
      return `${label} precisa de uma imagem de anexo ou apoio visual à questão (visualRequired true).`;
    const ownAssets = assets.filter(
      (asset) => text(asset.id) === String(index + 1),
    );
    if (ownAssets.length !== 1)
      return `${label} precisa de exatamente uma arte de anexo ou apoio; a folha deve ter três imagens.`;
    if (ownAssets.some((asset) => !text(asset.prompt)))
      return `${label} a arte precisa de composição completa.`;
    const items = Array.isArray(activity.subitems)
      ? activity.subitems.map(object)
      : [];
    if (items.length < L.minimumSubitems || items.length > L.maximumSubitems)
      return `${label} forneça ${L.minimumSubitems}–${L.maximumSubitems} subitens completos, conforme a complexidade da atividade.`;
    for (const item of items) {
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
        const minimumOptions = mechanic === Mechanic.TRUE_FALSE ? 2 : 3;
        if (
          options.length < minimumOptions ||
          !options.some(
            (option) => signature(option) === signature(text(item.answer)),
          )
        )
          return `${label} forneça alternativas completas e copie a resposta correta no gabarito.`;
      }
      if (mechanic === Mechanic.FILL_BLANK && !/_{2,}/.test(text(item.prompt)))
        return `${label} a frase precisa de uma lacuna para preencher.`;
    }
    const instruction = text(activity.instruction);
    if (/\*\*|^\s*#{1,6}\s/m.test(instruction))
      return `${label} remova Markdown do texto imprimível.`;
    if (olderMeditationInstructionWords(instruction) > L.maximumActivityWords)
      return `${label} ficou longo demais; simplifique sem remover pistas ou dados.`;
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
    (sum, activity) =>
      sum + olderMeditationInstructionWords(activity.instruction),
    introWords,
  );
  if (totalWords > L.maximumSheetWords)
    return 'A folha excede o espaço legível de uma página; reduza a extensão preservando os exercícios.';
  return null;
}
