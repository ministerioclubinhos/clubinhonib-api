import { Injectable } from '@nestjs/common';
import { PlayAccessService } from 'src/modules/play/services/play-access.service';
import { PlaySubmissionRepository } from '../repositories/play-submission.repository';
import {
  PlaySubmissionResponseDto,
  PlaySubmissionsPageDto,
} from '../dto/play-submission-response.dto';
import { QueryPlaySubmissionsDto } from '../dto/play-submission.dto';
import { toSubmissionResponse } from '../mappers';
import { PlaySubmissionStatus } from '../enums/play-submission-status.enum';
import {
  PLAY_SUBMISSIONS_DEFAULT_LIMIT,
  PLAY_SUBMISSIONS_DEFAULT_PAGE,
} from '../constants';

@Injectable()
export class GetPlaySubmissionsService {
  constructor(
    private readonly repo: PlaySubmissionRepository,
    private readonly access: PlayAccessService,
  ) {}

  /** "Meus envios": só os do próprio usuário. */
  async findMine(userId: string): Promise<PlaySubmissionResponseDto[]> {
    await this.access.assertSubmissionsEnabled();
    return (await this.repo.findMine(userId)).map((item) =>
      toSubmissionResponse(item),
    );
  }

  /** Fila do administrador, com quem enviou e a contagem por situação. */
  async findPage(
    query: QueryPlaySubmissionsDto,
  ): Promise<PlaySubmissionsPageDto> {
    const page = query.page ?? PLAY_SUBMISSIONS_DEFAULT_PAGE;
    const limit = query.limit ?? PLAY_SUBMISSIONS_DEFAULT_LIMIT;
    const status = query.status ?? PlaySubmissionStatus.PENDING;
    const [{ items, total }, counts] = await Promise.all([
      this.repo.findPage(status, page, limit),
      this.repo.countByStatus(),
    ]);
    return {
      data: items.map((item) => toSubmissionResponse(item, true)),
      total,
      page,
      limit,
      pageCount: Math.ceil(total / limit),
      counts: {
        pending: counts[PlaySubmissionStatus.PENDING],
        approved: counts[PlaySubmissionStatus.APPROVED],
        rejected: counts[PlaySubmissionStatus.REJECTED],
      },
    };
  }
}
