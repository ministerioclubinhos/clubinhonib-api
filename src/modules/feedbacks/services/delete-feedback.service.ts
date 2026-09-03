import { Injectable, Logger } from '@nestjs/common';

import { SiteFeedbacksRepository } from '../repositories/site-feedbacks.repository';
import { GetFeedbacksService } from './get-feedbacks.service';

@Injectable()
export class DeleteFeedbackService {
  private readonly logger = new Logger(DeleteFeedbackService.name);

  constructor(
    private readonly feedbacksRepository: SiteFeedbacksRepository,
    private readonly getService: GetFeedbacksService,
  ) {}

  async remove(id: string): Promise<{ message: string }> {
    await this.getService.findEntityOrFail(id);
    await this.feedbacksRepository.deleteById(id);

    this.logger.log(`Avaliação do site removida. ID=${id}`);

    return { message: 'Avaliação removida com sucesso' };
  }
}
