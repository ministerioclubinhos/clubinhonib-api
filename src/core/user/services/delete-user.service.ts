import { Injectable, Logger } from '@nestjs/common';
import { UserRepository } from '../user.repository';
import { DeleteTeacherProfilesService } from 'src/modules/teacher-profiles/services/delete-teacher-profiles.service';
import { DeleteCoordinatorProfilesService } from 'src/modules/coordinator-profiles/services/delete-coordinator-profiles.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { USER_MEDIA_TARGET } from '../constants';
import { NotifyAccountChangesService } from './notify-account-changes.service';

@Injectable()
export class DeleteUserService {
  private readonly logger = new Logger(DeleteUserService.name);

  constructor(
    private readonly userRepo: UserRepository,
    private readonly deleteTeacherProfileService: DeleteTeacherProfilesService,
    private readonly deleteCoordinatorProfileService: DeleteCoordinatorProfilesService,
    private readonly mediaItemProcessor: MediaItemProcessor,
    private readonly s3Service: AwsS3Service,
    private readonly notifyAccountChanges: NotifyAccountChangesService,
  ) {}

  async remove(id: string): Promise<{ message: string }> {
    // Lido antes de qualquer coisa: a exclusão é física, e depois dela não há
    // mais endereço nem nome para quem avisar. Um usuário que já não existe
    // segue adiante em silêncio — apagar continua sendo o que foi pedido.
    const user = await this.userRepo.findById(id);

    const userImage = await this.mediaItemProcessor.findMediaItemByTarget(
      id,
      USER_MEDIA_TARGET,
    );

    if (userImage) {
      const deleteFn = (url: string): Promise<void> =>
        this.s3Service.delete(url);
      await this.mediaItemProcessor.removeMediaItem(userImage, deleteFn);
      this.logger.log(`Imagem do usuário deletada: ${userImage.id}`);
    }

    await this.deleteTeacherProfileService.removeByUserId(id);
    await this.deleteCoordinatorProfileService.removeByUserId(id);
    await this.userRepo.delete(id);

    if (user) {
      this.notifyAccountChanges.accountDeletedInBackground(
        user.email,
        user.name,
      );
    }

    return { message: 'Usuário removido com sucesso' };
  }
}
