import { Injectable, Logger } from '@nestjs/common';
import { UserRepository } from '../user.repository';
import { TeacherProfilesService } from 'src/modules/teacher-profiles/services/teacher-profiles.service';
import { CoordinatorProfilesService } from 'src/modules/coordinator-profiles/services/coordinator-profiles.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';

@Injectable()
export class DeleteUserService {
  private readonly logger = new Logger(DeleteUserService.name);

  constructor(
    private readonly userRepo: UserRepository,
    private readonly teacherService: TeacherProfilesService,
    private readonly coordinatorService: CoordinatorProfilesService,
    private readonly mediaItemProcessor: MediaItemProcessor,
    private readonly s3Service: AwsS3Service,
  ) { }

  async remove(id: string): Promise<{ message: string }> {
    const userImage = await this.mediaItemProcessor.findMediaItemByTarget(
      id,
      'UserEntity',
    );

    if (userImage) {
      await this.mediaItemProcessor.removeMediaItem(
        userImage,
        this.s3Service.delete.bind(this.s3Service),
      );
      this.logger.log(`Imagem do usuário deletada: ${userImage.id}`);
    }

    await this.teacherService.removeByUserId(id);
    await this.coordinatorService.removeByUserId(id);
    await this.userRepo.delete(id);
    return { message: 'UserEntity deleted' };
  }
}
