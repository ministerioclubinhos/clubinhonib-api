import { Injectable, Logger } from '@nestjs/common';

import { SiteFeedbacksRepository } from '../repositories/site-feedbacks.repository';
import { UpdateSiteFeedbackDto } from '../dto/update-site-feedback.dto';
import { SiteFeedbackResponseDto } from '../dto/site-feedback-response.dto';
import { toSiteFeedbackResponse } from '../mappers';
import { GetFeedbacksService } from './get-feedbacks.service';

@Injectable()
export class UpdateFeedbackService {
  private readonly logger = new Logger(UpdateFeedbackService.name);

  constructor(
    private readonly feedbacksRepository: SiteFeedbacksRepository,
    private readonly getService: GetFeedbacksService,
  ) {}

  /** Altera apenas os campos presentes no corpo. */
  async update(
    id: string,
    dto: UpdateSiteFeedbackDto,
  ): Promise<SiteFeedbackResponseDto> {
    const feedback = await this.getService.findEntityOrFail(id);

    if (dto.rating !== undefined) feedback.rating = dto.rating;
    if (dto.comment !== undefined) feedback.comment = dto.comment;
    if (dto.category !== undefined) feedback.category = dto.category;

    const saved = await this.feedbacksRepository.save(feedback);
    this.logger.log(`Avaliação do site atualizada. ID=${id}`);

    return toSiteFeedbackResponse(saved);
  }

  /** Marca como lida, ou de volta como não lida. */
  async setRead(id: string, read: boolean): Promise<SiteFeedbackResponseDto> {
    const feedback = await this.getService.findEntityOrFail(id);

    feedback.read = read;
    const saved = await this.feedbacksRepository.save(feedback);

    this.logger.log(
      `Avaliação marcada como ${read ? 'lida' : 'não lida'}. ID=${id}`,
    );

    return toSiteFeedbackResponse(saved);
  }
}
