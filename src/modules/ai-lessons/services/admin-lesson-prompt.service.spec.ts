import { ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AdminLessonPromptEntity } from '../entities/admin-lesson-prompt.entity';
import { LessonStageType } from '../enums/lesson.enums';
import { AdminLessonPromptService } from './admin-lesson-prompt.service';

describe('AdminLessonPromptService', () => {
  const records: AdminLessonPromptEntity[] = [];
  const repository = {
    find: jest.fn(async ({ where }: { where: { adminId: string } }) => records.filter((item) => item.adminId === where.adminId)),
    findOne: jest.fn(async ({ where }: { where: { adminId: string; stage: LessonStageType } }) => records.find((item) => item.adminId === where.adminId && item.stage === where.stage) ?? null),
    create: jest.fn((input: Partial<AdminLessonPromptEntity>) => Object.assign(new AdminLessonPromptEntity(), input, { id: 'prompt-1', lockVersion: 1 })),
    save: jest.fn(async (entity: AdminLessonPromptEntity) => { const index = records.findIndex((item) => item.id === entity.id); if (index >= 0) { entity.lockVersion += 1; records[index] = entity; } else records.push(entity); return entity; }),
    delete: jest.fn(async ({ adminId, stage }: { adminId: string; stage: LessonStageType }) => { const index = records.findIndex((item) => item.adminId === adminId && item.stage === stage); if (index >= 0) records.splice(index, 1); return { affected: index >= 0 ? 1 : 0, raw: [] }; }),
  } as unknown as Repository<AdminLessonPromptEntity>;
  const service = new AdminLessonPromptService(repository);

  beforeEach(() => { records.splice(0); jest.clearAllMocks(); });

  it('entrega os oito prompts-base para um administrador novo', async () => {
    const result = await service.list('admin-a');
    expect(result).toHaveLength(8);
    expect(result.every((item) => item.customPrompt === null && item.effectivePrompt === item.basePrompt)).toBe(true);
  });

  it('isola a personalização por administrador e etapa', async () => {
    await service.save('admin-a', LessonStageType.LESSON, 'Minha orientação pessoal para a lição.');
    expect(await service.effective('admin-a', LessonStageType.LESSON)).toBe('Minha orientação pessoal para a lição.');
    expect(await service.effective('admin-b', LessonStageType.LESSON)).not.toBe('Minha orientação pessoal para a lição.');
    expect((await service.list('admin-a')).find((item) => item.stage === LessonStageType.LESSON_VISUALS)?.customPrompt).toBeNull();
  });

  it('rejeita atualização concorrente e restaura o padrão', async () => {
    const saved = await service.save('admin-a', LessonStageType.STANDARD_GAME, 'Prompt personalizado suficientemente longo.');
    await expect(service.save('admin-a', LessonStageType.STANDARD_GAME, 'Outra versão suficientemente longa.', (saved.lockVersion ?? 1) - 1)).rejects.toBeInstanceOf(ConflictException);
    const reset = await service.reset('admin-a', LessonStageType.STANDARD_GAME);
    expect(reset.customPrompt).toBeNull();
    expect(reset.effectivePrompt).toBe(reset.basePrompt);
  });
});
