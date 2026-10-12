import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminLessonPromptEntity } from '../entities/admin-lesson-prompt.entity';
import { LessonStageType } from '../enums/lesson.enums';

@Injectable()
export class AdminLessonPromptRepository {
  constructor(
    @InjectRepository(AdminLessonPromptEntity)
    private readonly repo: Repository<AdminLessonPromptEntity>,
  ) {}

  async findByAdminId(adminId: string): Promise<AdminLessonPromptEntity[]> {
    return this.repo.find({ where: { adminId } });
  }

  async findByAdminIdAndStage(
    adminId: string,
    stage: LessonStageType,
  ): Promise<AdminLessonPromptEntity | null> {
    return this.repo.findOne({ where: { adminId, stage } });
  }

  createPrompt(
    data: Partial<AdminLessonPromptEntity>,
  ): AdminLessonPromptEntity {
    return this.repo.create(data);
  }

  async savePrompt(
    entity: AdminLessonPromptEntity,
  ): Promise<AdminLessonPromptEntity> {
    return this.repo.save(entity);
  }

  async deletePrompt(adminId: string, stage: LessonStageType): Promise<void> {
    await this.repo.delete({ adminId, stage });
  }
}
