import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminLessonPromptEntity } from '../entities/admin-lesson-prompt.entity';
import { LessonCategory, LessonStageType } from '../enums/lesson.enums';

@Injectable()
export class AdminLessonPromptRepository {
  constructor(
    @InjectRepository(AdminLessonPromptEntity)
    private readonly repo: Repository<AdminLessonPromptEntity>,
  ) {}

  async findByAdminId(
    adminId: string,
    category: LessonCategory = LessonCategory.REGULAR,
  ): Promise<AdminLessonPromptEntity[]> {
    return this.repo.find({ where: { adminId, category } });
  }

  async findByAdminIdAndStage(
    adminId: string,
    stage: LessonStageType,
    category: LessonCategory = LessonCategory.REGULAR,
  ): Promise<AdminLessonPromptEntity | null> {
    return this.repo.findOne({ where: { adminId, stage, category } });
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

  async updatePromptWhereVersion(
    id: string,
    expectedLockVersion: number,
    customPrompt: string,
  ): Promise<boolean> {
    const result = await this.repo
      .createQueryBuilder()
      .update(AdminLessonPromptEntity)
      .set({
        customPrompt,
        lockVersion: () => 'lock_version + 1',
      })
      .where('id = :id', { id })
      .andWhere('lock_version = :expectedLockVersion', {
        expectedLockVersion,
      })
      .execute();
    return result.affected === 1;
  }
}
