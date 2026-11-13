import { Readable } from 'node:stream';
import { IdeaAiArtifact, IdeaAiGuard, IdeaAiTextGuard } from './types';
import type { EnhancedIdeaDocumentDto } from './dto/enhanced-idea.dto';
import { IdeaDocumentBlockType } from './enums/enhanced-idea.enums';
import {
  IDEA_AI,
  IDEA_AI_ADMIN_INSTRUCTIONS_PREFIX,
  IDEA_AI_TEXT_FIELD_LABELS,
  IDEA_AI_UNCOUNTED_ERRORS,
} from './constants';
import { IdeaAiErrorCode } from './enums/ideas-section-ai.enums';
import { InternalAiProviderSettings } from 'src/modules/ai-lessons/types/ai-provider-settings.types';
import { LessonLlmProvider } from 'src/modules/ai-lessons/providers/lesson-llm.types';
import { MediaType } from 'src/shared/media/media-item/media-item.entity';
import { AiQueueException } from 'src/shared/providers/ai-queue/ai-queue.exception';
export function checkIdeaEssence(
  original: string,
  enhanced: string,
): IdeaAiGuard {
  const violations: string[] = [];
  const tokens = (text: string, pattern: RegExp): string[] => [
    ...new Set(text.match(pattern) ?? []),
  ];
  const references = /(?:[1-3]\s*)?[A-ZÀ-Ý][a-zà-ÿ]+\s+\d+:\d+(?:[-–,]\d+)*/g;
  const numbers = /\b\d+(?:[.,:]\d+)*(?:[-–]\d+)?\b/g;
  const urls = /https?:\/\/[^\s)]+/g;
  const names = /\b[A-ZÀ-Ý][a-zà-ÿ]+(?:\s+[A-ZÀ-Ý][a-zà-ÿ]+)+/g;
  for (const reference of tokens(enhanced, references))
    if (!tokens(original, references).includes(reference))
      violations.push('Uma referência bíblica foi alterada ou acrescentada.');
  for (const number of tokens(original, numbers))
    if (!tokens(enhanced, numbers).includes(number))
      violations.push(
        'Uma quantidade, idade ou referência numérica foi removida.',
      );
  for (const number of tokens(enhanced, numbers))
    if (!tokens(original, numbers).includes(number))
      violations.push('Uma quantidade ou etapa numérica foi acrescentada.');
  for (const name of tokens(original, names))
    if (
      !enhanced
        .toLocaleLowerCase('pt-BR')
        .includes(
          name
            .replace(
              /^(?:Leia|Use|Forme|Separe|Conte|Com|Para|Depois|Antes)\s+/,
              '',
            )
            .toLocaleLowerCase('pt-BR'),
        )
    )
      violations.push('Um nome próprio pode ter sido alterado.');
  for (const url of tokens(enhanced, urls))
    if (!tokens(original, urls).includes(url))
      violations.push('Uma URL foi acrescentada.');
  if (/<\/?[a-z][^>]*>/i.test(enhanced))
    violations.push('A resposta contém HTML.');
  if (
    enhanced.length < original.length * 0.6 ||
    enhanced.length > original.length * 2.5 + 300
  )
    violations.push('O tamanho do conteúdo mudou além do permitido.');
  return { approved: !violations.length, violations: [...new Set(violations)] };
}
export function ideaDocumentText(document: EnhancedIdeaDocumentDto): string {
  return [
    document.title,
    ...document.sections.flatMap((s) => [
      s.heading,
      ...s.blocks.flatMap((b) => [
        b.text,
        ...b.items.map((item, index) =>
          b.type === IdeaDocumentBlockType.NUMBERED_LIST
            ? `${index + 1}. ${item}`
            : item,
        ),
      ]),
    ]),
  ]
    .filter(Boolean)
    .join('\n');
}
export function ideaArtifactFile(
  artifact: IdeaAiArtifact,
): Express.Multer.File {
  return {
    buffer: artifact.buffer,
    size: artifact.buffer.length,
    mimetype: artifact.mimeType,
    originalname: artifact.name,
    fieldname: 'artifact',
    encoding: '7bit',
    destination: '',
    filename: artifact.name,
    path: '',
    stream: Readable.from(artifact.buffer),
  };
}

/** Compare explicitly labelled activities/sections and numbered steps detected in extracted text. */
export function checkIdeaDocumentStructure(
  original: string,
  document: EnhancedIdeaDocumentDto,
): IdeaAiGuard {
  const enhanced = ideaDocumentText(document);
  const violations: string[] = [];
  const labels =
    /^[ \t]*(?:atividade|etapa|parte|seção|secao|passo)[ \t]*(?:\d+|[:.\-–])/gim;
  const numbered = /^[ \t]*\d+[.)][ \t]+\S/gm;
  for (const pattern of [labels, numbered]) {
    const before = original.match(pattern)?.length ?? 0;
    const after = enhanced.match(pattern)?.length ?? 0;
    if (before !== after)
      violations.push(
        'A quantidade de seções, atividades ou etapas detectadas foi alterada.',
      );
  }
  return { approved: !violations.length, violations: [...new Set(violations)] };
}

/** Lease deadline computed by MySQL, compared with MySQL's own clock. */
export function leaseExpression(): string {
  return `DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ${Math.round(IDEA_AI.leaseMs / 1000)} SECOND)`;
}

/** Trims admin instructions; blank becomes undefined. */
export function trimIdeaAiInstructions({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/** Prompt suffix carrying the admin guidance, if any. */
export function withAdminInstructions(
  instructions: string,
  admin: string | null,
): string {
  return admin
    ? `${instructions}\n${IDEA_AI_ADMIN_INSTRUCTIONS_PREFIX} ${admin}`
    : instructions;
}

/** Infra failures and cancellations do not consume one of the attempts. */
export function countsTowardIdeaAiLimit(attempt: {
  errorCode: IdeaAiErrorCode | null;
}): boolean {
  return !(
    attempt.errorCode !== null &&
    IDEA_AI_UNCOUNTED_ERRORS.includes(attempt.errorCode)
  );
}

/** Maps any worker exception to a sanitized, persisted error code. */
export function ideaAiErrorCodeFrom(error: unknown): IdeaAiErrorCode {
  if (error instanceof AiQueueException)
    return IdeaAiErrorCode.QUEUE_UNAVAILABLE;
  if (error instanceof Error) {
    const known = Object.values(IdeaAiErrorCode).find(
      (code) => String(code) === error.message,
    );
    if (known) return known;
  }
  return IdeaAiErrorCode.PROVIDER_REQUEST_FAILED;
}

/** Provider, key and text model must exist before an attempt is queued. */
export function ideaAiProviderReady(
  settings: InternalAiProviderSettings,
): boolean {
  const provider = String(settings.llmProvider);
  if (
    provider !== String(LessonLlmProvider.OPENAI) &&
    provider !== String(LessonLlmProvider.GEMINI)
  )
    return false;
  const configured = settings[settings.llmProvider];
  return Boolean(configured?.apiKey && configured.generalModel);
}

/** Palavras-chave de um texto: minúsculas, sem pontuação, com tamanho mínimo. */
function ideaKeywords(text: string): Set<string> {
  return new Set(
    (text.toLocaleLowerCase('pt-BR').match(/[\p{L}\p{N}]+/gu) ?? []).filter(
      (word) => word.length >= IDEA_AI.preservationMinWordLength,
    ),
  );
}

/**
 * Quanto do original continua na versão da IA (0–1): fração das palavras-chave
 * do original presentes na proposta. Mede "upgrade" contra "reescrita": a
 * ordem pode mudar, o vocabulário de quem escreveu precisa ficar.
 */
export function ideaWordPreservation(
  original: string,
  enhanced: string,
): number {
  const before = ideaKeywords(original);
  if (!before.size) return 1;
  const after = ideaKeywords(enhanced);
  let kept = 0;
  for (const word of before) if (after.has(word)) kept++;
  return kept / before.size;
}

/** Violação quando a proposta deixou de ser reconhecível como o original. */
export function checkIdeaPreservation(
  original: string,
  enhanced: string,
  minimum: number,
): string | null {
  const kept = ideaWordPreservation(original, enhanced);
  return kept < minimum
    ? `A versão se afastou demais do original (${Math.round(kept * 100)}% das palavras-chave mantidas; mínimo ${Math.round(minimum * 100)}%). A melhoria deve ser um upgrade, não outro texto.`
    : null;
}

/** Deterministic guard for one text field, including its length limit. */
export function checkIdeaTextField(
  original: string,
  enhanced: string,
  maxLength: number,
  minPreservation: number = IDEA_AI.minTextPreservation,
): IdeaAiGuard {
  const guard = checkIdeaEssence(original, enhanced);
  const violations = [...guard.violations];
  const drift = checkIdeaPreservation(original, enhanced, minPreservation);
  if (drift) violations.push(drift);
  const length = enhanced.trim().length;
  if (!length || length > maxLength)
    violations.push(`O texto deve ter entre 1 e ${maxLength} caracteres.`);
  return { approved: !violations.length, violations: [...new Set(violations)] };
}

/**
 * Merges per-field checks with the judge. The judge sees both fields at once,
 * so its rejection applies to every field it evaluated.
 */
export function combineIdeaTextGuard(
  title: IdeaAiGuard,
  description: IdeaAiGuard,
  judged: IdeaAiGuard,
): IdeaAiTextGuard {
  const apply = (field: IdeaAiGuard): IdeaAiGuard =>
    field.approved && !judged.approved
      ? { approved: false, violations: judged.violations }
      : field;
  const fields = { title: apply(title), description: apply(description) };
  const label = (name: string, field: IdeaAiGuard) =>
    field.violations.map((v) => `${name}: ${v}`);
  return {
    approved: fields.title.approved && fields.description.approved,
    violations: [
      ...new Set([
        ...label(IDEA_AI_TEXT_FIELD_LABELS.title, fields.title),
        ...label(IDEA_AI_TEXT_FIELD_LABELS.description, fields.description),
      ]),
    ],
    fields,
  };
}

/** Whitespace-insensitive: reflowing a paragraph is not an edit. */
export function isIdeaTextEdited(base: string, final: string): boolean {
  const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
  return normalize(base) !== normalize(final);
}

/** Vídeo (upload ou link) nunca passa pela melhoria por IA. */
export function isIdeaAiVideo(media: { mediaType: MediaType }): boolean {
  return media.mediaType === MediaType.VIDEO;
}
