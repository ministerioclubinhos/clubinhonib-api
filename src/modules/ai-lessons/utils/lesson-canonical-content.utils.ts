import { ConflictException } from '@nestjs/common';
import { LESSON_NARRATIVE_INCOMPLETE_PREFIX } from '../constants/lesson-editorial.constants';
import { LessonStageType } from '../enums/lesson.enums';
import { lessonNarrativeIssue } from '../lessonNarrative.utils';
import { lessonString, normalizeLessonVerseReference } from '../utils';
import { preserveServerOwnedAssetsOnManualSave } from './lesson-asset-ownership.utils';
import { editedOlderMeditation } from './older-meditation-content.utils';
import { editedYoungerMeditation } from './younger-meditation-content.utils';

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function tiptapNodeText(node: JsonObject): string {
  if (node.type === 'hardBreak') return '\n';
  const ownText = lessonString(node.text);
  const children = Array.isArray(node.content)
    ? node.content.map((item) =>
        item && typeof item === 'object'
          ? tiptapNodeText(item as JsonObject)
          : '',
      )
    : [];
  const separator = ['bulletList', 'orderedList', 'listItem'].includes(
    String(node.type),
  )
    ? '\n'
    : '';
  return [ownText, ...children].filter(Boolean).join(separator);
}

interface ExtractedSection {
  present: boolean;
  text: string;
  nodes: JsonObject[];
}

function normalizeHeading(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR');
}

export function extractTiptapSection(
  document: JsonObject,
  headingCandidates: readonly string[],
): ExtractedSection {
  const nodes = Array.isArray(document.content)
    ? document.content.filter(
        (item): item is JsonObject =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item),
      )
    : [];
  const normalizedCandidates = headingCandidates.map(normalizeHeading);
  const start = nodes.findIndex(
    (node) =>
      node.type === 'heading' &&
      normalizedCandidates.includes(normalizeHeading(tiptapNodeText(node))),
  );
  if (start < 0) {
    return { present: false, text: '', nodes: [] };
  }

  const headingLevel = Number(asObject(nodes[start].attrs).level ?? 2);
  const remaining = nodes.slice(start + 1);
  const end = remaining.findIndex(
    (node) =>
      node.type === 'heading' &&
      Number(asObject(node.attrs).level ?? 2) <= headingLevel,
  );
  const sectionNodes = end < 0 ? remaining : remaining.slice(0, end);
  const text = sectionNodes
    .map((node) => {
      const nodeText = tiptapNodeText(node).trim();
      return node.type === 'heading' && nodeText ? `### ${nodeText}` : nodeText;
    })
    .filter(Boolean)
    .join('\n\n')
    .trim();

  return {
    present: true,
    text,
    nodes: sectionNodes,
  };
}

function extractListItemsFromSection(section: ExtractedSection): string[] {
  const items: string[] = [];
  for (const node of section.nodes) {
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      const children = Array.isArray(node.content) ? node.content : [];
      for (const child of children) {
        const text = tiptapNodeText(asObject(child))
          .trim()
          .replace(/^(?:•|\d+[.)])\s*/, '')
          .trim();
        if (text) items.push(text);
      }
    } else if (node.type === 'paragraph') {
      const lines = tiptapNodeText(node)
        .split(/\r?\n/)
        .map((line) =>
          line
            .trim()
            .replace(/^(?:•|\d+[.)])\s*/, '')
            .trim(),
        )
        .filter(Boolean);
      items.push(...lines);
    }
  }
  return items;
}

function parseLessonMemoryVerseSection(
  section: ExtractedSection,
  previousVerse: JsonObject,
): JsonObject {
  const lines = section.text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return { text: '', reference: '', version: '' };
  }

  if (lines.length === 1) {
    const singleLine = lines[0];
    const parts = singleLine.split(/\s*[—–]\s*/);
    if (parts.length >= 2) {
      const text = parts[0].replace(/^[“"«]|[”"»]$/g, '').trim();
      const reference = normalizeLessonVerseReference(parts[1]);
      const version = (
        parts[2] ??
        (lessonString(previousVerse.version) || 'NVI')
      ).trim();
      return { text, reference, version };
    }
    return {
      text: singleLine.replace(/^[“"«]|[”"»]$/g, '').trim(),
      reference: normalizeLessonVerseReference(previousVerse.reference),
      version: lessonString(previousVerse.version).trim() || 'NVI',
    };
  }

  const text = lines[0].replace(/^[“"«]|[”"»]$/g, '').trim();
  const refLine = lines[1];
  const refParts = refLine.split(/\s*[—–]\s*/);
  const reference = normalizeLessonVerseReference(refParts[0]);
  const version = (
    refParts[1] ??
    (/\bNVI\b/i.test(refLine)
      ? 'NVI'
      : lessonString(previousVerse.version).trim() || 'NVI')
  ).trim();
  return { text, reference, version };
}

function parseReviewQuestionsSection(section: ExtractedSection): JsonObject[] {
  const lines = section.text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const questions: JsonObject[] = [];
  for (const line of lines) {
    if (/^resposta\s*:/i.test(line)) {
      const answer = line.replace(/^resposta\s*:\s*/i, '').trim();
      if (questions.length > 0) {
        questions[questions.length - 1].answer = answer;
      }
    } else {
      const question = line.replace(/^\d+[.)]\s*/, '').trim();
      if (question) {
        questions.push({ question, answer: '' });
      }
    }
  }
  return questions;
}

function extractLessonTitleFromAst(document: JsonObject): string | undefined {
  const nodes = Array.isArray(document.content)
    ? document.content.filter(
        (item): item is JsonObject =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item),
      )
    : [];
  const h1Nodes = nodes.filter(
    (node) =>
      node.type === 'heading' && Number(asObject(node.attrs).level ?? 1) === 1,
  );
  if (h1Nodes.length === 0) return undefined;
  const nonMarker = h1Nodes
    .map((node) => tiptapNodeText(node).trim())
    .filter(
      (text) =>
        Boolean(text) &&
        !/^LIÇÃO(?:\s+ESPECIAL)?(?:\s+\d+)?$/i.test(text) &&
        !/^TÍTULO$/i.test(text),
    );
  return nonMarker[0];
}

function reconcileLessonStructuredContent(
  base: JsonObject,
  document: JsonObject,
): JsonObject {
  const next: JsonObject = { ...base };
  const nodes = Array.isArray(document.content)
    ? document.content.filter(
        (item): item is JsonObject =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item),
      )
    : [];
  const hasLevel2Headings = nodes.some(
    (node) =>
      node.type === 'heading' && Number(asObject(node.attrs).level ?? 2) === 2,
  );

  const editedTitle = extractLessonTitleFromAst(document);
  if (editedTitle !== undefined) {
    next.title = editedTitle;
  }

  const biblicalRefSection = extractTiptapSection(document, ['TEXTO BÍBLICO']);
  if (biblicalRefSection.present) {
    next.biblicalReference = biblicalRefSection.text;
  }

  const purposeSection = extractTiptapSection(document, ['PROPÓSITO']);
  if (purposeSection.present) {
    next.purpose = purposeSection.text;
  }

  const songsSection = extractTiptapSection(document, ['MÚSICAS']);
  if (songsSection.present) {
    next.songs = extractListItemsFromSection(songsSection);
  }

  const verseSection = extractTiptapSection(document, [
    'VERSÍCULO PARA MEMORIZAR',
  ]);
  if (verseSection.present) {
    next.memoryVerse = parseLessonMemoryVerseSection(
      verseSection,
      asObject(next.memoryVerse),
    );
  } else if (hasLevel2Headings && 'memoryVerse' in next) {
    next.memoryVerse = { text: '', reference: '', version: '' };
  }

  const principleSection = extractTiptapSection(document, [
    'EXPLICAÇÃO DO PRINCÍPIO',
  ]);
  if (principleSection.present) {
    next.principleExplanation = principleSection.text;
  }

  const storySection = extractTiptapSection(document, ['LIÇÃO BÍBLICA']);
  if (storySection.present) {
    next.story = storySection.text;
  } else if (hasLevel2Headings && 'story' in next) {
    next.story = '';
  }

  const applicationSection = extractTiptapSection(document, [
    'APLICAÇÃO E APELO',
  ]);
  if (applicationSection.present) {
    next.applicationAndAppeal = applicationSection.text;
  }

  const counselingSection = extractTiptapSection(document, [
    'ACONSELHAMENTO / CANTINHO DO ACONSELHAMENTO',
    'CANTINHO DO ACONSELHAMENTO',
  ]);
  if (counselingSection.present) {
    next.counseling = counselingSection.text;
  }

  const questionsSection = extractTiptapSection(document, [
    'PERGUNTAS DA LIÇÃO',
  ]);
  if (questionsSection.present) {
    next.reviewQuestions = parseReviewQuestionsSection(questionsSection);
  }

  const prayerSection = extractTiptapSection(document, ['FALANDO COM DEUS']);
  if (prayerSection.present) {
    next.closingPrayer = prayerSection.text;
  }

  return next;
}

function reconcileGameStructuredContent(
  base: JsonObject,
  document: JsonObject,
): JsonObject {
  const next: JsonObject = { ...base };
  const nodes = Array.isArray(document.content)
    ? document.content.filter(
        (item): item is JsonObject =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item),
      )
    : [];
  const hasHeadings = nodes.some((node) => node.type === 'heading');

  const nameSection = extractTiptapSection(document, ['NOME']);
  if (nameSection.present) {
    next.name = nameSection.text;
  }

  const objectiveSection = extractTiptapSection(document, ['OBJETIVO']);
  if (objectiveSection.present) {
    next.objective = objectiveSection.text;
  }

  const mechanicsSection = extractTiptapSection(document, [
    'MECÂNICAS DIVERTIDAS',
    'FUN MECHANICS',
  ]);
  if (mechanicsSection.present) {
    next.funMechanics = Array.isArray(next.funMechanics)
      ? extractListItemsFromSection(mechanicsSection)
      : mechanicsSection.text;
  }

  const materialsSection = extractTiptapSection(document, ['MATERIAIS']);
  if (materialsSection.present) {
    next.materials = extractListItemsFromSection(materialsSection);
  }

  const preparationSection = extractTiptapSection(document, ['PREPARAÇÃO']);
  if (preparationSection.present) {
    next.preparation = Array.isArray(next.preparation)
      ? extractListItemsFromSection(preparationSection)
      : preparationSection.text;
  }

  const stepsSection = extractTiptapSection(document, ['PASSO A PASSO']);
  if (stepsSection.present) {
    const steps = extractListItemsFromSection(stepsSection);
    next.steps = steps;
    if (Array.isArray(next.assets) && steps.length === next.assets.length) {
      next.assets = (next.assets as unknown[]).map((raw, index) => ({
        ...asObject(raw),
        stepNumber: index + 1,
        instruction: steps[index],
      }));
    }
  } else if (hasHeadings && 'steps' in next) {
    next.steps = [];
  }

  const rulesSection = extractTiptapSection(document, ['REGRAS E SEGURANÇA']);
  if (rulesSection.present) {
    next.rulesAndSafety = Array.isArray(next.rulesAndSafety)
      ? extractListItemsFromSection(rulesSection)
      : rulesSection.text;
  }

  const principleSection = extractTiptapSection(document, [
    'PRINCÍPIO BÍBLICO',
  ]);
  if (principleSection.present) {
    next.biblicalPrinciple = principleSection.text;
  }

  const evaluationSection = extractTiptapSection(document, ['COMO AVALIAR']);
  if (evaluationSection.present) {
    next.evaluation = evaluationSection.text;
  }

  const ages5To7Section = extractTiptapSection(document, [
    'CRIANÇAS DE 5 A 7 ANOS',
    'AGES5TO7',
  ]);
  const ages8To11Section = extractTiptapSection(document, [
    'CRIANÇAS DE 8 A 11 ANOS',
    'AGES8TO11',
  ]);
  if (ages5To7Section.present || ages8To11Section.present) {
    const prevAdaptations = asObject(next.ageAdaptations);
    next.ageAdaptations = {
      ...prevAdaptations,
      ...(ages5To7Section.present ? { ages5To7: ages5To7Section.text } : {}),
      ...(ages8To11Section.present ? { ages8To11: ages8To11Section.text } : {}),
    };
  }

  return next;
}

export function reconcileStageStructuredContent(
  stageType: LessonStageType,
  currentStructured: JsonObject | null | undefined,
  candidateStructured: JsonObject | null | undefined,
  tiptapAstJson: JsonObject | null | undefined,
): JsonObject {
  const safeBase = preserveServerOwnedAssetsOnManualSave(
    currentStructured,
    candidateStructured ?? currentStructured ?? {},
  );
  const document =
    tiptapAstJson &&
    typeof tiptapAstJson === 'object' &&
    !Array.isArray(tiptapAstJson)
      ? tiptapAstJson
      : null;
  if (!document) return safeBase;

  if (stageType === LessonStageType.LESSON) {
    return reconcileLessonStructuredContent(safeBase, document);
  }

  if (
    stageType === LessonStageType.STANDARD_GAME ||
    stageType === LessonStageType.VERSE_FIXATION
  ) {
    return reconcileGameStructuredContent(safeBase, document);
  }

  if (stageType === LessonStageType.MEDITATION_YOUNGER) {
    return preserveServerOwnedAssetsOnManualSave(
      currentStructured,
      editedYoungerMeditation(safeBase, document),
    );
  }

  if (stageType === LessonStageType.MEDITATION_OLDER) {
    return preserveServerOwnedAssetsOnManualSave(
      currentStructured,
      editedOlderMeditation(safeBase, document),
    );
  }

  return safeBase;
}

export function assertStageReadyForCompletionOrPublication(
  stageType: LessonStageType,
  structuredDataJson: JsonObject | null | undefined,
  tiptapAstJson?: JsonObject | null,
): void {
  const raw = asObject(structuredDataJson);
  const hasRichPayload = Object.keys(raw).length > 0 || Boolean(tiptapAstJson);
  if (!hasRichPayload) return;

  const canonical = reconcileStageStructuredContent(
    stageType,
    raw,
    raw,
    tiptapAstJson ?? null,
  );

  if (stageType === LessonStageType.LESSON) {
    if ('story' in canonical) {
      const story = lessonString(canonical.story).trim();
      if (!story) {
        throw new ConflictException(
          'A lição não pode ser concluída ou publicada com o tópico LIÇÃO BÍBLICA vazio.',
        );
      }
      const narrativeIssue = lessonNarrativeIssue(story);
      if (narrativeIssue) {
        throw new ConflictException(
          `${LESSON_NARRATIVE_INCOMPLETE_PREFIX}: ${narrativeIssue}. Revise o texto antes de concluir.`,
        );
      }
    }
    if ('memoryVerse' in canonical) {
      const verse = asObject(canonical.memoryVerse);
      if (
        !lessonString(verse.text).trim() ||
        !lessonString(verse.reference).trim() ||
        lessonString(verse.version).trim().toUpperCase() !== 'NVI'
      ) {
        throw new ConflictException(
          'A lição precisa manter o versículo principal com texto, referência e versão NVI antes de concluir.',
        );
      }
    }
    return;
  }

  if (
    stageType === LessonStageType.STANDARD_GAME ||
    stageType === LessonStageType.VERSE_FIXATION
  ) {
    if ('steps' in canonical || 'assets' in canonical) {
      const steps = Array.isArray(canonical.steps)
        ? canonical.steps
            .map((step) => lessonString(step).trim())
            .filter(Boolean)
        : [];
      const assets = Array.isArray(canonical.assets)
        ? canonical.assets.map(asObject)
        : [];
      if (steps.length === 0) {
        throw new ConflictException(
          'A brincadeira precisa manter ao menos um passo no PASSO A PASSO.',
        );
      }
      if (assets.length > 0 && steps.length !== assets.length) {
        throw new ConflictException(
          'A quantidade de passos do texto editado não corresponde às imagens instrucionais geradas. Ajuste os passos ou gere a etapa novamente.',
        );
      }
      if (
        assets.length > 0 &&
        assets.some(
          (asset, index) =>
            !lessonString(asset.url).trim() ||
            lessonString(asset.instruction).trim() !== steps[index],
        )
      ) {
        throw new ConflictException(
          'Cada passo da brincadeira precisa corresponder exatamente à sua imagem instrucional.',
        );
      }
    }
    return;
  }

  if (stageType === LessonStageType.LESSON_VISUALS) {
    if ('assets' in canonical) {
      const assets = Array.isArray(canonical.assets)
        ? canonical.assets.map(asObject)
        : [];
      if (
        assets.length === 0 ||
        assets.some((asset) => !lessonString(asset.url).trim())
      ) {
        throw new ConflictException(
          'Os visuais da história precisam conter imagens válidas antes da conclusão ou publicação.',
        );
      }
    }
    return;
  }

  if (
    stageType === LessonStageType.VERSE_VISUALS ||
    stageType === LessonStageType.MANUAL_WORK
  ) {
    if ('printableAssets' in canonical) {
      const assets = Array.isArray(canonical.printableAssets)
        ? canonical.printableAssets.map(asObject)
        : [];
      if (
        assets.length === 0 ||
        assets.some((asset) => !lessonString(asset.url).trim())
      ) {
        throw new ConflictException(
          'Este item precisa conter todas as artes imprimíveis válidas antes da conclusão ou publicação.',
        );
      }
    }
    return;
  }

  if (
    stageType === LessonStageType.MEDITATION_YOUNGER ||
    stageType === LessonStageType.MEDITATION_OLDER
  ) {
    if ('activities' in canonical) {
      const activities = Array.isArray(canonical.activities)
        ? canonical.activities.map(asObject)
        : [];
      if (
        activities.length === 0 ||
        activities.some(
          (activity) => !lessonString(activity.instruction).trim(),
        )
      ) {
        throw new ConflictException(
          'Todas as atividades da meditação precisam manter instruções preenchidas.',
        );
      }
    }
  }
}
