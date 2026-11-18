import { FeedbackCategory } from '../entities/feedback-category.enum';

/** Contrato de resposta de `/site-feedbacks`. */
export class SiteFeedbackResponseDto {
  id: string;
  name: string;
  /** E-mail de quem avaliou; `null` nas avaliações antigas, sem autor. */
  email: string | null;
  rating: number;
  comment: string;
  category: FeedbackCategory;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}
