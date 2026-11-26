import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppInternalException } from 'src/shared/exceptions';
import { SmtpService } from './smtp.service';

const sendMail = jest.fn();
const verify = jest.fn();
const createTransport = jest.fn<
  { sendMail: jest.Mock; verify: jest.Mock },
  [unknown]
>(() => ({ sendMail, verify }));

jest.mock('nodemailer', () => ({
  createTransport: (options: unknown) => createTransport(options),
}));

const message = {
  to: 'ana@exemplo.com',
  subject: 'Assunto',
  html: '<p>Oi</p>',
  text: 'Oi',
};

const buildService = async (
  config: Record<string, string>,
): Promise<SmtpService> => {
  const moduleRef = await Test.createTestingModule({
    providers: [
      SmtpService,
      {
        provide: ConfigService,
        useValue: { get: (key: string) => config[key] },
      },
    ],
  }).compile();

  return moduleRef.get(SmtpService);
};

const CONFIGURED = {
  SMTP_HOST: 'smtp.gmail.com',
  SMTP_PORT: '587',
  SMTP_USER: 'conta@gmail.com',
  SMTP_PASSWORD: 'senha-de-app',
  MAIL_FROM_NAME: 'Clubinhos NIB',
};

describe('SmtpService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sendMail.mockResolvedValue(undefined);
    verify.mockResolvedValue(true);
  });

  it('usa STARTTLS na porta 587 e TLS direto na 465', async () => {
    await buildService(CONFIGURED);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: 587, secure: false }),
    );

    await buildService({ ...CONFIGURED, SMTP_PORT: '465' });
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: 465, secure: true }),
    );
  });

  it('envia com o remetente montado a partir das variáveis', async () => {
    const service = await buildService(CONFIGURED);

    await service.sendMail(message);

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '"Clubinhos NIB" <conta@gmail.com>',
        to: ['ana@exemplo.com'],
        subject: 'Assunto',
        text: 'Oi',
        html: '<p>Oi</p>',
      }),
    );
  });

  it('usa a conta autenticada como remetente quando MAIL_FROM_ADDRESS falta', async () => {
    // O Gmail reescreve qualquer remetente que não seja a conta ou um alias.
    const service = await buildService(CONFIGURED);
    await service.sendMail(message);

    const [[sent]] = sendMail.mock.calls as [[{ from: string }]];
    expect(sent.from).toContain('conta@gmail.com');
  });

  it('recusa envio quando o SMTP não está configurado', async () => {
    const service = await buildService({ SMTP_HOST: 'smtp.gmail.com' });

    await expect(service.sendMail(message)).rejects.toBeInstanceOf(
      AppInternalException,
    );
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('recusa envio sem destinatário, em vez de fingir sucesso', async () => {
    const service = await buildService(CONFIGURED);

    await expect(
      service.sendMail({ ...message, to: ['', '  '] }),
    ).rejects.toBeInstanceOf(AppInternalException);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('embrulha a falha do transporte no erro da aplicação', async () => {
    const service = await buildService(CONFIGURED);
    sendMail.mockRejectedValue(new Error('535 auth failed'));

    await expect(service.sendMail(message)).rejects.toBeInstanceOf(
      AppInternalException,
    );
  });

  it('verifica a conexão no boot quando há credenciais', async () => {
    const service = await buildService(CONFIGURED);

    await service.onModuleInit();

    expect(verify).toHaveBeenCalled();
  });

  it('não verifica a conexão sem credenciais', async () => {
    const service = await buildService({});

    await service.onModuleInit();

    expect(verify).not.toHaveBeenCalled();
  });

  it('não derruba o boot quando a verificação falha', async () => {
    const service = await buildService(CONFIGURED);
    verify.mockRejectedValue(new Error('sem rede'));

    await expect(service.onModuleInit()).resolves.toBeUndefined();
  });
});
