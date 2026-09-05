import { Test } from '@nestjs/testing';

import { UserRole } from 'src/core/auth/auth.types';
import { EmailService } from 'src/shared/email';
import { SiteUrlService } from 'src/shared/site-url';

import { UserEntity } from '../entities/user.entity';
import { NotifyAccountChangesService } from './notify-account-changes.service';

/** Espera o microtask em que o envio em segundo plano acontece. */
const flush = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

const user = (overrides: Partial<UserEntity> = {}): UserEntity =>
  ({
    id: 'user-1',
    name: 'Ana',
    email: 'ana@exemplo.com',
    role: UserRole.TEACHER,
    ...overrides,
  }) as UserEntity;

describe('NotifyAccountChangesService', () => {
  const emailService = {
    sendPasswordChanged: jest.fn(),
    sendEmailAddressChanged: jest.fn(),
    sendAccountApproved: jest.fn(),
    sendRoleChanged: jest.fn(),
    sendAccountDeactivated: jest.fn(),
    sendAccountDeleted: jest.fn(),
    sendAccountCreatedByAdmin: jest.fn(),
  };

  // Real o bastante para conferir a URL montada, como na spec do anúncio de
  // material da semana.
  const siteUrlService = {
    baseUrl: 'https://clubinhonib.com',
    buildUrl: (...segments: string[]): string =>
      `https://clubinhonib.com/${segments.join('/')}`,
  };

  let service: NotifyAccountChangesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    Object.values(emailService).forEach((fn) =>
      fn.mockResolvedValue(undefined),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotifyAccountChangesService,
        { provide: EmailService, useValue: emailService },
        { provide: SiteUrlService, useValue: siteUrlService },
      ],
    }).compile();

    service = moduleRef.get(NotifyAccountChangesService);
  });

  it('avisa a troca de senha com o link de entrada', async () => {
    service.passwordChangedInBackground(user());
    await flush();

    expect(emailService.sendPasswordChanged).toHaveBeenCalledWith(
      { id: 'user-1', name: 'Ana', email: 'ana@exemplo.com' },
      expect.objectContaining({
        recipientName: 'Ana',
        loginLink: 'https://clubinhonib.com/login',
      }),
    );
  });

  /**
   * O ponto do aviso: quem trocou o endereço com uma sessão roubada passa a
   * receber tudo, e esta mensagem é a única que ainda alcança o dono da conta.
   */
  it('manda o aviso de troca de e-mail para o endereço antigo', async () => {
    service.emailAddressChangedInBackground(
      'antigo@exemplo.com',
      'Ana',
      'novo@exemplo.com',
    );
    await flush();

    expect(emailService.sendEmailAddressChanged).toHaveBeenCalledWith(
      'antigo@exemplo.com',
      expect.objectContaining({ newEmail: 'novo@exemplo.com' }),
    );
  });

  it('avisa o cadastro aprovado', async () => {
    service.accountApprovedInBackground(user());
    await flush();

    expect(emailService.sendAccountApproved).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ana@exemplo.com' }),
      expect.objectContaining({ recipientName: 'Ana' }),
    );
  });

  /** O papel sai em português: o enum é inglês e o e-mail não é. */
  it('traduz os papéis no aviso de mudança de papel', async () => {
    service.roleChangedInBackground(
      user({ role: UserRole.COORDINATOR }),
      UserRole.TEACHER,
    );
    await flush();

    expect(emailService.sendRoleChanged).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        previousRole: 'Professor',
        currentRole: 'Coordenador',
      }),
    );
  });

  it('avisa a desativação da conta', async () => {
    service.accountDeactivatedInBackground(user());
    await flush();

    expect(emailService.sendAccountDeactivated).toHaveBeenCalled();
  });

  /** A linha do usuário já não existe: nome e endereço vêm soltos. */
  it('avisa a exclusão com os dados guardados antes de apagar', async () => {
    service.accountDeletedInBackground('ana@exemplo.com', 'Ana');
    await flush();

    expect(emailService.sendAccountDeleted).toHaveBeenCalledWith(
      'ana@exemplo.com',
      { recipientName: 'Ana' },
    );
  });

  it('manda o link de definir senha nas boas-vindas', async () => {
    service.accountCreatedInBackground(
      user(),
      'https://clubinhonib.com/recuperar-senha/abc',
    );
    await flush();

    expect(emailService.sendAccountCreatedByAdmin).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        role: 'Professor',
        passwordSetupLink: 'https://clubinhonib.com/recuperar-senha/abc',
        validityHours: 48,
      }),
    );
  });

  /**
   * A alteração na conta já está gravada quando o aviso começa. Uma falha de
   * SMTP não pode derrubar a requisição que aprovou um cadastro.
   */
  it('engole a falha do envio sem quebrar quem chamou', async () => {
    emailService.sendAccountApproved.mockRejectedValue(new Error('SMTP fora'));

    expect(() => service.accountApprovedInBackground(user())).not.toThrow();
    await flush();
  });
});
