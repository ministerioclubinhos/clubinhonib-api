import { Test } from '@nestjs/testing';

import { UnsubscribeTokenService } from 'src/shared/email/unsubscribe-token.service';
import {
  AppNotFoundException,
  AppValidationException,
} from 'src/shared/exceptions';

import { UserEntity } from '../entities/user.entity';
import { UserRepository } from '../user.repository';
import { UpdateEmailPreferencesService } from './update-email-preferences.service';

describe('UpdateEmailPreferencesService', () => {
  const userRepo = {
    findById: jest.fn(),
    setNoticesUnsubscribedAt: jest.fn(),
  };
  const unsubscribeTokenService = { verify: jest.fn() };

  const build = async (): Promise<UpdateEmailPreferencesService> => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        UpdateEmailPreferencesService,
        { provide: UserRepository, useValue: userRepo },
        {
          provide: UnsubscribeTokenService,
          useValue: unsubscribeTokenService,
        },
      ],
    }).compile();

    return moduleRef.get(UpdateEmailPreferencesService);
  };

  const user = (overrides: Partial<UserEntity> = {}): UserEntity =>
    ({
      id: 'user-1',
      email: 'ana@exemplo.com',
      noticesUnsubscribedAt: null,
      ...overrides,
    }) as UserEntity;

  beforeEach(() => {
    jest.clearAllMocks();
    unsubscribeTokenService.verify.mockReturnValue('user-1');
    userRepo.findById.mockResolvedValue(user());
  });

  it('registra a saída da lista', async () => {
    const service = await build();

    const result = await service.unsubscribeFromNotices('token-valido');

    expect(userRepo.setNoticesUnsubscribedAt).toHaveBeenCalledWith(
      'user-1',
      expect.any(Date),
    );
    expect(result.unsubscribed).toBe(true);
  });

  /** O segundo clique costuma ser o da dúvida se o primeiro pegou. */
  it('é idempotente: clicar de novo não é erro nem regrava a data', async () => {
    userRepo.findById.mockResolvedValue(
      user({ noticesUnsubscribedAt: new Date('2026-01-01T00:00:00Z') }),
    );
    const service = await build();

    const result = await service.unsubscribeFromNotices('token-valido');

    expect(userRepo.setNoticesUnsubscribedAt).not.toHaveBeenCalled();
    expect(result.unsubscribed).toBe(true);
  });

  it('recusa token inválido', async () => {
    unsubscribeTokenService.verify.mockReturnValue(null);
    const service = await build();

    await expect(
      service.unsubscribeFromNotices('token-forjado'),
    ).rejects.toBeInstanceOf(AppValidationException);
    expect(userRepo.setNoticesUnsubscribedAt).not.toHaveBeenCalled();
  });

  /** A resposta não conta se aquele endereço existe na base. */
  it('responde igual quando o usuário do token não existe mais', async () => {
    userRepo.findById.mockResolvedValue(null);
    const service = await build();

    await expect(
      service.unsubscribeFromNotices('token-de-usuario-removido'),
    ).rejects.toBeInstanceOf(AppValidationException);
  });

  describe('updateMine (configurações de notificação, com sessão)', () => {
    it('desligar grava a data de saída da lista', async () => {
      const service = await build();

      const result = await service.updateMine('user-1', false);

      expect(userRepo.setNoticesUnsubscribedAt).toHaveBeenCalledWith(
        'user-1',
        expect.any(Date),
      );
      expect(result).toEqual({ noticesEnabled: false });
    });

    it('religar limpa a data e devolve a pessoa às listas de avisos', async () => {
      userRepo.findById.mockResolvedValue(
        user({ noticesUnsubscribedAt: new Date('2026-01-01T00:00:00Z') }),
      );
      const service = await build();

      const result = await service.updateMine('user-1', true);

      expect(userRepo.setNoticesUnsubscribedAt).toHaveBeenCalledWith(
        'user-1',
        null,
      );
      expect(result).toEqual({ noticesEnabled: true });
    });

    it('é idempotente: repetir a escolha não regrava nada', async () => {
      const service = await build();
      await expect(service.updateMine('user-1', true)).resolves.toEqual({
        noticesEnabled: true,
      });

      const since = new Date('2026-01-01T00:00:00Z');
      userRepo.findById.mockResolvedValue(
        user({ noticesUnsubscribedAt: since }),
      );
      await expect(service.updateMine('user-1', false)).resolves.toEqual({
        noticesEnabled: false,
      });
      expect(userRepo.setNoticesUnsubscribedAt).not.toHaveBeenCalled();
    });

    it('falha quando a conta não existe mais', async () => {
      userRepo.findById.mockResolvedValue(null);
      const service = await build();

      await expect(service.updateMine('user-1', true)).rejects.toBeInstanceOf(
        AppNotFoundException,
      );
    });
  });
});
