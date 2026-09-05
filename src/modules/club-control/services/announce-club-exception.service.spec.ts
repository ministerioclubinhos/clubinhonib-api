import { Test } from '@nestjs/testing';

import { GetUsersService } from 'src/core/user/services/get-user.service';
import { EmailService } from 'src/shared/email';

import { ClubExceptionEntity } from '../entities/club-exception.entity';
import { AnnounceClubExceptionService } from './announce-club-exception.service';

const flush = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

const exception = (
  overrides: Partial<ClubExceptionEntity> = {},
): ClubExceptionEntity =>
  ({
    id: 'exc-1',
    exceptionDate: '2026-05-01',
    reason: 'Dia do Trabalho',
    notes: null,
    isActive: true,
    isRecurrent: true,
    ...overrides,
  }) as ClubExceptionEntity;

describe('AnnounceClubExceptionService', () => {
  const emailService = { sendClubDayCancelled: jest.fn() };
  const getUsersService = { findActiveRecipients: jest.fn() };

  let service: AnnounceClubExceptionService;

  beforeEach(async () => {
    jest.clearAllMocks();
    emailService.sendClubDayCancelled.mockResolvedValue({
      recipients: 1,
      sent: 1,
      failed: 0,
    });
    getUsersService.findActiveRecipients.mockResolvedValue([
      { id: 'u1', name: 'Ana', email: 'ana@exemplo.com' },
    ]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        AnnounceClubExceptionService,
        { provide: EmailService, useValue: emailService },
        { provide: GetUsersService, useValue: getUsersService },
      ],
    }).compile();

    service = moduleRef.get(AnnounceClubExceptionService);
  });

  /**
   * A exceção é global por data: quem coordena acompanha clubes de dias
   * diferentes, e um professor que troca de clube precisaria descobrir sozinho.
   */
  it('avisa toda a base com a data e o motivo', async () => {
    await service.announce(exception({ notes: 'Sem atividades' }));

    expect(getUsersService.findActiveRecipients).toHaveBeenCalled();
    expect(emailService.sendClubDayCancelled).toHaveBeenCalledWith(
      [{ id: 'u1', name: 'Ana', email: 'ana@exemplo.com' }],
      {
        date: '2026-05-01',
        reason: 'Dia do Trabalho',
        notes: 'Sem atividades',
        isRecurrent: true,
      },
    );
  });

  it('não avisa sobre exceção inativa', async () => {
    await service.announce(exception({ isActive: false }));

    expect(emailService.sendClubDayCancelled).not.toHaveBeenCalled();
  });

  it('engole a falha do envio em segundo plano', async () => {
    getUsersService.findActiveRecipients.mockRejectedValue(
      new Error('banco fora'),
    );

    expect(() => service.announceInBackground(exception())).not.toThrow();
    await flush();
  });
});
