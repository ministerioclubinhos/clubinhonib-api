import { ConflictException } from '@nestjs/common';
import { AdminLessonPromptEntity } from '../entities/admin-lesson-prompt.entity';
import { LessonStageType } from '../enums/lesson.enums';
import { AdminLessonPromptService } from './admin-lesson-prompt.service';
import { AdminLessonPromptRepository } from '../repositories/admin-lesson-prompt.repository';

describe('AdminLessonPromptService', () => {
  const records: AdminLessonPromptEntity[] = [];
  const repository = {
    findByAdminId: jest.fn((adminId: string) =>
      Promise.resolve(records.filter((item) => item.adminId === adminId)),
    ),
    findByAdminIdAndStage: jest.fn((adminId: string, stage: LessonStageType) =>
      Promise.resolve(
        records.find(
          (item) => item.adminId === adminId && item.stage === stage,
        ) ?? null,
      ),
    ),
    createPrompt: jest.fn((input: Partial<AdminLessonPromptEntity>) =>
      Object.assign(new AdminLessonPromptEntity(), input, {
        id: 'prompt-1',
        lockVersion: 1,
      }),
    ),
    savePrompt: jest.fn((entity: AdminLessonPromptEntity) => {
      const index = records.findIndex((item) => item.id === entity.id);
      if (index >= 0) {
        entity.lockVersion += 1;
        records[index] = entity;
      } else records.push(entity);
      return Promise.resolve(entity);
    }),
    deletePrompt: jest.fn((adminId: string, stage: LessonStageType) => {
      const index = records.findIndex(
        (item) => item.adminId === adminId && item.stage === stage,
      );
      if (index >= 0) records.splice(index, 1);
      return Promise.resolve();
    }),
  } as unknown as AdminLessonPromptRepository;
  const service = new AdminLessonPromptService(repository);

  beforeEach(() => {
    records.splice(0);
    jest.clearAllMocks();
  });

  it('entrega os oito prompts-base para um administrador novo', async () => {
    const result = await service.list('admin-a');
    expect(result).toHaveLength(8);
    expect(
      result.every(
        (item) =>
          item.customPrompt === null &&
          item.effectivePrompt === item.basePrompt,
      ),
    ).toBe(true);
  });

  it('isola a personalização por administrador e etapa', async () => {
    await service.save(
      'admin-a',
      LessonStageType.LESSON,
      'Minha orientação pessoal para a lição.',
    );
    const effective = await service.effective(
      'admin-a',
      LessonStageType.LESSON,
    );
    expect(effective).toContain('Minha orientação pessoal para a lição.');
    expect(effective).toContain('ORDEM OBRIGATÓRIA DO CONTEÚDO');
    expect(
      await service.effective('admin-b', LessonStageType.LESSON),
    ).not.toContain('Minha orientação pessoal para a lição.');
    expect(
      (await service.list('admin-a')).find(
        (item) => item.stage === LessonStageType.LESSON_VISUALS,
      )?.customPrompt,
    ).toBeNull();
  });

  it('rejeita atualização concorrente e restaura o padrão', async () => {
    const saved = await service.save(
      'admin-a',
      LessonStageType.STANDARD_GAME,
      'Prompt personalizado suficientemente longo.',
    );
    await expect(
      service.save(
        'admin-a',
        LessonStageType.STANDARD_GAME,
        'Outra versão suficientemente longa.',
        (saved.lockVersion ?? 1) - 1,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    const reset = await service.reset('admin-a', LessonStageType.STANDARD_GAME);
    expect(reset.customPrompt).toBeNull();
    expect(reset.effectivePrompt).toBe(reset.basePrompt);
    expect(reset.basePrompt).toContain('crianças realmente queiram brincar');
    expect(reset.basePrompt).toContain('5 a 7 anos');
    expect(reset.basePrompt).toContain('8 a 11 anos');
    expect(reset.basePrompt).toContain(
      'espera superior a aproximadamente 30 segundos',
    );
  });
});
