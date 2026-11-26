import { CommentEntity } from './entities/comment.entity';
import { CommentResponseDto } from './dto/comment-response.dto';

/** Carimbo de data em ISO, venha ele como `Date` ou já como texto. */
function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

/** Contrato de resposta de `/comments`. */
export function toCommentResponse(comment: CommentEntity): CommentResponseDto {
  return {
    id: comment.id,
    name: comment.name,
    comment: comment.comment,
    clubinho: comment.clubinho,
    neighborhood: comment.neighborhood,
    published: Boolean(comment.published),
    createdAt: toIsoString(comment.createdAt),
    updatedAt: toIsoString(comment.updatedAt),
  };
}
