import { Injectable, Logger } from '@nestjs/common';
import { UserRepository } from '../user.repository';
import { TeacherProfilesService } from 'src/modules/teacher-profiles/services/teacher-profiles.service';
import { CoordinatorProfilesService } from 'src/modules/coordinator-profiles/services/coordinator-profiles.service';

@Injectable()
export class DeleteUserService {
  private readonly logger = new Logger(DeleteUserService.name);

  constructor(
    private readonly userRepo: UserRepository,
    private readonly teacherService: TeacherProfilesService,
    private readonly coordinatorService: CoordinatorProfilesService,
  ) {}

  async remove(id: string): Promise<{ message: string }> {
    this.logger.debug(`Removing user ID: ${id}`);
    await this.teacherService.removeByUserId(id);
    await this.coordinatorService.removeByUserId(id);
    await this.userRepo.delete(id);
    this.logger.log(`User removed: ${id}`);
    return { message: 'UserEntity deleted' };
  }
}
