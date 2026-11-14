import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { LESSON_CONTENT_LIMITS } from '../constants/lesson-workflow.constants';
import { LessonStageType } from '../enums/lesson.enums';

function hasSafeAstDepth(node: unknown, depth = 0): boolean {
  if (depth > LESSON_CONTENT_LIMITS.MAX_TIPTAP_AST_DEPTH) return false;
  if (!node || typeof node !== 'object') return true;
  if (Array.isArray(node)) {
    return node.every((item) => hasSafeAstDepth(item, depth + 1));
  }
  const record = node as Record<string, unknown>;
  if ('content' in record && record.content !== undefined) {
    if (!Array.isArray(record.content)) return false;
    return record.content.every(
      (child) =>
        Boolean(child) &&
        typeof child === 'object' &&
        !Array.isArray(child) &&
        typeof (child as Record<string, unknown>).type === 'string' &&
        hasSafeAstDepth(child, depth + 1),
    );
  }
  return true;
}

function hasSafeJsonDepth(
  value: unknown,
  maxDepth: number,
  depth = 0,
): boolean {
  if (depth > maxDepth) return false;
  if (!value || typeof value !== 'object') return true;
  const children = Array.isArray(value)
    ? (value as unknown[])
    : Object.values(value as Record<string, unknown>);
  return children.every((child) =>
    hasSafeJsonDepth(child, maxDepth, depth + 1),
  );
}

/** Serialized size in bytes, or `null` when the value is not serializable. */
function serializedBytes(value: unknown): number | null {
  try {
    const serialized = JSON.stringify(value);
    return serialized ? Buffer.byteLength(serialized, 'utf8') : null;
  } catch {
    return null;
  }
}

@ValidatorConstraint({ name: 'tiptapAstDocument', async: false })
export class TiptapAstDocumentValidator
  implements ValidatorConstraintInterface
{
  validate(value: unknown): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }
    const doc = value as Record<string, unknown>;
    if (doc.type !== 'doc' || !Array.isArray(doc.content)) {
      return false;
    }
    const bytes = serializedBytes(doc);
    if (bytes === null || bytes > LESSON_CONTENT_LIMITS.MAX_TIPTAP_AST_BYTES) {
      return false;
    }
    return hasSafeAstDepth(doc, 0);
  }

  defaultMessage(): string {
    return 'O documento Tiptap deve possuir raiz { type: "doc", content: [...] } válida e respeitar os limites de profundidade e tamanho.';
  }
}

@ValidatorConstraint({ name: 'lessonStructuredData', async: false })
export class LessonStructuredDataValidator
  implements ValidatorConstraintInterface
{
  validate(value: unknown): boolean {
    if (value === undefined || value === null) return true;
    if (typeof value !== 'object' || Array.isArray(value)) return false;
    const bytes = serializedBytes(value);
    if (
      bytes === null ||
      bytes > LESSON_CONTENT_LIMITS.MAX_STRUCTURED_DATA_BYTES
    ) {
      return false;
    }
    return hasSafeJsonDepth(
      value,
      LESSON_CONTENT_LIMITS.MAX_STRUCTURED_DATA_DEPTH,
    );
  }

  defaultMessage(): string {
    return 'Os dados estruturados da etapa excedem os limites de tamanho ou profundidade.';
  }
}

export class SaveTiptapContentDto {
  @IsObject()
  @Validate(TiptapAstDocumentValidator)
  tiptapAstJson: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  @Validate(LessonStructuredDataValidator)
  structuredDataJson?: Record<string, unknown>;

  @IsEnum(LessonStageType)
  stage: LessonStageType;

  @IsInt()
  @Min(1)
  lockVersion: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(255)
  changeSummary?: string;
}
