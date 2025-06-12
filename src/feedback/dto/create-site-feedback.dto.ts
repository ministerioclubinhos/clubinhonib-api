import { IsString, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { FeedbackCategory } from '../entity/feedback-category.enum';

export class CreateSiteFeedbackDto {
  @IsString({ message: 'name deve ser uma string' })
  name: string;

  @IsString({ message: 'email deve ser uma string' })
  @IsOptional()
  email?: string;

  @IsNumber({}, { message: 'rating deve ser um number' })
  rating: number;

  @IsString({ message: 'comment deve ser uma string' })
  comment: string;

  @IsEnum(FeedbackCategory, { message: 'category inválida' })
  category: FeedbackCategory;
}
