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
import { LessonStageType } from '../enums/lesson.enums';

const MAX_TIPTAP_AST_BYTES = 1_500_000;
const MAX_TIPTAP_AST_DEPTH = 32;

function hasSafeAstDepth(node: unknown, depth = 0): boolean {
  if (depth > MAX_TIPTAP_AST_DEPTH) return false;
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
    try {
      const serialized = JSON.stringify(doc);
      if (!serialized || serialized.length > MAX_TIPTAP_AST_BYTES) {
        return false;
      }
    } catch {
      return false;
    }
    return hasSafeAstDepth(doc, 0);
  }

  defaultMessage(): string {
    return 'O documento Tiptap deve possuir raiz { type: "doc", content: [...] } válida e respeitar os limites de profundidade e tamanho.';
  }
}

export class SaveTiptapContentDto {
  @IsObject()
  @Validate(TiptapAstDocumentValidator)
  tiptapAstJson: Record<string, unknown>;

  @IsObject()
  @IsOptional()
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
