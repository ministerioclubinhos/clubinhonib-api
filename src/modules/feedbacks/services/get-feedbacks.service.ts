import { Injectable } from '@nestjs/common';

import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { Paginated } from 'src/shared/dto/paginated.dto';

import { SiteFeedbacksRepository } from '../repositories/site-feedbacks.repository';
import { QueryFeedbacksDto } from '../dto/query-feedbacks.dto';
import { SiteFeedbackResponseDto } from '../dto/site-feedback-response.dto';
import { SiteFeedbackEntity } from '../entities/site-feedback.entity';
import { toSiteFeedbackResponse } from '../mappers';
import { FEEDBACKS_DEFAULT_LIMIT, FEEDBACKS_DEFAULT_PAGE } from '../constants';

@Injectable()
export class GetFeedbacksService {
  constructor(private readonly feedbacksRepository: SiteFeedbacksRepository) {}

  async findEntityOrFail(id: string): Promise<SiteFeedbackEntity> {
    const feedback = await this.feedbacksRepository.findById(id);

    if (!feedback) {
      throw new AppNotFoundException(
        ErrorCode.FEEDBACK_NOT_FOUND,
        'Avaliação não encontrada',
      );
    }

    return feedback;
  }

  async findAllPaginated(
    query: QueryFeedbacksDto,
  ): Promise<Paginated<SiteFeedbackResponseDto>> {
    const page = query.page ?? FEEDBACKS_DEFAULT_PAGE;
    const limit = query.limit ?? FEEDBACKS_DEFAULT_LIMIT;

    const { items, total } =
      await this.feedbacksRepository.findAllPaginated(query);

    return new Paginated(items.map(toSiteFeedbackResponse), total, page, limit);
  }

  async findOne(id: string): Promise<SiteFeedbackResponseDto> {
    return toSiteFeedbackResponse(await this.findEntityOrFail(id));
  }

  /** Quantas avaliações aguardam leitura, para o aviso do painel. */
  async countUnread(): Promise<{ unread: number }> {
    return { unread: await this.feedbacksRepository.countUnread() };
  }
}
