import { GUARDS_METADATA, HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/core/auth/guards/role-guard';
import { IdeasSectionAiController } from './ideas-section-ai.controller';
import { CreateIdeaAiEnhancementService } from './services/create-idea-ai-enhancement.service';
import { IdeaAiEnhancementStatus } from './enums/ideas-section-ai.enums';

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
    const controller = new IdeasSectionAiController({
      create,
    } as unknown as CreateIdeaAiEnhancementService);
    await expect(controller.create('section')).resolves.toMatchObject({
      status: IdeaAiEnhancementStatus.PENDING,
    });
    expect(create).toHaveBeenCalledWith('section');
  });
});
