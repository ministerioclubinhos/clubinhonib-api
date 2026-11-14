import { SiteFeedbackEntity } from './entities/site-feedback.entity';
import { SiteFeedbackResponseDto } from './dto/site-feedback-response.dto';

/** Carimbo de data em ISO, venha ele como `Date` ou já como texto. */
function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

/** Contrato de resposta de `/site-feedbacks`. */
export function toSiteFeedbackResponse(
  feedback: SiteFeedbackEntity,
): SiteFeedbackResponseDto {
  return {
    id: feedback.id,
    name: feedback.name,
    email: feedback.email ?? null,
    rating: feedback.rating,
    comment: feedback.comment,
    category: feedback.category,
    read: feedback.read,
    createdAt: toIsoString(feedback.createdAt),
    updatedAt: toIsoString(feedback.updatedAt),
  };
}
