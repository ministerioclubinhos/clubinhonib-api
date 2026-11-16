import { GetIdeasSectionsService } from './get-ideas-sections.service';
import { GetIdeaAiEnhancementService } from '../../ideas-section-ai/services/get-idea-ai-enhancement.service';
import { IdeasSectionsRepository } from '../repositories/ideas-sections.repository';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { IdeaAiQueueFilter } from '../../ideas-section-ai/enums/ideas-section-ai.enums';

const section = {
  id: 'section',
  title: 'T',
  description: 'D',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function build(enabled: boolean) {
  const ai = {
    isEnabled: jest.fn().mockResolvedValue(enabled),
    get: jest.fn().mockResolvedValue({ enabled }),
    summaries: jest.fn().mockResolvedValue(new Map()),
  };
  const repo = {
    findById: jest.fn().mockResolvedValue(section),
    findPendingPaginated: jest
      .fn()
      .mockResolvedValue({ items: [section], total: 1 }),
  };
  const media = {
    findManyMediaItemsByTargets: jest.fn().mockResolvedValue([]),
  };
  const service = new GetIdeasSectionsService(
    ai as unknown as GetIdeaAiEnhancementService,
    repo as unknown as IdeasSectionsRepository,
    media as unknown as MediaItemProcessor,
  );
  return { service, ai, repo };
}

describe('flag idea_ai_enhancement na leitura da administração', () => {
  it('traz a IA quando ligada', async () => {
    const { service, ai } = build(true);
    const result = await service.findOne('section');
    expect(result.aiEnhancement).toEqual({ enabled: true });
    expect(ai.get).toHaveBeenCalledWith('section');
  });

  it('não traz nada de IA na ideia quando desligada', async () => {
    const { service, ai } = build(false);
    const result = await service.findOne('section');
    expect('aiEnhancement' in result).toBe(false);
    expect(ai.get).not.toHaveBeenCalled();
  });

  it('ignora o filtro por IA da fila quando desligada', async () => {
    const { service, repo } = build(false);
    await service.findPendingPaginated({
      aiStatus: IdeaAiQueueFilter.FAILED,
    } as never);
    expect(repo.findPendingPaginated).toHaveBeenCalledWith(
      expect.objectContaining({ aiStatus: undefined }),
    );
  });
});
