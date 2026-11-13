import { Test } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import { GetAiProviderSettingsService } from 'src/modules/ai-lessons/services/get-ai-provider-settings.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { AiQueueException } from 'src/shared/providers/ai-queue/ai-queue.exception';
import { AiQueueFailure } from 'src/shared/providers/ai-queue/enums';
import {
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { IdeasSectionAiRepository } from '../repositories/ideas-section-ai.repository';
import { ProcessIdeaAiEnhancementService } from './process-idea-ai-enhancement.service';
import { EnhanceIdeaTextService } from './enhance-idea-text.service';
import { EnhanceIdeaDocumentService } from './enhance-idea-document.service';
import { EnhanceIdeaImageService } from './enhance-idea-image.service';
import {
  attempt,
  section,
  snapshot,
  settings,
  source,
} from '../testing/fixtures';
import {
  IdeaAiEnhancementStatus,
  IdeaAiErrorCode,
  IdeaAiMediaKind,
  IdeaAiMediaStatus,
  IdeaAiScope,
  IdeaAiSkipReason,
} from '../enums/ideas-section-ai.enums';
import { IdeasSectionAiEnhancementEntity } from '../entities/ideas-section-ai-enhancement.entity';

const image = {
  ...source,
  id: 'image',
  mediaType: MediaType.IMAGE,
  url: 'https://bucket/photo.png',
};
const twoMedia = {
  ...snapshot,
  medias: [
    snapshot.medias[0],
    {
      sourceMediaId: image.id,
      sourceMedia: image,
      url: image.url,
      position: 1,
    },
  ],
};
const base = Object.assign(new IdeasSectionAiEnhancementEntity(), {
  ...attempt,
  id: 'base',
  attempt: 1,
  status: IdeaAiEnhancementStatus.COMPLETED,
  enhancedTitle: 'Título da base',
  enhancedDescription: 'Descrição da base',
  textGuard: { approved: true, violations: [] },
});
const baseResult = (sourceMediaId: string, kind: IdeaAiMediaKind) => ({
  id: `base-${sourceMediaId}`,
  enhancementId: base.id,
  sourceMediaId,
  kind,
  status: IdeaAiMediaStatus.ENHANCED,
  skipReason: null,
  enhancedMediaId: `enhanced-${sourceMediaId}`,
  editableMediaId: null,
  guard: { approved: true, violations: [] },
});
const partial = (
  overrides: Partial<IdeasSectionAiEnhancementEntity>,
): IdeasSectionAiEnhancementEntity =>
  Object.assign(new IdeasSectionAiEnhancementEntity(), {
    ...attempt,
    id: 'partial',
    attempt: 2,
    baseEnhancementId: base.id,
    ...overrides,
  });

describe('targeted idea regeneration', () => {
  const manager = {} as EntityManager;
  const repo = {
    transaction: jest.fn(),
    snapshot: jest.fn(),
    renew: jest.fn(),
    lockSection: jest.fn(),
    owned: jest.fn(),
    saveMediaResult: jest.fn(),
    clearCurrent: jest.fn(),
    saveAttempt: jest.fn(),
    findAttempt: jest.fn(),
    mediaResults: jest.fn(),
  };
  const text = { enhance: jest.fn() };
  const documents = { enhance: jest.fn() };
  const images = { enhance: jest.fn() };
  const media = {
    saveMediaItemInTransaction: jest.fn(),
    discardUnreferencedUploads: jest.fn(),
  };
  const s3 = { upload: jest.fn(), delete: jest.fn() };
  let service: ProcessIdeaAiEnhancementService;

  beforeEach(async () => {
    jest.resetAllMocks();
    repo.transaction.mockImplementation(
      (run: (m: EntityManager) => Promise<unknown>) => run(manager),
    );
    repo.snapshot.mockResolvedValue(twoMedia);
    repo.renew.mockResolvedValue(true);
    repo.lockSection.mockResolvedValue(section);
    repo.owned.mockResolvedValue(attempt);
    repo.findAttempt.mockResolvedValue(base);
    repo.mediaResults.mockResolvedValue([
      baseResult(source.id, IdeaAiMediaKind.DOCUMENT),
      baseResult(image.id, IdeaAiMediaKind.IMAGE),
    ]);
    text.enhance.mockResolvedValue({
      title: 'Novo título',
      description: 'Nova descrição',
      guard: { approved: true, violations: [] },
    });
    images.enhance.mockResolvedValue({
      sourceMediaId: image.id,
      status: IdeaAiMediaStatus.ENHANCED,
      artifact: {
        buffer: Buffer.from('PNG'),
        name: 'new.png',
        mimeType: 'image/png',
      },
    });
    media.saveMediaItemInTransaction.mockResolvedValue({ id: 'new-image' });
    s3.upload.mockResolvedValue('https://bucket/new.png');
    const module = await Test.createTestingModule({
      providers: [
        ProcessIdeaAiEnhancementService,
        { provide: IdeasSectionAiRepository, useValue: repo },
        {
          provide: GetAiProviderSettingsService,
          useValue: {
            getInternalSettings: jest
              .fn()
              .mockImplementation(() => structuredClone(settings)),
          },
        },
        { provide: EnhanceIdeaTextService, useValue: text },
        { provide: EnhanceIdeaDocumentService, useValue: documents },
        { provide: EnhanceIdeaImageService, useValue: images },
        { provide: MediaItemProcessor, useValue: media },
        { provide: AwsS3Service, useValue: s3 },
      ],
    }).compile();
    service = module.get(ProcessIdeaAiEnhancementService);
  });

  it('text scope calls only the text model and carries every media over', async () => {
    await service.process(
      partial({
        scope: IdeaAiScope.TEXT,
        includeText: true,
        targetMediaIds: [],
        instructions: 'Mais curto',
      }),
      'owner',
    );
    expect(text.enhance).toHaveBeenCalledWith(
      expect.anything(),
      snapshot.submittedTitle,
      snapshot.submittedDescription,
      'Mais curto',
    );
    expect(documents.enhance).not.toHaveBeenCalled();
    expect(images.enhance).not.toHaveBeenCalled();
    expect(repo.saveMediaResult).toHaveBeenCalledTimes(2);
    expect(repo.saveMediaResult).toHaveBeenCalledWith(
      expect.objectContaining({
        enhancementId: 'partial',
        sourceMediaId: image.id,
        enhancedMediaId: `enhanced-${image.id}`,
        carriedOver: true,
      }),
      manager,
    );
    expect(repo.saveAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        status: IdeaAiEnhancementStatus.COMPLETED,
        enhancedTitle: 'Novo título',
        currentResultSectionId: section.id,
      }),
      manager,
    );
  });

  it('media scope redoes only the chosen media and keeps the base text', async () => {
    await service.process(
      partial({
        scope: IdeaAiScope.MEDIA,
        includeText: false,
        targetMediaIds: [image.id],
      }),
      'owner',
    );
    expect(text.enhance).not.toHaveBeenCalled();
    expect(documents.enhance).not.toHaveBeenCalled();
    expect(images.enhance).toHaveBeenCalledTimes(1);
    expect(repo.renew).toHaveBeenCalledWith('partial', 'owner', {
      done: 1,
      total: 1,
    });
    expect(repo.saveMediaResult).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceMediaId: image.id,
        enhancedMediaId: 'new-image',
        carriedOver: false,
      }),
      manager,
    );
    expect(repo.saveMediaResult).toHaveBeenCalledWith(
      expect.objectContaining({ sourceMediaId: source.id, carriedOver: true }),
      manager,
    );
    expect(repo.saveAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        enhancedTitle: 'Título da base',
        enhancedDescription: 'Descrição da base',
        textGuard: base.textGuard,
      }),
      manager,
    );
  });

  it('a redone item that fails keeps the base version, flagged with the new error', async () => {
    images.enhance.mockResolvedValue({
      sourceMediaId: image.id,
      status: IdeaAiMediaStatus.REJECTED_BY_GUARD,
      guard: { approved: false, violations: ['x'] },
    });
    await service.process(
      partial({
        scope: IdeaAiScope.FAILED,
        includeText: true,
        targetMediaIds: [image.id],
      }),
      'owner',
    );
    expect(repo.saveMediaResult).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceMediaId: image.id,
        status: IdeaAiMediaStatus.ENHANCED,
        enhancedMediaId: `enhanced-${image.id}`,
        carriedOver: true,
        errorCode: IdeaAiErrorCode.GUARD_REJECTED,
      }),
      manager,
    );
    expect(repo.saveAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ status: IdeaAiEnhancementStatus.PARTIAL }),
      manager,
    );
  });

  it('a partial attempt with no success does not replace the current result', async () => {
    images.enhance.mockRejectedValue(new Error('provider'));
    await service.process(
      partial({
        scope: IdeaAiScope.MEDIA,
        includeText: false,
        targetMediaIds: [image.id],
      }),
      'owner',
    );
    expect(repo.clearCurrent).not.toHaveBeenCalled();
    expect(repo.saveMediaResult).toHaveBeenCalledTimes(1);
    expect(repo.saveMediaResult).toHaveBeenCalledWith(
      expect.objectContaining({
        status: IdeaAiMediaStatus.FAILED,
        errorCode: IdeaAiErrorCode.PROVIDER_REQUEST_FAILED,
        carriedOver: false,
      }),
      manager,
    );
    expect(repo.saveAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        status: IdeaAiEnhancementStatus.FAILED,
        currentResultSectionId: null,
        errorCode: IdeaAiErrorCode.PROVIDER_REQUEST_FAILED,
      }),
      manager,
    );
  });

  it('keeps a good base title when only the new title is rejected', async () => {
    text.enhance.mockResolvedValue({
      title: null,
      description: 'Nova descrição',
      guard: { approved: false, violations: ['Título: x'] },
    });
    await service.process(
      partial({ scope: IdeaAiScope.TEXT, targetMediaIds: [] }),
      'owner',
    );
    expect(repo.saveAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        enhancedTitle: 'Título da base',
        enhancedDescription: 'Nova descrição',
        status: IdeaAiEnhancementStatus.PARTIAL,
      }),
      manager,
    );
  });

  it('aborts the whole attempt on a queue outage with an uncounted code', async () => {
    text.enhance.mockRejectedValue(
      new AiQueueException(AiQueueFailure.UNAVAILABLE),
    );
    await service.process(
      Object.assign(new IdeasSectionAiEnhancementEntity(), attempt),
      'owner',
    );
    expect(documents.enhance).not.toHaveBeenCalled();
    expect(repo.saveAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        status: IdeaAiEnhancementStatus.FAILED,
        errorCode: IdeaAiErrorCode.QUEUE_UNAVAILABLE,
        activeSectionId: null,
      }),
      manager,
    );
  });

  it('closes an attempt whose snapshot disappeared instead of looping', async () => {
    repo.snapshot.mockResolvedValue(null);
    await service.process(attempt, 'owner');
    expect(repo.saveAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        status: IdeaAiEnhancementStatus.FAILED,
        errorCode: IdeaAiErrorCode.SNAPSHOT_MISSING,
      }),
      manager,
    );
  });

  it('records the provider response code on a failed media', async () => {
    images.enhance.mockRejectedValue(
      new Error(IdeaAiErrorCode.INVALID_PROVIDER_RESPONSE),
    );
    documents.enhance.mockResolvedValue({
      sourceMediaId: source.id,
      status: IdeaAiMediaStatus.SKIPPED,
    });
    repo.mediaResults.mockResolvedValue([]);
    await service.process(
      Object.assign(new IdeasSectionAiEnhancementEntity(), attempt),
      'owner',
    );
    expect(repo.saveMediaResult).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceMediaId: image.id,
        status: IdeaAiMediaStatus.FAILED,
        errorCode: IdeaAiErrorCode.INVALID_PROVIDER_RESPONSE,
      }),
      manager,
    );
  });

  it('fails without calling the model when the stored provider is unknown', async () => {
    await service.process(
      Object.assign(new IdeasSectionAiEnhancementEntity(), {
        ...attempt,
        provider: 'other',
      }),
      'owner',
    );
    expect(text.enhance).not.toHaveBeenCalled();
    expect(repo.saveAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: IdeaAiErrorCode.PROVIDER_NOT_CONFIGURED,
      }),
      manager,
    );
  });

  it('skips uploaded and linked videos without the provider or progress', async () => {
    const uploaded = {
      ...source,
      id: 'video-upload',
      mediaType: MediaType.VIDEO,
      url: 'https://bucket/aula.mp4',
      isLocalFile: true,
    };
    const linked = {
      ...source,
      id: 'video-link',
      mediaType: MediaType.VIDEO,
      uploadType: UploadType.LINK,
      url: 'https://www.youtube.com/watch?v=abc123def45',
      isLocalFile: false,
    };
    repo.snapshot.mockResolvedValue({
      ...snapshot,
      medias: [
        {
          sourceMediaId: uploaded.id,
          sourceMedia: uploaded,
          url: uploaded.url,
          position: 0,
        },
        {
          sourceMediaId: linked.id,
          sourceMedia: linked,
          url: linked.url,
          position: 1,
        },
      ],
    });
    repo.mediaResults.mockResolvedValue([]);
    await service.process(
      Object.assign(new IdeasSectionAiEnhancementEntity(), attempt),
      'owner',
    );
    expect(images.enhance).not.toHaveBeenCalled();
    expect(documents.enhance).not.toHaveBeenCalled();
    expect(s3.upload).not.toHaveBeenCalled();
    // Só o texto conta no progresso.
    expect(repo.renew).toHaveBeenCalledWith(attempt.id, 'owner', {
      done: 0,
      total: 1,
    });
    for (const id of [uploaded.id, linked.id])
      expect(repo.saveMediaResult).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceMediaId: id,
          kind: IdeaAiMediaKind.VIDEO,
          status: IdeaAiMediaStatus.SKIPPED,
          skipReason: IdeaAiSkipReason.NOT_SUPPORTED,
          enhancedMediaId: null,
        }),
        manager,
      );
    // Vídeo pulado não impede o resultado completo.
    expect(repo.saveAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ status: IdeaAiEnhancementStatus.COMPLETED }),
      manager,
    );
  });
});
