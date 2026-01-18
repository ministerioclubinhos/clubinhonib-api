import { FeedbackCategory } from "../entity/feedback-category.enum";

export class SiteFeedbackResponseDto {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  email?: string;
  rating: number;
  comment: string;
  category: FeedbackCategory;
  read: boolean;
}
