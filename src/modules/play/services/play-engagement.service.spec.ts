import { Test } from '@nestjs/testing';
import { AppNotFoundException } from 'src/shared/exceptions';
import { PlayVideoEntryRepository } from '../repositories/play-video-entry.repository';
import { PlayEngagementRepository } from '../repositories/play-engagement.repository';
import { PlayAccessService } from './play-access.service';
import { PlayEngagementService } from './play-engagement.service';

describe('PlayEngagementService', () => {
  const entries = { isVisible: jest.fn() };
  const repo = {
    recordView: jest.fn(),
    saveProgress: jest.fn(),
    addFavorite: jest.fn(),
    removeFavorite: jest.fn(),
  };
  const access = { assertEnabled: jest.fn() };
  let service: PlayEngagementService;

  beforeEach(async () => {
    jest.clearAllMocks();
    access.assertEnabled.mockResolvedValue(undefined);
    entries.isVisible.mockResolvedValue(true);
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlayEngagementService,
        { provide: PlayVideoEntryRepository, useValue: entries },
        { provide: PlayEngagementRepository, useValue: repo },
        { provide: PlayAccessService, useValue: access },
      ],
    }).compile();
    service = moduleRef.get(PlayEngagementService);
  });

  it('conta a visualização uma vez por janela', async () => {
    repo.recordView.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    expect(await service.recordView('u1', 'v1')).toEqual({ counted: true });
    expect(await service.recordView('u1', 'v1')).toEqual({ counted: false });
  });

  it('marca como concluído a partir de 95% e zera a posição', async () => {
    await service.saveProgress('u1', 'v1', {
      positionSeconds: 195,
      durationSeconds: 200,
    });

    expect(repo.saveProgress).toHaveBeenCalledWith('u1', 'v1', {
      positionSeconds: 0,
      durationSeconds: 200,
      completed: true,
    });
  });

  it('guarda a posição quando ainda não terminou', async () => {
    await service.saveProgress('u1', 'v1', {
      positionSeconds: 40,
      durationSeconds: 200,
    });

    expect(repo.saveProgress).toHaveBeenCalledWith('u1', 'v1', {
      positionSeconds: 40,
      durationSeconds: 200,
      completed: false,
    });
  });

  it('não conclui sem saber a duração', async () => {
    await service.saveProgress('u1', 'v1', { positionSeconds: 500 });

    expect(repo.saveProgress).toHaveBeenCalledWith(
      'u1',
      'v1',
      expect.objectContaining({ completed: false, durationSeconds: null }),
    );
  });

  it('favorita e desfavorita', async () => {
    await service.setFavorite('u1', 'v1', true);
    await service.setFavorite('u1', 'v1', false);

    expect(repo.addFavorite).toHaveBeenCalledWith('u1', 'v1');
    expect(repo.removeFavorite).toHaveBeenCalledWith('u1', 'v1');
  });

  it('404 para vídeo fora do Play em qualquer ação', async () => {
    entries.isVisible.mockResolvedValue(false);

    await expect(service.recordView('u1', 'v1')).rejects.toBeInstanceOf(
      AppNotFoundException,
    );
    await expect(service.setFavorite('u1', 'v1', true)).rejects.toBeInstanceOf(
      AppNotFoundException,
    );
    expect(repo.recordView).not.toHaveBeenCalled();
  });
});
