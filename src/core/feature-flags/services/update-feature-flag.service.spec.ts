import { Test } from '@nestjs/testing';

import { AppBusinessException } from 'src/shared/exceptions';

import { FeatureFlagsRepository } from '../feature-flags.repository';
import { FeatureFlagEntity } from '../entities/feature-flag.entity';
import { GetFeatureFlagsService } from './get-feature-flags.service';
import { UpdateFeatureFlagService } from './update-feature-flag.service';

const buildFlag = () =>
  Object.assign(new FeatureFlagEntity(), {
    id: 'flag-1',
    key: 'statistics',
    name: 'Estatísticas',
    description: 'Painel',
    enabled: true,
    targetRoles: ['admin'],
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }) as FeatureFlagEntity;

describe('UpdateFeatureFlagService', () => {
  const repository = { findByKey: jest.fn(), save: jest.fn() };
  const getService = {
    findEntityOrFail: jest.fn(),
    invalidate: jest.fn(),
  };

  let service: UpdateFeatureFlagService;

  beforeEach(async () => {
    jest.clearAllMocks();
    getService.findEntityOrFail.mockResolvedValue(buildFlag());
    repository.save.mockImplementation((flag: FeatureFlagEntity) => flag);
    repository.findByKey.mockResolvedValue(null);

    const moduleRef = await Test.createTestingModule({
      providers: [
        UpdateFeatureFlagService,
        { provide: FeatureFlagsRepository, useValue: repository },
        { provide: GetFeatureFlagsService, useValue: getService },
      ],
    }).compile();

    service = moduleRef.get(UpdateFeatureFlagService);
  });

  it('renomeia a chave', async () => {
    const saved = await service.update('statistics', { key: 'metricas' });

    expect(saved.key).toBe('metricas');
  });

  it('esquece a chave antiga e a nova no cache', async () => {
    // A antiga some e a nova passa a valer; deixar qualquer uma guardada faria
    // a resposta anterior sobreviver à renomeação.
    await service.update('statistics', { key: 'metricas' });

    expect(getService.invalidate).toHaveBeenCalledWith('statistics');
    expect(getService.invalidate).toHaveBeenCalledWith('metricas');
  });

  it('recusa uma chave já usada por outra flag', async () => {
    repository.findByKey.mockResolvedValue(buildFlag());

    await expect(
      service.update('statistics', { key: 'pagelas' }),
    ).rejects.toBeInstanceOf(AppBusinessException);
  });

  it('não procura conflito quando a chave não muda', async () => {
    await service.update('statistics', { key: 'statistics', name: 'Outro' });

    expect(repository.findByKey).not.toHaveBeenCalled();
  });

  it('só toca no que veio no corpo', async () => {
    const saved = await service.update('statistics', { name: 'Métricas' });

    expect(saved.name).toBe('Métricas');
    expect(saved.description).toBe('Painel');
    expect(saved.enabled).toBe(true);
    expect(saved.targetRoles).toEqual(['admin']);
  });

  it('normaliza os perfis alvo recebidos', async () => {
    const saved = await service.update('statistics', {
      targetRoles: [' TEACHER ', 'admin', 'admin'] as never,
    });

    expect(saved.targetRoles).toEqual(['admin', 'teacher']);
    expect(saved.audience).toBe('ADMIN_TEACHER');
  });

  it('inverte a situação no toggle, sem mexer no resto', async () => {
    const saved = await service.toggle('statistics');

    expect(saved.enabled).toBe(false);
    expect(saved.targetRoles).toEqual(['admin']);
    expect(getService.invalidate).toHaveBeenCalledWith('statistics');
  });
});
