import { Test } from '@nestjs/testing';
import { AppBusinessException } from 'src/shared/exceptions';
import { EmailService } from 'src/shared/email';
import { UserEntity } from 'src/core/user/entities/user.entity';
import { GetUsersService } from 'src/core/user/services/get-user.service';
import { UpdateUserService } from 'src/core/user/services/update-user.service';
import { PasswordResetTokenRepository } from '../repositories/password-reset-token.repository';
import { PasswordRecoveryService } from './password-recovery.service';
import { SiteUrlService } from 'src/shared/site-url';

const user = Object.assign(new UserEntity(), {
  id: 'user-1',
  name: 'Ana',
  email: 'ana@exemplo.com',
  active: true,
});

describe('PasswordRecoveryService', () => {
  const getUsersService = { findByEmail: jest.fn() };
  const updateUserService = { update: jest.fn() };
  const emailService = {
    sendPasswordRecovery: jest.fn(),
    sendPasswordChanged: jest.fn(),
  };
  const passwordResetTokenRepo = {
    createToken: jest.fn(),
    findValidToken: jest.fn(),
    deleteToken: jest.fn(),
    invalidateTokensForUser: jest.fn(),
  };
  const siteUrlService = {
    baseUrl: 'https://clubinhonib.com',
    buildUrl: (...segments: string[]) =>
      `https://clubinhonib.com/${segments.join('/')}`,
  };

  let service: PasswordRecoveryService;

  beforeEach(async () => {
    jest.clearAllMocks();
    getUsersService.findByEmail.mockResolvedValue(user);

    const moduleRef = await Test.createTestingModule({
      providers: [
        PasswordRecoveryService,
        { provide: GetUsersService, useValue: getUsersService },
        { provide: UpdateUserService, useValue: updateUserService },
        { provide: EmailService, useValue: emailService },
        {
          provide: PasswordResetTokenRepository,
          useValue: passwordResetTokenRepo,
        },
        { provide: SiteUrlService, useValue: siteUrlService },
      ],
    }).compile();

    service = moduleRef.get(PasswordRecoveryService);
  });

  describe('forgotPassword', () => {
    it('cria o token e envia o link de recuperação', async () => {
      const result = await service.forgotPassword({ email: user.email });

      expect(
        passwordResetTokenRepo.invalidateTokensForUser,
      ).toHaveBeenCalledWith('user-1');
      expect(passwordResetTokenRepo.createToken).toHaveBeenCalled();
      expect(emailService.sendPasswordRecovery).toHaveBeenCalledWith(
        'ana@exemplo.com',
        expect.objectContaining({
          recipientName: 'Ana',
          resetLink: expect.stringContaining(
            'https://clubinhonib.com/recuperar-senha/',
          ) as string,
        }),
      );
      expect(result.status).toBe('RESET_LINK_SENT');
    });

    it('responde igual para e-mail sem cadastro, sem enviar nada', async () => {
      // A resposta antiga era 404 "Email não encontrado", que dizia ao atacante
      // exatamente quais endereços existem.
      getUsersService.findByEmail.mockResolvedValue(null);

      const result = await service.forgotPassword({
        email: 'ninguem@exemplo.com',
      });

      expect(result.status).toBe('RESET_LINK_SENT');
      expect(emailService.sendPasswordRecovery).not.toHaveBeenCalled();
      expect(passwordResetTokenRepo.createToken).not.toHaveBeenCalled();
    });

    it('não depende mais de verificação de identidade no provedor', async () => {
      // Antes, quem não fosse identidade verificada no SES nunca recebia o link.
      const result = await service.forgotPassword({ email: user.email });

      expect(result.status).toBe('RESET_LINK_SENT');
      expect(emailService.sendPasswordRecovery).toHaveBeenCalledTimes(1);
    });
  });

  describe('resetPassword', () => {
    beforeEach(() => {
      passwordResetTokenRepo.findValidToken.mockResolvedValue({ user });
    });

    it('troca a senha, apaga o token e avisa por e-mail', async () => {
      await service.resetPassword({ token: 'abc', newPassword: 'novaSenha1' });

      expect(updateUserService.update).toHaveBeenCalledWith('user-1', {
        password: 'novaSenha1',
      });
      expect(passwordResetTokenRepo.deleteToken).toHaveBeenCalledWith('abc');
      expect(emailService.sendPasswordChanged).toHaveBeenCalledWith(
        'ana@exemplo.com',
        expect.objectContaining({ recipientName: 'Ana' }),
      );
    });

    it('recusa token inválido ou vencido', async () => {
      passwordResetTokenRepo.findValidToken.mockResolvedValue(null);

      await expect(
        service.resetPassword({ token: 'x', newPassword: 'novaSenha1' }),
      ).rejects.toBeInstanceOf(AppBusinessException);
      expect(updateUserService.update).not.toHaveBeenCalled();
    });
  });

  describe('validateResetToken', () => {
    it('devolve o e-mail do dono do token válido', async () => {
      passwordResetTokenRepo.findValidToken.mockResolvedValue({ user });

      await expect(service.validateResetToken('abc')).resolves.toEqual({
        valid: true,
        email: 'ana@exemplo.com',
      });
    });

    it('recusa token inválido', async () => {
      passwordResetTokenRepo.findValidToken.mockResolvedValue(null);

      await expect(service.validateResetToken('x')).rejects.toBeInstanceOf(
        AppBusinessException,
      );
    });
  });
});
