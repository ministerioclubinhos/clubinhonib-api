import { IsString, IsInt, IsEnum, Max, Min } from 'class-validator';
import { FeedbackCategory } from '../entities/feedback-category.enum';
import { FEEDBACK_MAX_RATING } from '../constants';

/**
 * Corpo aceito por `POST /site-feedbacks`.
 *
 * Nome e e-mail não vêm daqui: a rota exige autenticação, então os dois são
 * lidos do perfil de quem está enviando. Aceitá-los no corpo deixaria qualquer
 * pessoa assinar a avaliação com a identidade de outra.
 */
export class CreateSiteFeedbackDto {
  @IsInt({ message: 'rating deve ser um número inteiro' })
  @Min(1, { message: 'rating deve ser no mínimo 1' })
  @Max(FEEDBACK_MAX_RATING, {
    message: `rating deve ser no máximo ${FEEDBACK_MAX_RATING}`,
  })
  rating: number;

  @IsString({ message: 'comment deve ser uma string' })
  comment: string;

  @IsEnum(FeedbackCategory, { message: 'category inválida' })
  category: FeedbackCategory;
}
