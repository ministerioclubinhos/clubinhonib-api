import { Test } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { IdeasSectionAiRepository } from '../repositories/ideas-section-ai.repository';
import { CreateIdeaSnapshotService } from './create-idea-snapshot.service';
import { UpdateIdeaAiPublicationService } from './update-idea-ai-publication.service';
import { attempt, section, snapshot, source } from '../testing/fixtures';
import {
  IdeaAiDecision,
  IdeaAiEnhancementStatus,
  IdeaAiMediaStatus,
} from '../enums/ideas-section-ai.enums';
import { UpdateIdeasSectionDto } from '../../ideas-section/dto/update-ideas-section.dto';
describe('publication choices', () => {
  const manager = {} as EntityManager;
  const repo = {
    lockSection: jest.fn(),
    attempts: jest.fn(),
    mediaResults: jest.fn(),
    cancel: jest.fn(),
    replaceChoices: jest.fn(),
    saveAttempt: jest.fn(),
    saveMediaResult: jest.fn(),
  };
  const media = {
    findMediaItemsByTargetInTransaction: jest.fn(),
    saveMediaItemInTransaction: jest.fn(),
  };
  let service: UpdateIdeaAiPublicationService;
  const input = (): UpdateIdeasSectionDto => ({
    title: 'edited',
    description: 'edited',
    public: true,
    medias: [],
    aiDecisions: {
      enhancementId: attempt.id,
      title: IdeaAiDecision.ENHANCED,
      description: IdeaAiDecision.ORIGINAL,
      medias: [{ sourceMediaId: source.id, decision: IdeaAiDecision.ENHANCED }],
    },
  });
  beforeEach(async () => {
    jest.clearAllMocks();
    repo.lockSection.mockResolvedValue({ ...section });
    repo.attempts.mockResolvedValue([
      {
        ...attempt,
        status: IdeaAiEnhancementStatus.COMPLETED,
        currentResultSectionId: section.id,
        enhancedTitle: 'Gincana melhorada',
      },
    ]);
    repo.mediaResults.mockResolvedValue([
      {
        id: 'result',
        enhancementId: attempt.id,
        sourceMediaId: source.id,
        status: IdeaAiMediaStatus.ENHANCED,
        enhancedMedia: {
          ...source,
          id: 'improved',
          url: 'https://bucket/improved.pdf',
        },
      },
    ]);
    media.findMediaItemsByTargetInTransaction.mockResolvedValue([
      { ...source, id: 'projection' },
    ]);
    media.saveMediaItemInTransaction.mockImplementation(
      (_m: EntityManager, data: object) => ({ ...data, id: 'new-projection' }),
    );
    const module = await Test.createTestingModule({
      providers: [
        UpdateIdeaAiPublicationService,
        { provide: IdeasSectionAiRepository, useValue: repo },
        { provide: MediaItemProcessor, useValue: media },
        {
          provide: CreateIdeaSnapshotService,
          useValue: { capture: jest.fn().mockResolvedValue(snapshot) },
        },
      ],
    }).compile();
    service = module.get(UpdateIdeaAiPublicationService);
  });
  it('blocks publication while active', async () => {
    repo.attempts.mockResolvedValue([attempt]);
    await expect(
      service.prepare(section.id, input(), manager, true),
    ).rejects.toMatchObject({ status: 409 });
    expect(repo.cancel).not.toHaveBeenCalled();
  });
  it('explicit original publication cancels the lease and uses immutable source content', async () => {
    repo.attempts.mockResolvedValue([attempt]);
    const prepared = await service.prepare(
      section.id,
      { ...input(), ignoreAiEnhancement: true },
      manager,
      true,
    );
    expect(repo.cancel).toHaveBeenCalledWith(section.id, manager);
    expect(prepared.dto).toMatchObject({
      title: snapshot.submittedTitle,
      description: snapshot.submittedDescription,
      medias: [expect.objectContaining({ url: source.url })],
    });
  });
  it('projects mixed choices, preserving source and binding choices to the attempt', async () => {
    const original = JSON.stringify(snapshot);
    const prepared = await service.prepare(section.id, input(), manager, true);
    expect(prepared.dto.title).toBe('Gincana melhorada');
    expect(prepared.dto.description).toBe(snapshot.submittedDescription);
    expect(prepared.dto.medias[0].url).toBe('https://bucket/improved.pdf');
    expect(repo.replaceChoices).toHaveBeenCalledWith(
      section.id,
      expect.arrayContaining([
        expect.objectContaining({
          enhancementId: attempt.id,
          choiceKey: 'TITLE',
        }),
      ]),
      manager,
    );
    expect(JSON.stringify(snapshot)).toBe(original);
    expect(media.saveMediaItemInTransaction).toHaveBeenCalledWith(
      manager,
      expect.not.objectContaining({ id: source.id }),
    );
  });
  it('rejects choices referring to another attempt or another idea media', async () => {
    const wrong = input();
    wrong.aiDecisions!.enhancementId = 'old';
    await expect(
      service.prepare(section.id, wrong, manager, true),
    ).rejects.toMatchObject({ status: 409 });
    const foreign = input();
    foreign.aiDecisions!.medias[0].sourceMediaId = 'foreign';
    await expect(
      service.prepare(section.id, foreign, manager, true),
    ).rejects.toMatchObject({ status: 422 });
  });
});
