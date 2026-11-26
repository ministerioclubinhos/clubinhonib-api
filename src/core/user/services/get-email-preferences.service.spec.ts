import { Test } from '@nestjs/testing';

import { AppNotFoundException } from 'src/shared/exceptions';

import { UserRepository } from '../user.repository';
import { GetEmailPreferencesService } from './get-email-preferences.service';

describe('GetEmailPreferencesService', () => {
  const userRepo = { findById: jest.fn() };

  const build = async (): Promise<GetEmailPreferencesService> => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        GetEmailPreferencesService,
        { provide: UserRepository, useValue: userRepo },
      ],
    }).compile();
    return moduleRef.get(GetEmailPreferencesService);
  };

  beforeEach(() => jest.clearAllMocks());

  it('quem nunca saiu da lista recebe os avisos por e-mail', async () => {
    userRepo.findById.mockResolvedValue({ noticesUnsubscribedAt: null });

    await expect((await build()).findMine('user-1')).resolves.toEqual({
      noticesEnabled: true,
    });
  });

  it('quem saiu (pelo link ou pelas configurações) aparece desligado', async () => {
    userRepo.findById.mockResolvedValue({
      noticesUnsubscribedAt: new Date('2026-01-01T00:00:00Z'),
    });

    await expect((await build()).findMine('user-1')).resolves.toEqual({
      noticesEnabled: false,
    });
  });

  it('falha quando a conta não existe', async () => {
    userRepo.findById.mockResolvedValue(null);

    await expect((await build()).findMine('user-1')).rejects.toBeInstanceOf(
      AppNotFoundException,
    );
  });
});
