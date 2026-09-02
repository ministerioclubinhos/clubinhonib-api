import { Test } from '@nestjs/testing';
import * as crypto from 'crypto';
import { AppBusinessException } from 'src/shared/exceptions';
import { EmailService } from 'src/shared/email';
import { UserEntity } from 'src/core/user/entities/user.entity';
import { GetUsersService } from 'src/core/user/services/get-user.service';
import { UpdateUserService } from 'src/core/user/services/update-user.service';
import { EmailVerificationTokenRepository } from '../repositories/email-verification-token.repository';
import { EmailVerificationService } from './email-verification.service';
import { SiteUrlService } from 'src/shared/site-url';
import { EMAIL_VERIFICATION_MESSAGES } from '../constants';

const buildUser = (overrides: Partial<UserEntity> = {}): UserEntity =>
  Object.assign(new UserEntity(), {
    id: 'user-1',
    name: 'Ana',
    email: 'ana@exemplo.com',
    active: false,
    ...overrides,
  });

const sha256 = (value: string): string =>
  crypto.createHash('sha256').update(value).digest('hex');

describe('EmailVerificationService', () => {
  const tokenRepo = {
    createToken: jest.fn(),
    findValidByHash: jest.fn(),
    findLatestValidOfUser: jest.fn(),
    deleteAllOfUser: jest.fn(),
  };
  const emailService = { sendEmailVerification: jest.fn() };
  const getUsersService = { findByEmail: jest.fn() };
  const updateUserService = { update: jest.fn() };
  const siteUrlService = {
    baseUrl: 'https://clubinhonib.com',
    buildUrl: (...segments: string[]) =>
      `https://clubinhonib.com/${segments.join('/')}`,
  };

  let service: EmailVerificationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    tokenRepo.findLatestValidOfUser.mockResolvedValue(null);

    const moduleRef = await Test.createTestingModule({
      providers: [
        EmailVerificationService,
        { provide: EmailVerificationTokenRepository, useValue: tokenRepo },
        { provide: EmailService, useValue: emailService },
        { provide: GetUsersService, useValue: getUsersService },
        { provide: UpdateUserService, useValue: updateUserService },
        { provide: SiteUrlService, useValue: siteUrlService },
      ],
    }).compile();

    service = moduleRef.get(EmailVerificationService);
  });

  describe('sendIfPending', () => {
    it('envia a confirmação para conta inativa', async () => {
      const result = await service.sendIfPending(buildUser());

      expect(result).toEqual({
        verificationEmailSent: true,
        message: EMAIL_VERIFICATION_MESSAGES.sent,
      });
      expect(emailService.sendEmailVerification).toHaveBeenCalledWith(
        'ana@exemplo.com',
        expect.objectContaining({ recipientName: 'Ana' }),
      );
    });

    it('não envia nada para conta já ativa', async () => {
      const result = await service.sendIfPending(buildUser({ active: true }));

      expect(result.verificationEmailSent).toBe(false);
      expect(result.message).toBe(EMAIL_VERIFICATION_MESSAGES.verified);
      expect(emailService.sendEmailVerification).not.toHaveBeenCalled();
    });

    it('não reenvia dentro do intervalo, para cada login não virar um e-mail', async () => {
      tokenRepo.findLatestValidOfUser.mockResolvedValue({
        createdAt: new Date(),
      });

      const result = await service.sendIfPending(buildUser());

      expect(result.verificationEmailSent).toBe(false);
      expect(result.message).toBe(EMAIL_VERIFICATION_MESSAGES.alreadySent);
      expect(emailService.sendEmailVerification).not.toHaveBeenCalled();
    });

    it('reenvia depois que o intervalo passa', async () => {
      tokenRepo.findLatestValidOfUser.mockResolvedValue({
        createdAt: new Date(Date.now() - 10 * 60_000),
      });

      const result = await service.sendIfPending(buildUser());

      expect(result.verificationEmailSent).toBe(true);
    });

    it('grava só o hash do token; o valor original vai apenas no link', async () => {
      await service.sendIfPending(buildUser());

      const [[, storedHash]] = tokenRepo.createToken.mock.calls as [
        [string, string, Date],
      ];
      const [[, data]] = emailService.sendEmailVerification.mock.calls as [
        [string, { verificationLink: string }],
      ];
      const sentToken = data.verificationLink.split('/').pop() as string;

      expect(storedHash).toBe(sha256(sentToken));
      expect(storedHash).not.toBe(sentToken);
    });

    it('descarta os tokens anteriores antes de criar o novo', async () => {
      await service.sendIfPending(buildUser());

      expect(tokenRepo.deleteAllOfUser).toHaveBeenCalledWith('user-1');
    });
  });

  describe('resend', () => {
    it('envia quando a conta existe e está inativa', async () => {
      getUsersService.findByEmail.mockResolvedValue(buildUser());

      const result = await service.resend('ana@exemplo.com');

      expect(result.verificationEmailSent).toBe(true);
    });

    it('responde igual para e-mail sem cadastro, sem enviar nada', async () => {
      // Uma resposta diferente entregaria quais endereços existem.
      getUsersService.findByEmail.mockResolvedValue(null);

      const result = await service.resend('ninguem@exemplo.com');

      expect(result).toEqual({
        verificationEmailSent: false,
        message: EMAIL_VERIFICATION_MESSAGES.sent,
      });
      expect(emailService.sendEmailVerification).not.toHaveBeenCalled();
    });

    it('ignora o intervalo do envio automático', async () => {
      getUsersService.findByEmail.mockResolvedValue(buildUser());
      tokenRepo.findLatestValidOfUser.mockResolvedValue({
        createdAt: new Date(),
      });

      const result = await service.resend('ana@exemplo.com');

      expect(result.verificationEmailSent).toBe(true);
    });
  });

  describe('verify', () => {
    it('ativa a conta e apaga os tokens', async () => {
      tokenRepo.findValidByHash.mockResolvedValue({
        user: buildUser(),
      });

      const result = await service.verify('token-cru');

      expect(tokenRepo.findValidByHash).toHaveBeenCalledWith(
        sha256('token-cru'),
      );
      expect(updateUserService.update).toHaveBeenCalledWith('user-1', {
        active: true,
      });
      expect(tokenRepo.deleteAllOfUser).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ email: 'ana@exemplo.com' });
    });

    it('recusa token inválido ou vencido', async () => {
      tokenRepo.findValidByHash.mockResolvedValue(null);

      await expect(service.verify('qualquer')).rejects.toBeInstanceOf(
        AppBusinessException,
      );
      expect(updateUserService.update).not.toHaveBeenCalled();
    });
  });
});
