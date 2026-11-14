import { GUARDS_METADATA, HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/core/auth/guards/role-guard';
import { IdeasSectionAiController } from './ideas-section-ai.controller';
import { CreateIdeaAiEnhancementService } from './services/create-idea-ai-enhancement.service';
import {
  IdeaAiEnhancementStatus,
  IdeaAiScope,
} from './enums/ideas-section-ai.enums';
import { UpdateIdeaAiEnhancementService } from './services/update-idea-ai-enhancement.service';

describe('manual idea enhancement transport', () => {
  it('requires authentication and admin role and responds 202', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, IdeasSectionAiController),
    ).toEqual([JwtAuthGuard, AdminRoleGuard]);
    const handler: unknown = Object.getOwnPropertyDescriptor(
      IdeasSectionAiController.prototype,
      'create',
    )?.value;
    if (typeof handler !== 'function') throw new Error('Missing route handler');
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(202);
  });
  it('delegates without applying the automatic-submission flag', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'attempt',
      attempt: 1,
      status: IdeaAiEnhancementStatus.PENDING,
    });
    const controller = new IdeasSectionAiController(
      { create } as unknown as CreateIdeaAiEnhancementService,
      {} as UpdateIdeaAiEnhancementService,
    );
    const body = { scope: IdeaAiScope.TEXT, instructions: 'Mais curto' };
    await expect(controller.create('section', body)).resolves.toMatchObject({
      status: IdeaAiEnhancementStatus.PENDING,
    });
    expect(create).toHaveBeenCalledWith('section', body);
  });
  it('cancels and restores through the update service with 204', async () => {
    const update = {
      cancel: jest.fn().mockResolvedValue(undefined),
      restore: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new IdeasSectionAiController(
      {} as CreateIdeaAiEnhancementService,
      update as unknown as UpdateIdeaAiEnhancementService,
    );
    await controller.cancel('section');
    await controller.restore('section', 'attempt');
    expect(update.cancel).toHaveBeenCalledWith('section');
    expect(update.restore).toHaveBeenCalledWith('section', 'attempt');
    for (const name of ['cancel', 'restore']) {
      const handler: unknown = Object.getOwnPropertyDescriptor(
        IdeasSectionAiController.prototype,
        name,
      )?.value;
      if (typeof handler !== 'function') throw new Error('Missing handler');
      expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(204);
    }
  });
});
