import { Injectable, Logger } from '@nestjs/common';
import { UserEntity } from '../entities/user.entity';
import { GetUsersQueryDto } from '../dto/get-users-query.dto';
import { UserRepository } from '../user.repository';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { GetProfileBlocksService } from 'src/core/profile/services/profile/get-profile-blocks.service';
import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { MyProfileResponseDto } from '../dto/my-profile-response.dto';
import { PaginatedUsersResponseDto } from '../dto/user-response.dto';
import { toMyProfileResponse, toUserResponse } from '../mappers';
import { EmailRecipient } from 'src/shared/email/types';
import { USER_MEDIA_TARGET } from '../constants';

@Injectable()
export class GetUsersService {
  private readonly logger = new Logger(GetUsersService.name);

  constructor(
    private readonly userRepo: UserRepository,
    private readonly mediaItemProcessor: MediaItemProcessor,
    private readonly getProfileBlocksService: GetProfileBlocksService,
  ) {}

  /** Página da listagem administrativa, já no contrato público. */
  async findAllPaginated(
    q: GetUsersQueryDto,
  ): Promise<PaginatedUsersResponseDto> {
    const { items, page, limit, total, totalPages, sort, order } =
      await this.userRepo.findAllPaginated(q);

    return {
      items: items.map(toUserResponse),
      meta: { page, limit, total, totalPages, sort, order },
    };
  }

  async findAlll(): Promise<UserEntity[]> {
    return this.userRepo.findAll();
  }

  async findOne(id: string): Promise<UserEntity> {
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new AppNotFoundException(
        ErrorCode.USER_NOT_FOUND,
        'Usuário não encontrado',
      );
    }
    return user;
  }

  /**
   * Destinatários dos avisos enviados a toda a base: só usuários já validados.
   * Outros módulos chegam aqui pelo serviço, nunca pelo repositório de usuário.
   */
  async findActiveRecipients(): Promise<EmailRecipient[]> {
    return this.userRepo.findActiveRecipients();
  }

  /**
   * Dos ids informados, quem pode receber um aviso.
   *
   * O módulo que sabe *quem* avisar — o de clubes, para os professores de um
   * clubinho — chega aqui pelo serviço, nunca pelo repositório de usuário, e
   * não precisa conhecer a régua de elegibilidade.
   */
  async findNoticeRecipientsByIds(ids: string[]): Promise<EmailRecipient[]> {
    return this.userRepo.findNoticeRecipientsByIds(ids);
  }

  /**
   * E-mails dos administradores, para quem precisa avisá-los.
   *
   * Existe para o módulo de notificação não alcançar o repositório de usuários
   * por dentro.
   */
  async findAdminEmails(): Promise<string[]> {
    return this.userRepo.findAdminEmails();
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepo.findByEmail(email);
  }

  /**
   * Perfil de quem está logado, no contrato único de `MyProfileResponseDto`.
   */
  async findOneForProfile(id: string): Promise<MyProfileResponseDto> {
    const user = await this.userRepo.findByIdWithProfiles(id);
    if (!user) {
      throw new AppNotFoundException(
        ErrorCode.USER_NOT_FOUND,
        'Usuário não encontrado',
      );
    }

    const [image, blocks] = await Promise.all([
      this.mediaItemProcessor.findMediaItemByTarget(id, USER_MEDIA_TARGET),
      this.getProfileBlocksService.findByUserId(id),
    ]);
    const { personalData, preferences } = blocks;

    return toMyProfileResponse({ user, image, personalData, preferences });
  }
}
