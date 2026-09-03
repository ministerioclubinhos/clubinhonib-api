import { Injectable, Logger } from '@nestjs/common';

import { NotificationService } from 'src/shared/providers/notification/notification.service';
import { GetUsersService } from 'src/core/user/services/get-user.service';

import { SiteFeedbacksRepository } from '../repositories/site-feedbacks.repository';
import { CreateSiteFeedbackDto } from '../dto/create-site-feedback.dto';
import { SiteFeedbackResponseDto } from '../dto/site-feedback-response.dto';
import { toSiteFeedbackResponse } from '../mappers';

@Injectable()
export class CreateFeedbackService {
  private readonly logger = new Logger(CreateFeedbackService.name);

  constructor(
    private readonly feedbacksRepository: SiteFeedbacksRepository,
    private readonly notificationService: NotificationService,
    private readonly getUsersService: GetUsersService,
  ) {}

  /**
   * Grava a avaliação assinada por quem está autenticado.
   *
   * Nome e e-mail vêm do perfil, nunca do corpo: aceitá-los na requisição
   * deixaria qualquer pessoa avaliar com a identidade de outra.
   */
  async create(
    dto: CreateSiteFeedbackDto,
    userId: string,
  ): Promise<SiteFeedbackResponseDto> {
    const author = await this.getUsersService.findOne(userId);

    const feedback = await this.feedbacksRepository.createOne({
      ...dto,
      name: author.name,
      // É por este endereço que a equipe responde a avaliação.
      email: author.email,
    });

    this.logger.log(`Avaliação do site criada. ID=${feedback.id}`);

    // O aviso aos administradores nunca derruba o envio: a avaliação já está
    // salva e continua visível no painel.
    await this.notificationService.notifyNewSiteFeedback(feedback);

    return toSiteFeedbackResponse(feedback);
  }
}
